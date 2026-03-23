# Function: broadcastError()

> **broadcastError**(`key`, `error`): `void`

`DomainPipeline`의 `after()` 핸들러 실패를 채널에 broadcast한다.

`DomainPipeline.run()` 내부에서 `after()` 핸들러가 throw할 때 호출된다.
팝업은 이 메시지를 수신하여 해당 탭의 에러 목록에 추가하고 UI를 갱신한다.

채널이 `null`이면 아무 동작도 하지 않는다.

## Parameters

### key

`string`

실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)

### error

`any`

throw된 에러 값 (모든 타입 허용, `String()`으로 직렬화됨)

## Returns

`void`

## Example

```ts
try {
    await handler(state);
} catch (err) {
    broadcastError(key, err); // 팝업에 에러 전파
    if (this._strict) throw err;
}
```
