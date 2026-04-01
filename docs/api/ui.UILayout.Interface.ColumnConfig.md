# Interface: ColumnConfig

## Properties

### readOnly?

```ts
optional readOnly?: boolean;
```

`true`이면 해당 필드를 읽기 전용으로 처리한다.
  `UIComposer`가 이 필드에 대한 `input` 이벤트 리스너를 등록하지 않는다.

***

### required?

```ts
optional required?: boolean;
```

`true`이면 `validate()` 호출 시 빈 값을 invalid로 처리한다.
  해당 요소에 `is-invalid` CSS 클래스가 추가되고 `.invalid-feedback` 요소에 메시지가 표시된다.

***

### selector

```ts
selector: string;
```

해당 필드 데이터를 채울 DOM 요소의 CSS 선택자.
  `<template>` 복제본 내부에서 `querySelector(selector)`로 탐색한다.
  예: `'[data-field="certName"]'`, `'input[name="certName"]'`

***

### sourceKey?

```ts
optional sourceKey?: string;
```

`<select>` 요소의 `<option>`을 채울 `DomainCollection`의 소스 키.
  `bindCollection()` 호출 시 `sources: { [sourceKey]: DomainCollection }` 형태로 주입한다.
  미지정 시 소스 연결 없이 `<select>`를 그대로 유지한다.

***

### sourceLabelField?

```ts
optional sourceLabelField?: string;
```

`sourceKey` 지정 시 `<option>` 텍스트에 사용할 DomainCollection 항목의 필드명.
  기본값 `'name'`.

***

### sourceValueField?

```ts
optional sourceValueField?: string;
```

`sourceKey` 지정 시 `<option value="...">` 에 사용할 DomainCollection 항목의 필드명.
  기본값 `'id'`.
