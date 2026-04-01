# Interface: RadioCheckboxConfig

## Properties

### class?

```ts
optional class?: string;
```

각 `input` 요소에 적용할 `className`.
  Bootstrap의 경우 `'form-check-input'`.

***

### containerClass?

```ts
optional containerClass?: string;
```

각 항목을 감싸는 wrapper `div`에 적용할 `className`.
  Bootstrap의 경우 `'form-check'` 또는 `'form-check form-check-inline'`.

***

### containerCss?

```ts
optional containerCss?: Partial<CSSStyleDeclaration>;
```

각 항목 wrapper `div`에 적용할 inline style 객체 (camelCase 키).

***

### css?

```ts
optional css?: Partial<CSSStyleDeclaration>;
```

각 `input` 요소에 적용할 inline style 객체 (camelCase 키).

***

### events?

```ts
optional events?: Record<string, EventListener>;
```

각 `input` 요소에 바인딩할 이벤트 핸들러 맵.
  키: 이벤트명 (예: `'change'`), 값: 핸들러 함수.
  radio / checkbox는 `change` 이벤트 사용을 권장한다.

***

### labelClass?

```ts
optional labelClass?: string;
```

각 `label` 요소에 적용할 `className`.
  Bootstrap의 경우 `'form-check-label'`.

***

### labelCss?

```ts
optional labelCss?: Partial<CSSStyleDeclaration>;
```

각 `label` 요소에 적용할 inline style 객체 (camelCase 키).

***

### labelField

```ts
labelField: string;
```

각 항목에서 `label` 텍스트로 사용할 데이터 필드명.

***

### name?

```ts
optional name?: string;
```

`input[name]` 속성값을 명시적으로 지정할 때 사용한다.
  미입력 시 `valueField` 값이 자동으로 사용된다.
  MyBatis form submit 시 필드명과 자동으로 일치시키려면 미입력으로 두는 것이 권장된다.

***

### type

```ts
type: "radio" | "checkbox";
```

렌더링할 `input` 요소의 타입.

***

### valueField

```ts
valueField: string;
```

각 항목에서 `input[value]` 속성 값으로 사용할 데이터 필드명.
  `config.name` 미입력 시 `input[name]`의 기본값으로도 사용된다.
