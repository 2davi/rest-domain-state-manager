# plugins/domain-renderer/renderers/button.renderer

button 그룹 렌더러

`DomainState` 배열 데이터를 받아 각 항목마다 `<button>` 요소를 생성하고
컨테이너에 추가한다.

## 생성되는 DOM 구조
```html
<!-- 각 데이터 항목 하나당 -->
<button
  type="button"
  data-value="{item[valueField]}"
  class="{config.class}"
  style="{config.css}"
>
  {item[labelField]}
</button>
```

## `data-value` 속성
`valueField`에 해당하는 데이터 값이 `button[data-value]` 속성으로 주입된다.
클릭 이벤트 핸들러에서 `e.target.dataset.value`로 값을 읽는다.

## `type="button"` 고정
모든 `<button>` 요소에 `type="button"`을 강제한다.
`<form>` 안에 렌더링될 경우 기본값 `type="submit"`으로 인한 폼 제출을 방지한다.

## See

module:plugins/domain-renderer/DomainRenderer DomainRenderer

## Interfaces

- [ButtonConfig](plugins.domain-renderer.renderers.button.renderer.Interface.ButtonConfig.md)

## Type Aliases

- [ButtonItem](plugins.domain-renderer.renderers.button.renderer.TypeAlias.ButtonItem.md)

## Functions

- [renderButton](plugins.domain-renderer.renderers.button.renderer.Function.renderButton.md)
