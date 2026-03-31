# 상태 생명주기

이 문서는 `DomainState` 인스턴스가 생성되어 소멸하기까지의 상태 전이를 기술합니다.

## 전체 생명주기

```text
┌─────────────────────────────────────────────────────────────────┐
│  생성 (Factory Method)                                          │
│                                                                 │
│  fromJSON(jsonText, handler)   → _isNew: false                  │
│  fromVO(vo, handler)           → _isNew: true                   │
│  fromForm(formId, handler)     → _isNew: true                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  활성 상태 (Active)                                             │
│                                                                 │
│  domainState.data.* = value                                     │
│    → set 트랩 → record() → changeLog.push() → dirtyFields.add() │
│    → onMutate() → _scheduleFlush()                              │
│    → [Microtask] _buildSnapshot() → #shadowCache 갱신           │
│    → _notifyListeners() (subscribe 리스너 호출)                  │
│    → if debug: _broadcast()                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  저장 시도 (save())                                             │
│                                                                 │
│  #snapshot = { data: safeClone(...), changeLog, dirtyFields, isNew }
│                                                                 │
│  ┌─ 성공 경로 ──────────────────────────────────────────────┐   │
│  │  _fetch() → 2xx                                          │   │
│  │  _clearChangeLog(), _clearDirtyFields()                  │   │
│  │  if POST: _isNew = false                                 │   │
│  │  #snapshot 유지 (Pipeline 보상 트랜잭션 기준점)            │   │
│  │  if debug: _broadcast()                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ 실패 경로 ──────────────────────────────────────────────┐   │
│  │  _fetch() → 4xx/5xx/NetworkError                         │   │
│  │  _rollback(#snapshot)                                    │   │
│  │    restoreTarget, restoreChangeLog, restoreDirtyFields   │   │
│  │    _isNew = snapshot.isNew                               │   │
│  │  throw err (re-throw)                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
              (성공 후) 다시 활성 상태로 복귀
              (실패 후) 스냅샷 상태로 복귀
```

## _isNew 플래그 상태 전이

```text
fromVO / fromForm 생성  →  _isNew: true
                              │
                        save() 호출
                              │
                    POST 요청 → 2xx 응답
                              │
                          _isNew: false  (자동 전환)
                              │
                    이후 save() → PUT / PATCH 분기
```

`_fetch()` 가 throw하면 `_isNew = false` 라인이 실행되지 않으므로 `_isNew: true` 가 유지됩니다. 롤백 시 스냅샷에서 명시적으로 `_isNew` 도 복원합니다.

---

## Shadow State — 불변 스냅샷

`DomainState` 는 Proxy 기반 In-place Mutation 방식으로 상태를 관리합니다. React 와 같이 참조 동등성(Reference Equality) 기반 렌더링 최적화를 사용하는 프레임워크와 연동하려면 변경 시 새 참조를 제공해야 합니다. 이를 위해 Shadow State 메커니즘을 내장하고 있습니다.

### #shadowCache — 스냅샷 캐시

`DomainState` 는 `#shadowCache` 라는 Private 필드에 가장 최근의 불변 스냅샷을 저장합니다.

```text
#shadowCache 갱신 시점

Proxy set 트랩 발화
  → dirtyFields 기록
  → microtask 배칭 완료
  → _buildSnapshot()
       변경된 경로만 얕은 복사 (Structural Sharing)
       변경 없는 자식 노드는 기존 참조 재사용
  → maybeDeepFreeze() 적용 (개발 환경만)
  → #shadowCache ← 새 불변 객체 참조
  → _notifyListeners() 호출
```

### Structural Sharing

Immer.js 와 동일한 원리입니다. 변경된 경로의 노드만 새 객체를 만들고, 변경되지 않은 하위 노드는 기존 메모리 참조를 공유합니다.

```javascript
const state = DomainState.fromJSON(JSON.stringify({
    name: 'Davi',
    address: { city: 'Seoul', zip: '04524' },
    role: 'admin',
}), api)

const snap1 = state.getSnapshot()

state.data.name = 'Davi Lee'  // name만 변경
await Promise.resolve()        // microtask flush

const snap2 = state.getSnapshot()

// 루트 참조: 다름 (name이 변경됐으므로)
console.log(snap1 === snap2)                   // false

// address: 동일 참조 (변경 없음 → Structural Sharing)
console.log(snap1.address === snap2.address)   // true

// role: 동일 참조 (변경 없음)
console.log(snap1.role === snap2.role)         // true
```

