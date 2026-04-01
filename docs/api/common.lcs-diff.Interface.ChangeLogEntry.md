# Interface: ChangeLogEntry

## Properties

### newValue?

```ts
optional newValue?: any;
```

새 값. `op === 'remove'` 시 존재하지 않음.

***

### oldValue?

```ts
optional oldValue?: any;
```

이전 값. `op === 'add'` 시 존재하지 않음.

***

### op

```ts
op: "add" | "replace" | "remove";
```

RFC 6902 연산 종류

***

### path

```ts
path: string;
```

JSON Pointer 경로 (예: `/name`, `/items/0`)
