# Function: terminateDiffWorker()

```ts
function terminateDiffWorker(): void;
```

Lazy Singleton Worker를 종료하고 모든 대기 중인 Promise를 reject한다.

테스트 환경에서 Worker를 명시적으로 정리하거나,
애플리케이션 종료 시 Worker 생명주기를 완전히 관리할 때 사용한다.

Worker 없이 동작하는 환경(Node.js)에서는 no-op이다.

## Returns

`void`

## Example

```ts
afterEach(() => {
    terminateDiffWorker();
});
```
