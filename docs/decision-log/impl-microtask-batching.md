# IMPL-003 — Microtask 기반 브로드캐스트 배칭

| 항목      | 내용                               |
| --------- | ---------------------------------- |
| 날짜      | 2026-03-20                         |
| 브랜치    | `feature/microtask-batching`       |
| 상위 결정 | [ARD-0001](/decision-log/ard-0001) |
| 상태      | 완료                               |

## 1. 문제 정의

### 1.1 다중 상태 변경 시 과도한 직렬화 비용

`DomainState` 의 세 팩토리 메서드(`fromJSON`, `fromVO`, `fromForm`)는 `createProxy()` 에 `onMutate` 콜백을 전달한다. 기존 구현에서 이 콜백은 `_broadcast()` 를 직접 호출했다.

```javascript
// 기존 onMutate 콜백 패턴
const wrapper = toDomain(jsonText, () => {
    if (state?._debug) state._broadcast();
});
```

`_broadcast()` 는 내부적으로 `BroadcastChannel.postMessage()` 를 호출한다. 이 메서드는 매 호출마다 인자를 Structured Clone Algorithm(구조화 복제 알고리즘)으로 직렬화한다. 동기 블록에서 5개의 필드를 변경하면 DTO 전체가 5번 직렬화된다.

```text
// 기존 동작
proxy.name  = 'A'  → onMutate() → _broadcast() → postMessage(DTO 전체)
proxy.email = 'B'  → onMutate() → _broadcast() → postMessage(DTO 전체)
proxy.role  = 'C'  → onMutate() → _broadcast() → postMessage(DTO 전체)
→ postMessage 3회, 구조화 복제 3회, 디버그 패널 렌더링 3회
```

## 2. 설계 결정

### 2.1 JavaScript 이벤트 루프 활용

Microtask는 **Call Stack이 완전히 비워진 직후, 다음 Task가 실행되기 전**에 처리된다. 이 특성을 이용해 동기 블록 안의 모든 변경을 기다렸다가 마지막에 단 한 번 `_broadcast()` 를 실행할 수 있다.

```text
[Call Stack — 동기 코드]
  proxy.name  = 'A'  → onMutate() → _scheduleFlush() ──────────┐
  proxy.email = 'B'  → onMutate() → _scheduleFlush() (차단)    │ queueMicrotask
  proxy.role  = 'C'  → onMutate() → _scheduleFlush() (차단)    │ 등록
Call Stack 비워짐 ────────────────────────────────────────────────┘

[Microtask Queue]
  flush() → _pendingFlush = false → _broadcast()  (1회만 실행)

[Task Queue — 렌더링, setTimeout ...]
```

### 2.2 `queueMicrotask` vs `Promise.resolve().then()`

두 방법 모두 Microtask Queue에 작업을 등록한다. `queueMicrotask()` 를 선택한 이유는 두 가지다.

**Promise 객체 생성/GC 오버헤드 없음:** `Promise.resolve().then(fn)` 은 매 호출마다 Promise 객체를 힙에 할당한다. 타이핑 이벤트처럼 고빈도로 호출되는 경로에서 이는 불필요한 GC 압력을 만든다.

**명시적 의도 표현:** `queueMicrotask(fn)` 은 "이 함수를 microtask에 직접 예약한다"는 의도를 코드에서 명확히 드러낸다.

### 2.3 `_pendingFlush` 플래그 동작

```javascript
_scheduleFlush() {
    if (this._pendingFlush) return;  // 이미 예약된 경우 차단
    this._pendingFlush = true;

    queueMicrotask(() => {
        // flush 실행 전에 플래그를 먼저 초기화한다.
        // _broadcast() 내부에서 추가 변경이 발생하는 극단적 케이스에서도
        // 다음 flush가 정상적으로 예약될 수 있도록 순서를 보장한다.
        this._pendingFlush = false;
        if (this._debug) this._broadcast();
    });
}
```

### 2.4 배칭에서 제외되는 두 호출 지점

배칭 스케줄러를 거치지 않고 `_broadcast()` 를 직접 호출하는 지점이 두 곳 있다.

**생성자의 마지막 줄:** `if (this._debug) this._broadcast()` — 팩토리 메서드가 인스턴스를 초기화한 직후 디버그 패널에 초기 스냅샷을 전송한다. 이것은 Proxy 변경이 아닌 인스턴스 초기화 이벤트이므로 즉시 실행이 올바르다.

**`save()` 성공 처리 후:** `this._clearChangeLog(); this._clearDirtyFields(); if (this._debug) this._broadcast()` — 서버 동기화 완료 이벤트다. `await user.save()` 다음 줄이 실행되기 전에 디버그 패널에 "저장 완료" 상태가 즉시 반영되어야 한다. microtask로 미루면 이 타이밍 보장이 깨진다.

### 2.5 `await` 경계에서의 동작

`await` 이전에 microtask가 처리되어 flush가 실행되고 `_pendingFlush` 가 `false` 로 초기화된다. `await` 이후의 변경은 별도의 flush가 예약된다. `await` 경계를 넘는 변경들은 논리적으로 다른 "단계"의 작업이므로 별도 flush로 처리하는 것이 올바르다.

## 3. 변경 파일 및 커밋 시퀀스

| 파일                                    | 변경 종류 | 주요 내용                                                                           |
| --------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `src/domain/DomainState.js`             | 수정      | `_pendingFlush: false` 초기화, `_scheduleFlush()` 메서드 추가, `onMutate` 콜백 교체 |
| `src/plugins/form-binder/FormBinder.js` | 수정      | `fromForm()` 의 `onMutate` 콜백 교체                                                |

```text
feat(domain): add microtask-based flush scheduler for broadcast batching
refactor(domain): replace direct _broadcast() with _scheduleFlush() in onMutate closures
```

## 4. 결과 및 검증

**Before:** 동기 블록 내 필드 N개 변경 시 `postMessage` N회, 구조화 복제 N회.

**After:** 동기 블록 내 필드 N개 변경 시 `postMessage` 1회, 구조화 복제 1회.

Vitest 테스트 케이스 TC-DS-010~011에서 검증:

- TC-DS-010: 동기 블록에서 3개 변경 후 microtask 실행 전 `_broadcast` 호출 횟수 = 0, microtask 실행 후 = 1
- TC-DS-011: `await` 경계를 넘는 변경이 각각 별도 flush로 처리됨 확인
