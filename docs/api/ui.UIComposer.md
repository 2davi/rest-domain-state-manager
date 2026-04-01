# ui/UIComposer

UIComposer — DomainState / DomainCollection UI 바인딩 플러그인

`DomainState.use(UIComposer)` 호출로 설치하면
`DomainState.prototype`에 `bindSingle()` 메서드가,
`DomainCollection.prototype`에 `bind()` 메서드가 추가된다.

## 역할 분리

| 레이어             | 책임                                     |
|--------------------|------------------------------------------|
| `UILayout`         | UI 계약 선언 (templateSelector, columns) |
| `CollectionBinder` | DOM 조작 엔진 (clone, fill, listen)      |
| `UIComposer`       | 플러그인 진입점 — 두 레이어를 연결       |

## 설계 원칙

### FormBinder / DomainRenderer와의 관계
`UIComposer`는 두 플러그인을 **대체**한다.
v1.4.x에서 `FormBinder` / `DomainRenderer`에 `@deprecated` JSDoc이 추가된다.
두 플러그인은 v2.x까지 제거하지 않는다.

### prototype 동적 확장 — TS 2339 억제 전략
`install(DomainStateClass)` 내부에서 `DomainStateClass.prototype`에 메서드를 추가한다.
TypeScript는 install() 이전 DomainState 타입을 알 수 없으므로
`@type {any}` cast로 TS 2339를 억제한다. 런타임에는 정상 동작한다.
`DomainCollection.prototype.bind` 확장도 동일한 이유로 cast를 사용한다.

## 소비자 API

```js
// 1. 플러그인 설치 (앱 진입점에서 1회)
DomainState.use(UIComposer);

// 2. 단일 폼 바인딩 (DomainState)
const { unbind } = userState.bindSingle('#userForm', { layout: UserFormLayout });

// 3. 그리드 바인딩 (DomainCollection)
const { addEmpty, removeChecked, validate } =
    certCollection.bind('#certGrid', {
        layout:  CertLayout,
        mode:    'edit',
        sources: { certTypes: certTypeCollection },
    });
```

## See

 - module:ui/UILayout UILayout
 - module:ui/collection/CollectionBinder CollectionBinder
 - module:domain/DomainState DomainState

## Interfaces

- [BindOptions](ui.UIComposer.Interface.BindOptions.md)
- [BindResult](ui.UIComposer.Interface.BindResult.md)

## Variables

- [UIComposer](ui.UIComposer.Variable.UIComposer.md)
