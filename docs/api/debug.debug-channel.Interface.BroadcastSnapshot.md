# Interface: BroadcastSnapshot

## Properties

### changeLog

```ts
changeLog: ChangeLogEntry[];
```

현재 변경 이력

***

### data

```ts
data: object;
```

`DomainState._getTarget()` 결과

***

### errors

```ts
errors: any[];
```

인스턴스 수준 에러 목록

***

### isNew

```ts
isNew: boolean;
```

신규 리소스 여부
