# Interface: NormalizedUrlConfig

## Properties

### basePath

```ts
basePath: string;
```

슬래시 정규화된 공통 경로 접두사 (예: `'/app/api'`, `''`)

***

### host

```ts
host: string;
```

프로토콜 제외 호스트 (예: `'api.example.com'`, `'localhost:8080'`)

***

### protocol

```ts
protocol: string;
```

확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`)
