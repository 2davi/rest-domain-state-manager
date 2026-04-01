# Interface: ChangeLogEntry

## Properties

### newValue?

```ts
optional newValue?: any;
```

새 값

***

### oldValue?

```ts
optional oldValue?: any;
```

이전 값

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

JSON Pointer 경로
