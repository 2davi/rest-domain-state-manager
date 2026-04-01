# Interface: HttpError

## Properties

### body

```ts
body: string;
```

응답 본문 텍스트 (서버가 내려준 에러 메시지 포함)

***

### status

```ts
status: number;
```

HTTP 상태 코드 (예: `404`, `500`)

***

### statusText

```ts
statusText: string;
```

HTTP 상태 텍스트 (예: `'Not Found'`)
