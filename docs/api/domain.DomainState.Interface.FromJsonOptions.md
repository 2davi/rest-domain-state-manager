# Interface: FromJsonOptions

## Properties

### debug?

```ts
optional debug?: boolean;
```

디버그 모드 활성화.

***

### itemKey?

```ts
optional itemKey?: string;
```

배열 항목 동일성 기준 필드명. `trackingMode: 'lazy'`일 때 LCS diff에 사용.
  미지정 시 positional 비교. `UILayout.static itemKey`가 v1.4.x에서 이 값을 주입한다.

***

### label?

```ts
optional label?: string | null;
```

디버그 팝업 표시 이름.

***

### strict?

```ts
optional strict?: boolean;
```

`true`이면 스키마 불일치(missingKeys) 시 Error를 throw한다.
                                                        `false`(기본값)이면 콘솔 에러 출력 후 계속 진행한다.

***

### trackingMode?

```ts
optional trackingMode?: "realtime" | "lazy";
```

변경 추적 모드.
  - `'realtime'` (기본): Proxy `set` 트랩 발화마다 changeLog에 즉시 기록.
  - `'lazy'`: 변경 기록 건너뜀. `save()` 시점에 `_initialSnapshot`과 diff 계산.
    서버로 전송되는 PATCH payload가 최종 변경 결과만 포함하여 네트워크 페이로드 최소화.

***

### urlConfig?

```ts
optional urlConfig?: 
  | NormalizedUrlConfig
  | null;
```

URL 설정 오버라이드.

***

### vo?

```ts
optional vo?: DomainVO | null;
```

DomainVO 인스턴스. 스키마 검증 + validators/transformers 주입.
