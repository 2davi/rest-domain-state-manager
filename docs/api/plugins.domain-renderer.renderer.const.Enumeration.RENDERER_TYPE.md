# Enumeration: RENDERER\_TYPE

`renderTo()`가 지원하는 DOM 요소 타입 식별자 상수.

`DomainRenderer.install()` 내부에서 다음 두 가지 목적으로 사용된다.
1. `config.type` 유효성 검증 (`Object.values(RENDERER_TYPE).includes(type)`)
2. `switch` 분기로 타입별 렌더러 함수(`renderSelect`, `renderRadioCheckbox`, `renderButton`) 위임

## Examples

```ts
if (!Object.values(RENDERER_TYPE).includes(config.type)) {
    throw new Error(`지원하지 않는 type: ${config.type}`);
}
```

```ts
switch (config.type) {
    case RENDERER_TYPE.SELECT:   return renderSelect(...);
    case RENDERER_TYPE.RADIO:
    case RENDERER_TYPE.CHECKBOX: return renderRadioCheckbox(...);
    case RENDERER_TYPE.BUTTON:   return renderButton(...);
}
```

## Enumeration Members

### BUTTON

> **BUTTON**: `"button"`

`<button>` 그룹 렌더러를 사용한다.

***

### CHECKBOX

> **CHECKBOX**: `"checkbox"`

`<input type="checkbox">` 그룹 렌더러를 사용한다.

***

### RADIO

> **RADIO**: `"radio"`

`<input type="radio">` 그룹 렌더러를 사용한다.

***

### SELECT

> **SELECT**: `"select"`

`<select>` 드롭다운 렌더러를 사용한다.
