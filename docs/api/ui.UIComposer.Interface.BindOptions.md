# Interface: BindOptions

## Properties

### layout

```ts
layout: typeof UILayout;
```

UI 계약 선언 클래스.

***

### mode?

```ts
optional mode?: "edit" | "read";
```

렌더링 모드.
  - `'edit'`: `templateSelector` 사용. 입력 이벤트 리스너 등록.
  - `'read'`: `readonlyTemplateSelector` 사용. 이벤트 리스너 미등록.

***

### selectAllSelector?

```ts
optional selectAllSelector?: string;
```

전체선택 체크박스 CSS 선택자. `bind()` (그리드) 전용.

***

### sources?

```ts
optional sources?: Record<string, DomainCollection>;
```

`<select>` 옵션 채우기용 소스 맵.
  `layout.columns[field].sourceKey`가 이 객체의 키와 매칭된다.
