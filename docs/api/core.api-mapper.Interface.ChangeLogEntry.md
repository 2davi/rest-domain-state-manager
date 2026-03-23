# Interface: ChangeLogEntry

## Properties

### newValue?

> `optional` **newValue?**: `any`

새 값. `op: 'remove'` 시 존재하지 않음.

***

### oldValue?

> `optional` **oldValue?**: `any`

이전 값. `op: 'add'` 시 존재하지 않음.

***

### op

> **op**: `"add"` \| `"replace"` \| `"remove"`

RFC 6902 연산 종류

***

### path

> **path**: `string`

JSON Pointer 스타일 경로 (예: `/address/city`, `/items/0`)
