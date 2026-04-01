# ui/collection/CollectionBinder

CollectionBinder — 1:N 그리드 UI 바인딩 엔진 (MVP)

`DomainCollection` 또는 `DomainState` 내부 배열 필드를 HTML `<template>` 기반
그리드 DOM에 바인딩하고, 행(row) 추가/제거/선택/검증 컨트롤 함수를 반환한다.

## 소비자 API
`bindCollection()` 호출이 이 모듈의 `createCollectionBinder()` 팩토리를 내부에서 사용한다.
소비자는 반환된 함수를 destructuring하여 원하는 버튼/이벤트에 직접 연결한다.

```js
const { addEmpty, removeChecked, selectAll, validate } =
    certCollection.bind('#certGrid', { layout: CertLayout, mode: 'edit' });

document.getElementById('btnAdd').onclick    = addEmpty;
document.getElementById('btnRemove').onclick = removeChecked;
```

## 내부 이벤트 위임
개별 행 체크박스(`.dsm-checkbox`) 클릭은 컨테이너에 위임된 단일 이벤트 리스너로 처리한다.
소비자가 직접 바인딩하는 것은 허용하지 않는다.

## Reactive 바인딩
행 내부 `input` / `select` / `textarea` 변경은 즉시 `DomainState.data[field]`에 반영된다.
`lazy` tracking mode에서도 값 자체는 Proxy를 통해 직접 반영되며,
changeLog 기록만 건너뛴다.

## See

 - module:ui/UILayout UILayout
 - module:domain/DomainCollection DomainCollection

## Interfaces

- [CollectionBinderOptions](ui.collection.CollectionBinder.Interface.CollectionBinderOptions.md)
- [CollectionControls](ui.collection.CollectionBinder.Interface.CollectionControls.md)

## Type Aliases

- [DomainCollection](ui.collection.CollectionBinder.TypeAlias.DomainCollection.md)
- [DomainState](ui.collection.CollectionBinder.TypeAlias.DomainState.md)

## Functions

- [createCollectionBinder](ui.collection.CollectionBinder.Function.createCollectionBinder.md)