이 특성 덕분에 React 의 `memo`, `useMemo` 가 변경된 필드를 사용하는 컴포넌트만 선택적으로 리렌더링할 수 있습니다.

### Object.freeze 전략

개발 환경(`NODE_ENV !== 'production'`)에서는 스냅샷에 `deepFreeze()` 를 적용하여 불변성을 강제합니다. 프로덕션에서는 no-op으로 처리되어 성능 영향이 없습니다.

```javascript
// 개발 환경에서 스냅샷 직접 변경 시 즉시 에러
const snap = state.getSnapshot()
snap.name = 'hack'  // TypeError: Cannot assign to read only property 'name'
```

### getSnapshot() / subscribe()

두 메서드는 `useSyncExternalStore` 의 계약 규약을 정확히 만족합니다.

```javascript
// getSnapshot() — 변경 없으면 동일 참조 반환 (무한 루프 방지)
const snap1 = state.getSnapshot()
const snap2 = state.getSnapshot()  // 변경 없음
console.log(snap1 === snap2)  // true

// subscribe() — 리스너 등록, 구독 해제 함수 반환
const unsubscribe = state.subscribe(() => {
    console.log('변경 감지:', state.getSnapshot())
})
unsubscribe()  // 구독 해제
```

React 컴포넌트와 연동하려면 [React 어댑터 가이드](/guide/react-adapter)를 참고하세요.

---

## Microtask Batching — 디버그 채널 최적화

동일한 동기 블록에서 여러 필드를 연속으로 변경할 때, 매 변경마다 `BroadcastChannel.postMessage()` 를 호출하면 구조화 복제(Structured Clone) 알고리즘이 반복 실행되어 불필요한 직렬화 비용이 발생합니다.

`_scheduleFlush()` 는 `queueMicrotask()` 를 사용하여 동기 블록이 완전히 끝난 후 단 한 번만 `_buildSnapshot()` 과 `_broadcast()` 를 실행합니다.

```text
[동기 블록]
  proxy.name  = 'A'  → onMutate() → _scheduleFlush()
                          _pendingFlush: false → true
                          queueMicrotask(flush) 예약 ──────────┐
  proxy.email = 'B'  → onMutate() → _scheduleFlush()           │
                          _pendingFlush: true → skip           │
  proxy.role  = 'C'  → onMutate() → _scheduleFlush()           │
                          _pendingFlush: true → skip           │
[동기 블록 종료, Call Stack 비워짐]                            │
                                                               │
[Microtask Queue] ←────────────────────────────────────────────┘
  _pendingFlush = false
  _buildSnapshot() → #shadowCache 갱신
  _notifyListeners() → subscribe 리스너 일괄 호출
  if debug: _broadcast()  → postMessage 1회
```

`await` 경계를 넘으면 각 블록이 독립적인 flush를 수행합니다. `await` 이전에 예약된 Microtask가 처리되기 때문입니다.

## 배칭에서 제외되는 두 호출

`_scheduleFlush()` 경로를 거치지 않고 `_broadcast()` 를 직접 호출하는 두 곳이 있습니다.

1. **constructor 초기 `_broadcast()`** — 인스턴스 생성 직후 디버그 패널에 초기 스냅샷을 전송합니다. Proxy 변경이 아닌 초기화 이벤트이므로 즉시 실행이 옳습니다.
2. **`save()` 성공 후 `_broadcast()`** — 서버 동기화 완료를 디버그 패널에 즉시 반영합니다. `await user.save()` 다음 줄이 실행되기 전에 "저장 완료" 상태가 표시되어야 합니다.

## proxyCache와 롤백 후 정합성

`restoreTarget(snapshot.data)` 는 `safeClone()` 으로 생성된 완전히 새로운 객체 참조를 `domainObject` 에 복사합니다. 이 시점에 `proxyCache` WeakMap에는 이전 중첩 객체를 가리키는 오래된 항목이 남습니다.

그러나 이것은 문제가 되지 않습니다. `safeClone()` 은 새로운 객체 참조를 만들므로, 롤백 후 `proxy.address` 에 처음 접근하면 새 `address` 객체가 캐시에 없어 새로운 Proxy가 생성됩니다. 오래된 캐시 항목은 WeakMap 특성에 의해 원본 객체가 GC되면 자동으로 수거됩니다.

<PlaygroundBatching />
