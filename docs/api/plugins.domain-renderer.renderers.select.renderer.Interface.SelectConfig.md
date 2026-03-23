# Interface: SelectConfig

## Properties

### class?

> `optional` **class?**: `string`

`<select>` 요소에 적용할 `className`.
  Bootstrap 예: `'form-select'`, `'form-select-sm'`

***

### css?

> `optional` **css?**: `Partial`\<`CSSStyleDeclaration`\>

`<select>` 요소에 적용할 inline style 객체 (camelCase 키).
  예: `{ width: '200px', backgroundColor: '#1e1e1e' }`

***

### events?

> `optional` **events?**: `Record`\<`string`, `EventListener`\>

`<select>` 요소에 바인딩할 이벤트 핸들러 맵.
  키: 이벤트명 (예: `'change'`), 값: 핸들러 함수.
  값이 함수가 아닌 항목은 자동으로 무시된다.

***

### labelField

> **labelField**: `string`

각 항목에서 `option` 표시 텍스트(`textContent`)로 사용할 데이터 필드명.

***

### multiple?

> `optional` **multiple?**: `boolean`

`true`이면 `<select multiple>` 다중 선택을 활성화한다.

***

### placeholder?

> `optional` **placeholder?**: `string`

첫 번째 비활성(`disabled selected hidden`) `<option>`의 텍스트.
  미입력 시 placeholder option 자체가 생성되지 않는다.
  예: `'역할을 선택하세요'`

***

### type

> **type**: `"select"`

렌더러 타입 식별자. `DomainRenderer`에서 위임 판별에 사용.

***

### valueField

> **valueField**: `string`

각 항목에서 `option[value]` 속성 값으로 사용할 데이터 필드명.
  `select[name]`의 기본값으로도 사용되어 MyBatis form submit 자동 매핑이 가능하다.
