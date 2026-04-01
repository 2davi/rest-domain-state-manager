# Function: requestDiff()

```ts
function requestDiff(
   target, 
   initial, 
itemKey?): Promise<ChangeLogEntry[]>;
```

두 도메인 객체를 비교하여 RFC 6902 형식의 changeLog 배열을 반환한다.

## 브라우저 환경 (Worker 지원)
`diff.worker.js`에 diff 연산을 오프로딩하여 메인 스레드를 블로킹하지 않는다.
동시 요청이 여러 개여도 각 요청은 고유한 ID로 독립적으로 처리된다.

## Node.js / Vitest 환경 (Worker 미지원)
`deepDiff()`를 동기적으로 직접 호출한다.
비동기 Promise로 감싸 반환하므로 호출 코드(await)가 동일하게 동작한다.
테스트에서 Worker 없이 동일한 비즈니스 로직을 검증할 수 있다.

## 오프로딩 안전성
`DomainState.save()` 호출 시 이미 `#snapshot`이 동기 캡처된 이후에
이 함수가 호출된다. diff 연산 중 소비자가 데이터를 변경해도,
`lazy` 모드의 Proxy `set` 트랩은 changeLog 기록을 건너뛰므로
타이밍 충돌이 발생하지 않는다.

## Parameters

### target

`object`

현재 도메인 객체 (`_getTarget()` 결과)

### initial

`object`

초기 상태 스냅샷 (`_initialSnapshot`)

### itemKey?

`string`

배열 항목 동일성 기준 필드명.
                                        미지정 시 positional fallback.

## Returns

`Promise`\<[`ChangeLogEntry`](workers.diff-worker-client.Interface.ChangeLogEntry.md)[]\>

RFC 6902 형식의 변경 이력 배열.
  변경이 없으면 빈 배열 `[]`로 resolve된다.

## Throws

Worker 에러 또는 JSON 처리 실패 시 reject된다.

## Examples

```ts
const diffResult = await requestDiff(
    this._getTarget(),
    this._initialSnapshot,
    this._lazyItemKey  // undefined이면 positional
);
// diffResult: ChangeLogEntry[]
```

```ts
const initial = { name: 'Davi', email: 'davi@example.com' };
const current = { name: 'Lee',  email: 'davi@example.com' };
const log = await requestDiff(current, initial);
// [{ op: 'replace', path: '/name', oldValue: 'Davi', newValue: 'Lee' }]
```
