# Function: renderButton()

> **renderButton**(`container`, `dataArray`, `config`): `HTMLButtonElement`[]

`<button>` 그룹을 컨테이너 요소에 렌더링한다.

`DomainRenderer.install()` 내부에서 `renderTo()` 구현이
`type: 'button'`을 만났을 때 위임하여 호출한다.
외부에서 직접 호출하는 것도 가능하다.

## 동작 흐름
1. `dataArray`의 각 항목을 `Array.prototype.map()`으로 순회한다.
2. 각 항목에 대해:
   a. `<button>` 생성 및 `type="button"` 고정
   b. `data-value` 속성에 `item[valueField]` 주입
   c. `textContent`에 `item[labelField]` 주입
   d. `className` / inline style / 이벤트 핸들러 적용
   e. `container`에 `appendChild`
3. 생성된 `<button>` 요소 배열 반환

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

[`ButtonConfig`](plugins.domain-renderer.renderers.button.renderer.Interface.ButtonConfig.md)

렌더링 설정 옵션

## Returns

`HTMLButtonElement`[]

생성된 `<button>` 요소 배열. 인덱스는 `dataArray`와 일치한다.

## Examples

```ts
import { renderButton } from './button.renderer.js';

renderButton(container, rolesData, {
    type:       'button',
    valueField: 'roleId',
    labelField: 'roleName',
    class:      'btn btn-sm btn-outline-secondary',
    events: {
        click: (e) => {
            console.log('선택된 roleId:', e.target.dataset.value);
        },
    },
});
```

```ts
renderButton(container, statusData, {
    type:       'button',
    valueField: 'code',
    labelField: 'label',
    css: {
        padding:      '6px 16px',
        border:       'none',
        borderRadius: '20px',
        background:   'linear-gradient(135deg, #007acc, #00b4d8)',
        color:        '#fff',
        cursor:       'pointer',
    },
    events: {
        click:      (e) => console.log(e.target.dataset.value),
        mouseenter: (e) => e.target.style.opacity = '0.85',
        mouseleave: (e) => e.target.style.opacity = '1',
    },
});
```

```ts
renderButton(container, actionsData, {
    type:       'button',
    valueField: 'actionId',
    labelField: 'actionName',
    events: {
        click: (e) => {
            // data-value에는 item[valueField] 값이 문자열로 저장되어 있다
            const actionId = e.target.dataset.value;
            performAction(actionId);
        },
    },
});
```
