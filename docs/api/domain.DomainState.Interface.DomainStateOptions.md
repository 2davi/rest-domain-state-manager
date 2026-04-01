# Interface: DomainStateOptions

## Properties

### debug?

```ts
optional debug?: boolean;
```

`true`이면 `log()` / `openDebugger()` 활성화 및 디버그 채널 연결.

***

### handler?

```ts
optional handler?: ApiHandler | null;
```

`ApiHandler` 인스턴스. `save()` / `remove()` 호출에 필수.

***

### initialSnapshot?

```ts
optional initialSnapshot?: object | null;
```

lazy 모드 diff 기준점.

***

### isNew?

```ts
optional isNew?: boolean;
```

`true`이면 `save()` 시 POST, `false`이면 PATCH/PUT.

***

### label?

```ts
optional label?: string;
```

디버그 팝업에 표시될 식별 레이블. 미입력 시 `ds_{timestamp}` 자동 생성.

***

### lazyItemKey?

```ts
optional lazyItemKey?: string;
```

lazy 모드 LCS 기준 필드명.

***

### trackingMode?

```ts
optional trackingMode?: "realtime" | "lazy";
```

변경 추적 모드.

***

### transformers?

```ts
optional transformers?: TransformerMap;
```

필드별 타입 변환 함수 맵. `DomainVO.getTransformers()` 결과.

***

### urlConfig?

```ts
optional urlConfig?: 
  | NormalizedUrlConfig
  | null;
```

정규화된 URL 설정. 미입력 시 `handler.getUrlConfig()` 폴백.

***

### validators?

```ts
optional validators?: ValidatorMap;
```

필드별 유효성 검사 함수 맵. `DomainVO.getValidators()` 결과.
