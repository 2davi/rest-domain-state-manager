# Interface: DomainCollectionOptions

## Properties

### debug?

```ts
optional debug?: boolean;
```

`true`이면 각 `DomainState` 항목에 `debug: true`가 전파된다.

***

### itemKey?

```ts
optional itemKey?: string;
```

`trackingMode: 'lazy'`일 때 배열 항목 동일성 기준 필드명.
  `UILayout.static itemKey`가 v1.4.x에서 이 값을 사용한다.
  미지정 시 positional 비교.

***

### trackingMode?

```ts
optional trackingMode?: "realtime" | "lazy";
```

각 `DomainState` 항목의 변경 추적 모드.
  `'lazy'`이면 `saveAll()` 시점에 `_initialSnapshot`과 diff 연산을 수행한다.

***

### urlConfig?

```ts
optional urlConfig?: UrlConfig | null;
```

이 컬렉션의 모든 요청에 적용할 URL 설정.
  미입력 시 `handler.getUrlConfig()` 폴백.
