# Interface: ButtonConfig

## Properties

### class?

> `optional` **class?**: `string`

각 `<button>` 요소에 적용할 `className`.
  Bootstrap 예: `'btn btn-sm btn-outline-primary'`

***

### css?

> `optional` **css?**: `Partial`\<`CSSStyleDeclaration`\>

각 `<button>` 요소에 적용할 inline style 객체 (camelCase 키).
  예: `{ margin: '2px', borderRadius: '20px' }`

***

### events?

> `optional` **events?**: `Record`\<`string`, `EventListener`\>

각 `<button>` 요소에 바인딩할 이벤트 핸들러 맵.
  키: 이벤트명 (예: `'click'`, `'mouseenter'`), 값: 핸들러 함수.
  값이 함수가 아닌 항목은 자동으로 무시된다.

***

### labelField

> **labelField**: `string`

각 항목에서 버튼 텍스트(`textContent`)로 사용할 데이터 필드명.

***

### type

> **type**: `"button"`

렌더러 타입 식별자. `DomainRenderer`에서 위임 판별에 사용.

***

### valueField

> **valueField**: `string`

각 항목에서 `button[data-value]` 속성 값으로 사용할 데이터 필드명.
  클릭 핸들러에서 `e.target.dataset.value`로 읽는다.
