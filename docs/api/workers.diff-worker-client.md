# workers/diff-worker-client

Diff Worker 클라이언트 — Promise 기반 비동기 인터페이스

`diff.worker.js`와 메인 스레드 사이의 `postMessage` / `onmessage` 통신을
Promise API로 감싸 `DomainState.save()`에서 `await`로 사용할 수 있도록 한다.

## 설계 원칙

### Lazy Singleton 패턴
Worker 인스턴스는 첫 번째 `requestDiff()` 호출 시 단 1회 생성된다.
이후 모든 `requestDiff()` 호출이 동일한 Worker 인스턴스를 재사용한다.
사용하지 않으면 Worker가 생성되지 않아 메모리를 낭비하지 않는다.

### 동시성 안전 (Concurrency Safety)
여러 `DomainState` 인스턴스가 동시에 `save()`를 호출할 수 있다.
각 요청에 고유한 `_requestId`를 부여하고, 응답 수신 시 ID로 매칭한다.
`_pending Map`에서 해당 ID의 Promise를 꺼내 resolve/reject한다.

### Node.js / Vitest 폴백
`typeof Worker === 'undefined'`인 Node.js 환경(Vitest, SSR)에서는
Worker 없이 `deepDiff()`를 **동기적으로** 직접 호출한다.
테스트 격리가 완전하고, 비동기 메시지 대기 없이 동일한 로직을 검증할 수 있다.

### Worker 에러 복구
Worker가 치명적 에러로 종료되면 `_pending` 전체를 reject하고
`_worker = null`로 초기화한다. 다음 `requestDiff()` 호출 시 Worker가 재생성된다.

## See

 - module:workers/diff.worker diff.worker
 - module:common/lcs-diff deepDiff

## Interfaces

- [ChangeLogEntry](workers.diff-worker-client.Interface.ChangeLogEntry.md)

## Functions

- [requestDiff](workers.diff-worker-client.Function.requestDiff.md)
- [terminateDiffWorker](workers.diff-worker-client.Function.terminateDiffWorker.md)
