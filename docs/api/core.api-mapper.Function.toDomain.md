# Function: toDomain()

```ts
function toDomain(
   jsonText, 
   onMutate?, 
   trackingMode?): ProxyWrapper;
```

REST API GET 응답 JSON 문자열을 Proxy 래퍼 객체(도개교 세트)로 역직렬화한다.

내부 처리 흐름:
```
jsonText (string)
  ↓ JSON.parse()
순수 JS 객체 (object)
  ↓ createProxy(parsedObject, onMutate)
ProxyWrapper { proxy, getChangeLog, getTarget, clearChangeLog }
```

`onMutate` 콜백은 `DomainState.fromJSON()` / `fromVO()`에서 클로저 패턴으로 주입된다.
Proxy 변경이 발생할 때마다 콜백이 실행되어 디버그 채널에 상태를 실시간 전파한다.

## Parameters

### jsonText

`string`

GET 응답 JSON 문자열

### onMutate?

  \| [`OnMutateCallback`](core.api-mapper.TypeAlias.OnMutateCallback.md)
  \| `null`

Proxy 변경 시 호출되는 콜백.

### trackingMode?

`"realtime"` \| `"lazy"`

변경 추적 모드.

## Returns

[`ProxyWrapper`](core.api-mapper.Interface.ProxyWrapper.md)

Proxy 래퍼 도개교 세트 (`proxy`, `getChangeLog`, `getTarget`, `clearChangeLog`)

## Throws

`jsonText`가 유효하지 않은 JSON일 때

## Examples

```ts
// ApiHandler.get() → this._fetch() → response.text() → DomainState.fromJSON(text, ...)
// DomainState.fromJSON() 내부:
const wrapper = toDomain(jsonText, () => {
    if (state?._debug) state._broadcast();
});
// wrapper.proxy → DomainState.data 로 노출됨
```

```ts
const wrapper = toDomain('{"name":"Davi","age":30}');
wrapper.proxy.name = 'Lee'; // changeLog: [{ op: 'replace', path: '/name', ... }]
console.log(wrapper.getChangeLog());
```
