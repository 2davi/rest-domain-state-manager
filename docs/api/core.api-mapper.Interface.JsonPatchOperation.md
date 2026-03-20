# Interface: JsonPatchOperation

## Properties

### op

> **op**: `"add"` \| `"replace"` \| `"remove"`

RFC 6902 연산 종류

***

### path

> **path**: `string`

JSON Pointer 스타일 경로 (예: `'/name'`, `'/items/0'`)

***

### value?

> `optional` **value?**: `any`

새 값. `op === 'remove'` 시 존재하지 않음.
