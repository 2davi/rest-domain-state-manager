# Function: toPayload()

> **toPayload**(`getTargetFn`): `string`

원본 객체를 POST / PUT 전송용 JSON 문자열로 직렬화한다.

`getTargetFn`을 호출하여 Proxy가 아닌 **원본 객체**를 가져온 뒤
`JSON.stringify()`로 직렬화한다. Proxy 자체를 직렬화하면 정상 동작하지 않는다.

## 호출 시점
- `DomainState.save()` 에서 `isNew === true`                            → POST
- `DomainState.save()` 에서 `dirtyFields.size === 0`                    → PUT (변경 없는 재저장)
- `DomainState.save()` 에서 `dirtyRatio >= DIRTY_THRESHOLD`             → PUT (대량 변경)

## Parameters

### getTargetFn

() => `object`

`createProxy()`의 반환값에서 꺼낸 `getTarget` 함수.
  호출 시 변경이 누적된 원본 객체를 반환한다.

## Returns

`string`

`Content-Type: application/json` 요청 body로 사용 가능한 JSON 문자열

## Examples

```ts
// DomainState 내부:
await this._handler._fetch(url, {
    method: 'POST',
    body:   toPayload(this._getTarget),
});
```

```ts
const { getTarget } = createProxy({ name: 'Davi', address: { city: 'Seoul' } });
toPayload(getTarget); // → '{"name":"Davi","address":{"city":"Seoul"}}'
```
