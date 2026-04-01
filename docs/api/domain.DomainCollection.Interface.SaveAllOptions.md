# Interface: SaveAllOptions

## Properties

### path

```ts
path: string;
```

엔드포인트 경로 (예: `'/api/certificates'`).
  `saveAll()`에서 `handler._fetch()`를 직접 호출하므로 경로가 필수다.

***

### strategy

```ts
strategy: "batch";
```

저장 전략. 현재는 `'batch'`만 지원한다.
  - `'batch'`: 배열 전체를 단일 HTTP 요청으로 전송한다.
    SI 레거시 환경에서 DELETE ALL + INSERT 또는 MERGE 방식의 백엔드와 호환된다.

***

### urlConfig?

```ts
optional urlConfig?: UrlConfig;
```

이 요청에만 적용할 URL 설정 오버라이드.
