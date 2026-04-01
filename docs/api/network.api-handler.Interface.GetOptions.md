# Interface: GetOptions

## Properties

### strict?

```ts
optional strict?: boolean;
```

`true`이면 VO 스키마 불일치 시 Error를 throw한다.

***

### urlConfig?

```ts
optional urlConfig?: UrlConfig;
```

이 요청에만 적용할 URL 설정 오버라이드.

***

### vo?

```ts
optional vo?: DomainVO;
```

스키마 검증 및 변환기 주입용 DomainVO 인스턴스.
