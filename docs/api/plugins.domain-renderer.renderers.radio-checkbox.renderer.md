# plugins/domain-renderer/renderers/radio-checkbox.renderer

radio / checkbox 그룹 렌더러

`DomainState` 배열 데이터를 받아 각 항목마다
`<div.container> <input> <label>` 구조를 생성하여 컨테이너에 추가한다.

## 생성되는 DOM 구조
```html
<!-- 각 데이터 항목 하나당 -->
<div class="{containerClass}" style="{containerCss}">
  <input
    type="{type}"
    id="{prefix}_{inputName}_{idx}"
    name="{inputName}"
    value="{item[valueField]}"
    class="{inputClass}"
    style="{inputCss}"
  />
  <label
    for="{prefix}_{inputName}_{idx}"
    class="{labelClass}"
    style="{labelCss}"
  >
    {item[labelField]}
  </label>
</div>
```

## `input[id]` 고유성 보장 전략
같은 페이지에 radio / checkbox 그룹이 여러 개 렌더링되면
`id` 충돌로 `label[for]` 클릭이 잘못된 input을 가리킬 수 있다.
이를 방지하기 위해 `prefix`를 그룹별로 한 번만 생성한다.

- `container.id` 있음 → `container.id`를 prefix로 사용
- `container.id` 없음 → `dsm_{Date.now()}_{random}`으로 런타임에 유일한 값 생성

prefix는 `forEach` 바깥에서 한 번만 생성하여 같은 그룹 내 모든 항목이 동일한 prefix를 공유한다.

## `name` 속성 결정 규칙
- `config.name` 명시 → 해당 값 사용
- `config.name` 미명시 → `valueField` 값 사용 (MyBatis ResultMap 필드명 자동 일치)

## See

module:plugins/domain-renderer/DomainRenderer DomainRenderer

## Interfaces

- [RadioCheckboxConfig](plugins.domain-renderer.renderers.radio-checkbox.renderer.Interface.RadioCheckboxConfig.md)

## Type Aliases

- [RadioCheckboxItem](plugins.domain-renderer.renderers.radio-checkbox.renderer.TypeAlias.RadioCheckboxItem.md)

## Functions

- [renderRadioCheckbox](plugins.domain-renderer.renderers.radio-checkbox.renderer.Function.renderRadioCheckbox.md)
