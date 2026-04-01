# Function: deepDiff()

```ts
function deepDiff(
   initial, 
   current, 
   itemKey?): ChangeLogEntry[];
```

두 도메인 객체를 깊이 비교하여 RFC 6902 형식의 `changeLog` 배열을 반환한다.

`DomainState`의 `lazy` tracking mode에서 `save()` 호출 시
`_initialSnapshot`(초기 상태)과 `_getTarget()`(현재 상태)을 비교할 때 사용된다.

## 배열 비교 전략
- `itemKey` 지정 시: LCS 알고리즘 (항목 동일성 = itemKey 필드값 일치)
- `itemKey` 미지정 시: positional 비교 (위치 기반)

## 경고: `initial` 또는 `current`가 null/undefined인 경우
최상위 수준에서는 null/undefined를 빈 객체로 안전하게 처리한다.
단, VO 레이어에서는 DomainState 생성 시 항상 유효한 객체가 보장되어야 한다.

## Parameters

### initial

`object`

이전 상태 (예: `_initialSnapshot`)

### current

`object`

현재 상태 (예: `_getTarget()`)

### itemKey?

`string`

배열 항목 동일성 기준 필드명.
                                        `UILayout.static itemKey` 또는 `fromJSON()` options에서 주입.
                                        미지정 시 positional fallback.

## Returns

[`ChangeLogEntry`](common.lcs-diff.Interface.ChangeLogEntry.md)[]

RFC 6902 형식의 변경 이력 배열.
  변경이 없으면 빈 배열 `[]`을 반환한다.

## Examples

```ts
const initial = { name: 'Davi', email: 'davi@example.com' };
const current = { name: 'Lee',  email: 'davi@example.com' };
deepDiff(initial, current);
// → [{ op: 'replace', path: '/name', oldValue: 'Davi', newValue: 'Lee' }]
```

```ts
const initial = { tags: ['A', 'B', 'C'] };
const current = { tags: ['A', 'X', 'C'] };
deepDiff(initial, current);
// → [{ op: 'replace', path: '/tags/1', oldValue: 'B', newValue: 'X' }]
```

```ts
const initial = { items: [{ id: 1, v: 'A' }, { id: 2, v: 'B' }] };
const current = { items: [{ id: 2, v: 'B' }, { id: 3, v: 'C' }] };
deepDiff(initial, current, 'id');
// → [
//   { op: 'remove', path: '/items/0', oldValue: { id: 1, v: 'A' } },
//   { op: 'add',    path: '/items/-', newValue: { id: 3, v: 'C' } },
// ]
```
