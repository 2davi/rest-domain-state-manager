# plugins/domain-renderer/renderers/select.renderer

select 드롭다운 렌더러

`DomainState` 배열 데이터를 받아 `<select>` 요소와
그 안의 `<option>` 요소들을 생성하여 컨테이너에 추가한다.

## 생성되는 DOM 구조
```html
<select name="{valueField}" class="{config.class}" style="{config.css}">
  <!-- placeholder가 있는 경우 -->
  <option value="" disabled selected hidden>{placeholder}</option>
  <!-- 데이터 항목마다 -->
  <option value="{item[valueField]}">{item[labelField]}</option>
  <option value="{item[valueField]}">{item[labelField]}</option>
  ...
</select>
```

## `select[name]` — MyBatis 자동 매핑
생성된 `<select>` 요소의 `name` 속성은 `valueField` 값으로 자동 설정된다.
MyBatis ResultMap의 필드명과 일치시켜 form submit 시 별도 매핑 없이 자동으로 처리된다.

## `placeholder` 옵션
`placeholder`를 지정하면 첫 번째 `<option>`으로 추가되며
`disabled selected hidden` 속성이 적용되어 선택 안내 역할만 한다.
선택 후에는 드롭다운에 나타나지 않는다.

## See

module:plugins/domain-renderer/DomainRenderer DomainRenderer

## Interfaces

- [SelectConfig](plugins.domain-renderer.renderers.select.renderer.Interface.SelectConfig.md)

## Type Aliases

- [SelectItem](plugins.domain-renderer.renderers.select.renderer.TypeAlias.SelectItem.md)

## Functions

- [renderSelect](plugins.domain-renderer.renderers.select.renderer.Function.renderSelect.md)
