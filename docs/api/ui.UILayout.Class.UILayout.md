# Class: UILayout

`UILayout.static columns`의 전체 선언 형태.
키는 `DomainState.data`의 필드명, 값은 `ColumnConfig` 객체다.

## Constructors

### Constructor

```ts
new UILayout(): UILayout;
```

#### Returns

`UILayout`

## Properties

### columns

```ts
static columns: ColumnsSchema = {};
```

필드명 → DOM 매핑 선언.
키는 `DomainState.data`의 필드명, 값은 `ColumnConfig` 객체다.

***

### itemKey

```ts
static itemKey: string | undefined = undefined;
```

`lazy` tracking mode diff 연산의 배열 항목 동일성 기준 필드명.

`DomainState.fromJSON()` / `DomainCollection.fromJSONArray()`의
`itemKey` 옵션으로 전달된다.
미선언 시 positional fallback이 적용된다.

***

### readonlyTemplateSelector

```ts
static readonlyTemplateSelector: string | undefined = undefined;
```

읽기 전용 모드 `<template>` 요소의 CSS 선택자.

`mode: 'read'`로 호출 시 이 템플릿을 복제한다.
미선언 시 `mode: 'read'`로 `bind()` / `bindCollection()`을 호출하면 즉시 에러를 throw한다.
조용히 잘못된 레이아웃을 렌더링하는 Silent Failure를 허용하지 않는다.

***

### templateSelector

```ts
static templateSelector: string | undefined = undefined;
```

편집 모드 `<template>` 요소의 CSS 선택자.

`mode: 'edit'`(기본) 또는 `mode`가 지정되지 않을 때 이 템플릿을 복제한다.
서브클래스에서 반드시 선언해야 한다. 미선언 시 `bind()` / `bindCollection()` 호출에서 에러.

## Methods

### cloneRow()

```ts
static cloneRow(template): Element;
```

`<template>` 콘텐츠를 복제하여 첫 번째 자식 요소를 반환한다.

`document.importNode(template.content, true)`로 깊은 복제를 수행한다.
복제된 프래그먼트의 첫 번째 `Element`를 행(row) 요소로 반환한다.

#### Parameters

##### template

`HTMLTemplateElement`

복제할 `<template>` 요소

#### Returns

`Element`

복제된 첫 번째 자식 요소

#### Throws

템플릿에 자식 요소가 없는 경우

***

### getTemplate()

```ts
static getTemplate(mode?): HTMLTemplateElement;
```

지정된 모드에 맞는 `<template>` 요소를 반환한다.

- `mode: 'edit'` (기본): `static templateSelector`로 탐색
- `mode: 'read'`: `static readonlyTemplateSelector`로 탐색

탐색 실패 시 즉시 명확한 에러를 throw한다.

#### Parameters

##### mode?

`"edit"` \| `"read"`

렌더링 모드

#### Returns

`HTMLTemplateElement`

탐색된 `<template>` 요소

#### Throws

selector가 선언되지 않은 경우

#### Throws

selector로 DOM 요소를 찾지 못한 경우

#### Throws

찾은 요소가 `<template>`이 아닌 경우
