# Interface: DsErrorMessage

## Properties

### error

```ts
error: string;
```

`String(error)` 직렬화된 에러 메시지

***

### key

```ts
key: string;
```

실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)

***

### tabId

```ts
tabId: string;
```

전송 탭의 고유 ID

***

### tabUrl

```ts
tabUrl: string;
```

전송 탭의 현재 URL

***

### type

```ts
type: "DS_ERROR";
```

메시지 타입
