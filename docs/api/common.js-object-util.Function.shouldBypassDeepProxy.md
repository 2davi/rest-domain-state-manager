# Function: shouldBypassDeepProxy()

```ts
function shouldBypassDeepProxy(prop): boolean;
```

shouldBypassDeepProxy() : Proxy get 트랩에서 deep proxy 진입을 건너뛰어야 하는 프로퍼티인지 판별한다.

건너뛰는 경우:
  - 모든 Symbol 프로퍼티
  - toJSON  : JSON.stringify 동작 보존
  - then    : Promise/thenable 체인 보존
  - valueOf : 암묵적 타입 변환 보존

## Parameters

### prop

`string` \| `symbol`

get 트랩에 전달된 프로퍼티 키

## Returns

`boolean`

true이면 Reflect.get 결과를 그대로 반환해야 함

## See

https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive
