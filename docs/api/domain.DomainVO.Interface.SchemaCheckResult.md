# Interface: SchemaCheckResult

## Properties

### extraKeys

```ts
extraKeys: string[];
```

응답 데이터에 있지만 VO에 선언되지 않은 키 목록

***

### missingKeys

```ts
missingKeys: string[];
```

VO에 선언됐지만 응답 데이터에 없는 키 목록

***

### valid

```ts
valid: boolean;
```

`missingKeys`가 없으면 `true` (extraKeys는 valid에 영향 없음)
