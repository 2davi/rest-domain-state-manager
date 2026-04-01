# Function: renderSelect()

```ts
function renderSelect(
   container, 
   dataArray, 
   config): HTMLSelectElement;
```

`<select>` 드롭다운 요소를 생성하고 컨테이너에 추가한다.

`DomainRenderer.install()` 내부에서 `renderTo()` 구현이
`type: 'select'`를 만났을 때 위임하여 호출한다.
외부에서 직접 호출하는 것도 가능하다.

## 동작 흐름
1. `<select>` 요소 생성 및 `name` / `multiple` / `className` / inline style 적용.
2. `placeholder`가 있으면 첫 번째 `<option>`으로 추가 (`disabled selected hidden`).
3. `dataArray`를 순회하며 각 항목에 대해 `<option>` 생성 및 추가.
4. 이벤트 핸들러 바인딩.
5. `container`에 `<select>` 추가 후 반환.

`valueField` / `labelField`에 해당하는 값이 없으면 빈 문자열(`''`)을 대신 사용한다.

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

[`SelectConfig`](plugins.domain-renderer.renderers.select.renderer.Interface.SelectConfig.md)

렌더링 설정 옵션

## Returns

`HTMLSelectElement`

생성되어 컨테이너에 추가된 `<select>` 요소

## Examples

```ts
import { renderSelect } from './select.renderer.js';

renderSelect(container, rolesData, {
    type:        'select',
    valueField:  'roleId',
    labelField:  'roleName',
    class:       'form-select',
    placeholder: '역할을 선택하세요',
    events: {
        change: (e) => console.log('선택된 값:', e.target.value),
    },
});
```

```ts
renderSelect(container, statusData, {
    type:       'select',
    valueField: 'code',
    labelField: 'label',
    class:      'form-select form-select-sm',
});
```

```ts
renderSelect(container, permissionsData, {
    type:       'select',
    valueField: 'permCode',
    labelField: 'permName',
    class:      'form-select',
    multiple:   true,
});
```

```ts
renderSelect(container, rolesData, {
    type:        'select',
    valueField:  'roleId',
    labelField:  'roleName',
    css: {
        width:           '100%',
        backgroundColor: '#1e1e1e',
        color:           '#9cdcfe',
        border:          '1px solid #007acc',
        borderRadius:    '4px',
        padding:         '6px 8px',
    },
    placeholder: '역할 선택',
});
```
