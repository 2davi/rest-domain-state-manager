# Enumeration: TRACK\_EVENT

폼 요소의 값 변경을 추적할 때 사용하는 DOM 이벤트 전략 분류 상수.

`FormBinder.js`의 `_bindFormEvents()` 함수에서
요소 타입에 따라 어떤 이벤트로 Proxy를 갱신할지 결정하는 데 참조된다.

## 전략 분류 이유

- **TEXT 계열** (`input[type=text]`, `textarea` 등):
  타이핑 중(`input` 이벤트)마다 Proxy를 갱신하면 V8 JIT 최적화에 부정적인 영향을 준다.
  `blur` (포커스를 잃는 시점)에 한 번만 갱신하는 것이 성능상 유리하다.

- **SELECT 계열** (`select`, `radio`, `checkbox`):
  사용자가 선택하는 즉시 값이 확정되므로 `change` 이벤트로 즉시 반영한다.

## Example

```ts
const event = TEXT_LIKE_TYPES.has(el.type) ? TRACK_EVENT.TEXT : TRACK_EVENT.SELECT;
el.addEventListener(event, handler);
```

## Enumeration Members

### SELECT

> **SELECT**: `"change"`

select 계열 요소 추적 이벤트.
`select`, `input[type=radio|checkbox]` 에 적용된다.
`change` — 선택이 확정되는 즉시 기록.

***

### TEXT

> **TEXT**: `"blur"`

텍스트 계열 input 추적 이벤트.
`input[type=text|email|password|...]`, `textarea` 에 적용된다.
`blur` — 포커스를 잃는 시점에 1회 기록.
