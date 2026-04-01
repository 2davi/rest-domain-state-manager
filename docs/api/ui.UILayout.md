# ui/UILayout

UILayout — 화면 단위 UI 계약 선언 베이스 클래스

`DomainVO`가 데이터 계약을 선언하듯, `UILayout`은 UI 계약을 선언한다.
동일한 `DomainVO`(또는 `DomainState`)로 여러 화면에서 다른 `UILayout`을 사용할 수 있다.

## 설계 원칙

### HTML `<template>` 기반 — DOM 구조 통제권은 HTML 작성자에게
라이브러리는 `<template>` 요소를 복제하여 데이터를 `selector`로 지정된 요소에 채울 뿐이다.
CSS 클래스, 중첩 구조, Bootstrap/Tailwind 레이아웃에 전혀 관여하지 않는다.

### `UIComposer` 플러그인 미설치 시 에러 throw
`bind()` / `bindCollection()` 호출은 `UIComposer` 플러그인이 설치된 이후에만 동작한다.
미설치 상태에서 호출하면 즉시 명확한 에러를 throw한다.

### `readonlyTemplateSelector` 미선언 + `mode: 'read'` → 즉시 에러
조용히 잘못된 레이아웃을 렌더링하는 Silent Failure를 허용하지 않는다.

## 서브클래스 선언 예시

```js
class CertificateEditLayout extends UILayout {
    static templateSelector         = '#certRowTemplate';
    static readonlyTemplateSelector = '#certRowReadTemplate'; // 선택
    static itemKey  = 'certId';

    static columns = {
        certId:   { selector: '[data-field="certId"]' },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: {
            selector:        '[data-field="certType"]',
            sourceKey:       'certTypes',
            sourceValueField: 'codeId',
            sourceLabelField: 'codeName',
        },
    };
}
```

## See

module:ui/UIComposer UIComposer

## Classes

- [UILayout](ui.UILayout.Class.UILayout.md)

## Interfaces

- [ColumnConfig](ui.UILayout.Interface.ColumnConfig.md)

## Type Aliases

- [ColumnsSchema](ui.UILayout.TypeAlias.ColumnsSchema.md)
