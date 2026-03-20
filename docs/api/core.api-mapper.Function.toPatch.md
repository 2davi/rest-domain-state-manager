# Function: toPatch()

> **toPatch**(`getChangeLogFn`): [`JsonPatchOperation`](core.api-mapper.Interface.JsonPatchOperation.md)[]

`changeLog` 배열을 RFC 6902 JSON Patch 연산 배열로 변환한다.

`getChangeLogFn()`을 호출하여 내부 변경 이력을 읽고,
각 항목의 `newValue`를 RFC 6902 `value` 필드로 매핑한다.

## RFC 6902 §4.2 — remove 연산
`'remove'` 연산 항목은 `value` 필드를 포함하지 **않는다**.
내부 `changeLog`의 `newValue`는 `'remove'`일 때 존재하지 않지만,
명시적으로 `if (op !== OP.REMOVE)` 조건으로 필드 포함 여부를 제어한다.

## 내부 포맷 → RFC 6902 변환 규칙

| changeLog `op` | RFC 6902 `op` | `value` 필드      |
|---------------|--------------|-------------------|
| `'add'`       | `'add'`      | `newValue` 사용   |
| `'replace'`   | `'replace'`  | `newValue` 사용   |
| `'remove'`    | `'remove'`   | 포함하지 않음     |

## 호출 시점
- `DomainState.save()` 에서 `changeLog.length > 0` → PATCH

## Parameters

### getChangeLogFn

() => [`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

`createProxy()`의 반환값에서 꺼낸 `getChangeLog` 함수.
  호출 시 현재 변경 이력의 얕은 복사본을 반환한다.

## Returns

[`JsonPatchOperation`](core.api-mapper.Interface.JsonPatchOperation.md)[]

RFC 6902 JSON Patch 연산 배열
  `Content-Type: application/json-patch+json` 요청 body로 사용 가능.

## See

[RFC 6902 — JavaScript Object Notation (JSON) Patch](https://www.rfc-editor.org/rfc/rfc6902)

## Examples

```ts
// DomainState 내부:
await this._handler._fetch(url, {
    method: 'PATCH',
    body:   JSON.stringify(toPatch(this._getChangeLog)),
});
```

```ts
// changeLog:
// [
//   { op: 'replace', path: '/name',    newValue: 'Davi', oldValue: 'Lee' },
//   { op: 'add',     path: '/phone',   newValue: '010-0000-0000' },
//   { op: 'remove',  path: '/address', oldValue: { city: 'Seoul' } },
// ]
toPatch(getChangeLog);
// → [
//   { op: 'replace', path: '/name',  value: 'Davi' },
//   { op: 'add',     path: '/phone', value: '010-0000-0000' },
//   { op: 'remove',  path: '/address' },   // value 없음
// ]
```
