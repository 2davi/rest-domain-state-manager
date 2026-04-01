# Function: renderRadioCheckbox()

```ts
function renderRadioCheckbox(
   container, 
   dataArray, 
   config): HTMLInputElement[];
```

radio 또는 checkbox 그룹을 컨테이너 요소에 렌더링한다.

이 함수는 `DomainRenderer.install()` 내부에서 `renderTo()` 구현이
`type: 'radio'` 또는 `type: 'checkbox'`를 만났을 때 위임하여 호출한다.
외부에서 직접 호출하는 것도 가능하다.

## 동작 흐름
1. `prefix`를 `forEach` 바깥에서 한 번 결정 (id 고유성 보장).
2. `dataArray` 각 항목을 순회하며:
   a. wrapper `<div>` 생성 및 스타일/클래스 적용
   b. `<input>` 생성 및 `type` / `id` / `name` / `value` / 스타일/클래스/이벤트 적용
   c. `<label>` 생성 및 `for` / 텍스트 / 스타일/클래스 적용
   d. wrapper → input, label 순서로 자식 추가 후 container에 삽입
3. 생성된 `input` 요소 배열 반환

## Parameters

### container

`HTMLElement`

렌더링 결과를 삽입할 컨테이너 DOM 요소.
                                          `DomainRenderer.renderTo()`가 이미 빈 상태로 전달한다.

### dataArray

`Record`\<`string`, `any`\>[]

`DomainState._getTarget()`의 배열 데이터.
                                          각 항목은 `valueField` / `labelField` 키를 포함해야 한다.

### config

[`RadioCheckboxConfig`](plugins.domain-renderer.renderers.radio-checkbox.renderer.Interface.RadioCheckboxConfig.md)

렌더링 설정 옵션

## Returns

`HTMLInputElement`[]

생성된 `<input>` 요소 배열. 인덱스는 `dataArray`와 일치한다.

## Examples

```ts
import { renderRadioCheckbox } from './radio-checkbox.renderer.js';

renderRadioCheckbox(container, rolesData, {
    type:           'radio',
    valueField:     'roleId',
    labelField:     'roleName',
    containerClass: 'form-check',
    class:          'form-check-input',
    labelClass:     'form-check-label',
    events: {
        change: (e) => console.log('선택된 역할:', e.target.value),
    },
});
```

```ts
renderRadioCheckbox(container, permissionsData, {
    type:           'checkbox',
    valueField:     'permCode',
    labelField:     'permName',
    containerClass: 'form-check form-check-inline',
    class:          'form-check-input',
    labelClass:     'form-check-label',
});
```

```ts
renderRadioCheckbox(container, statusData, {
    type:       'radio',
    valueField: 'code',
    labelField: 'label',
    // input은 시각적으로 숨김
    css: { position: 'absolute', clip: 'rect(0,0,0,0)', width: '1px', height: '1px' },
    // label을 pill 버튼처럼 꾸밈
    labelCss: {
        display: 'inline-block', padding: '4px 12px',
        border: '1px solid #adb5bd', borderRadius: '20px', cursor: 'pointer',
    },
    events: {
        change: (e) => {
            // 체크 상태에 따라 label 스타일 전환
            const label = e.target.nextElementSibling;
            label.style.background = e.target.checked ? '#007acc' : '#fff';
        },
    },
});
```
