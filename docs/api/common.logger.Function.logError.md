# Function: logError()

```ts
function logError(message): void;
```

환경 무관하게 `console.error`를 발화한다. `silent: true`이면 억제된다.

Missing Keys 감지처럼 기능 이상을 의미하는 오류에 사용한다.
소비자가 명시적으로 `silent: true`를 설정한 경우에만 억제되며,
그 외에는 NODE_ENV와 무관하게 항상 출력된다.

## Parameters

### message

`string`

출력할 에러 메시지

## Returns

`void`
