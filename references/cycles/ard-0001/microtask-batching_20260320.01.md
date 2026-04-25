# Microtask Batching (2026-03-20)

## (a) 코드 구조 현황 진단

### `onMutate` callback이 실행되는 경로

> 세 함수에서의 callback 사용 패턴이 동일하다.

```javascript
// fromJSON (model/DomainState.js)
const wrapper = toDomain(jsonText, () => {
    if (state?._debug) state._broadcast();
});

// fromVO (model/DomainState.js)
const wrapper = createProxy(vo.toSkeleton(), () => {
    if (state?._debug) state._broadcast();
});

// FormBinder.fromForm (plugin/form-binding/FormBinder.js)
const wrapper = createProxy(skeleton, () => {
    if (state?._debug) state._broadcast();
});
```

### `record()` 안에서 `onMutate()`가 호출되는 경로

> e.g., 동기 블록에서 필드 5개를 바꾸면 5번의 `postMessage`를 호출한다.
> `BroadcastChannel.postMessage()`는 호출마다 구조화된 복제 알고리즘(Structured Clone)을 태우고, 이는 DTO를 5번 직렬화하는 과정이다.

---

## (b) `queueMicrotask` 기반 1-tick Batching

> JavaScript Event Loop의 우선순위 구조를 확인한다.
> Microtask는 _Call Stack이 완전히 비워진 직후 && Next Task가 실행되기 전에_ 처리된다.
> 이 구조를 이용해 동기 블록(Microtask Queue) 안에 모든 변경 사항을 쌓아놓고, 마지막에 딱 한 번 `_broadcast()`를 실행시킬 수 있다.

```text
┌─────────────────────────────────────────────┐
│  Call Stack (동기 코드)                     │
│   proxy.name  = 'A'  → record() → onMutate  │
│   proxy.email = 'B'  → record() → onMutate  │
│   proxy.role  = 'C'  → record() → onMutate  │
└────────────────────┬────────────────────────┘
                     │ Call Stack가 비워지면
                     ▼
┌─────────────────────────────────────────────┐
│  Microtask Queue  (Promise, queueMicrotask) │
│   → flush() 실행 → _broadcast() 단 한 번    │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  Task Queue  (setTimeout, I/O, 렌더링)      │
└─────────────────────────────────────────────┘
```

---

## (c) FormBinder Event에서 빠른 타이핑 - Edge Case 검토

> `await` 직전에 microtask를 처리하여 `await` 경계를 넘으면 각각 별도 flush가 실행되도록 의도한다.
> `await` 사이의 변경들은 논리적으로 다른 "단계"에서 발생한 사항으로 Batching 대상이 아니다.

```javascript
/** await 경계를 넘는 경우 */
user.data.name = 'A';    // _pendingFlush: true, microtask 예약
await someAsyncOp();     // ← 여기서 microtask 처리됨, flush 실행, _pendingFlush: false
user.data.email = 'B';   // _pendingFlush: false → 다시 예약
```

- 빠른 타이핑을 연속으로 치면 `input` 이벤트가 연달아 발생한다.
- `input` 이벤트와 함께 매번 `_scheduleFlush()`가 호출되지만,
  - `_pendingFlush: true` 체크로 전부 차단되고,
  - 타이핑이 잠시 멈추면서 Call Stack이 비는 순간 _한 차례의 flush_ 가 실행된다.
- `requestAnimationFrame`과 개념적으로 비슷한 동작을 구현한다. `queueMicrotask`가 더 빠르게 실행됨.

> e.g., Batching 대상에서 제외되는 지점은 크게 두 곳이 있다.

- _생성자의 마지막 줄_
  - `if (this._debug) this._broadcast();`
  - Factory 메소드가 Instance를 만든 직후, 디버그 패널에 초기 스냅샷을 찍어 보내는 로직.
  - Proxy 변경이 아니라 Factory init의 일부로 배칭 대상이 아니라 즉시 실행이 옳다.

- _`save()` 성공 로직 후_
  - `this._clearChangeLog();  this._clearDirtyFields();  if (this._debug) this._broadcast();`
  - 서버 동기화가 완료되었다는 명시적 이벤트 로직.
  - 개발자 코드의 `await user.save()` 다음 줄이 실행되기 전에 디버그 패널 상 "저장 완료" 상태가 반영되어야 한다.

---

## (d) 예상 시나리오

- **Before (현재 코드)**

```text
t=0ms [동기 블록 시작]
  proxy.name  = 'Davi'  → onMutate() → _broadcast() → postMessage(전체 DTO)
  proxy.email = 'a@b'   → onMutate() → _broadcast() → postMessage(전체 DTO)
  proxy.role  = 'admin' → onMutate() → _broadcast() → postMessage(전체 DTO)
t=0ms [동기 블록 종료]
  → postMessage 3회, 구조화된 복제 3회, 디버그 패널 렌더링 3회
```

- **After (계획 반영 후)**

```text
t=0ms [동기 블록 시작]
  proxy.name  = 'Davi'
    → onMutate() → _scheduleFlush()
        _pendingFlush: false → true
        queueMicrotask(flush) 등록 ─────────────────────────────────┐
  proxy.email = 'a@b'                                               │
    → onMutate() → _scheduleFlush()                                 │
        _pendingFlush: true → 건너뜀                                │
  proxy.role  = 'admin'                                             │
    → onMutate() → _scheduleFlush()                                 │
        _pendingFlush: true → 건너뜀                                │
t=0ms [동기 블록 종료, Call Stack 비워짐]                           │
                                                                    │
t=0ms+ [Microtask Queue 처리] ←─────────────────────────────────────┘
  flush()
    _pendingFlush = false
    _broadcast() → postMessage(전체 DTO)
    → postMessage 1회, 구조화된 복제 1회, 디버그 패널 렌더링 1회
```

---

## (e) 계획 수립

### 수정 파일 목록 및 변경 범위

| 파일                              | 변경 종류 | 변경 내용                                                                                       |
| --------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| model/DomainState.js              | **수정**  | constructor에 `_pendingFlush: false` 추가, `_scheduleFlush()` 메서드 추가, `onMutate` 콜백 교체 |
| plugin/form-binding/FormBinder.js | **수정**  | `onMutate` 콜백 교체                                                                            |

### Feature 브랜치명 및 커밋 메시지

- **브랜치명:** `feature/microtask-batching`

- **Commit Sequence:**

```markdown
# 커밋 1 — DomainState: _pendingFlush 플래그 + _scheduleFlush() 메서드
feat(domain): add microtask-based flush scheduler for broadcast batching

  - DomainState constructor에 _pendingFlush: false 초기화 추가
  - _scheduleFlush() 메서드 신규 추가
  - 동일 동기 블록 내 다중 상태 변경을 단일 _broadcast() 호출로 병합
  - queueMicrotask() 선택 이유 및 배칭 제외 케이스 2가지 JSDoc 명시

# 커밋 2 — onMutate 콜백 교체 (핵심 동선 변경)
refactor(domain): replace direct _broadcast() with _scheduleFlush() in onMutate closures

  - fromJSON(), fromVO() onMutate 콜백: _broadcast() → _scheduleFlush()
  - FormBinder.fromForm() onMutate 콜백 동일하게 교체
  - constructor 초기 _broadcast(), save() 완료 후 _broadcast()는 유지
    (배칭 대상 아님 — 각각 초기화 스냅샷, 서버 동기화 완료 이벤트)
  - 세 팩토리의 동작 변경 이유 각 JSDoc에 명시
```
