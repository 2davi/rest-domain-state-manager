# Interface: CollectionBinderOptions

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

***

### selectAllSelector?

```ts
optional selectAllSelector?: string;
```

그리드 외부의 "전체선택" 체크박스 CSS 선택자.
  지정 시 모든 행 체크 상태 변경 시 자동으로 동기화된다.

***

### sources?

```ts
optional sources?: Record<string, DomainCollection>;
```

`<select>` 요소 채우기용 DomainCollection 소스 맵.
  `layout.columns[field].sourceKey`가 이 객체의 키와 매칭된다.
