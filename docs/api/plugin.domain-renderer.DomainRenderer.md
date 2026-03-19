# plugin/domain-renderer/DomainRenderer

DomainRenderer — DOM 렌더링 플러그인

`DomainState.use(DomainRenderer)` 한 번으로 모든 `DomainState` 인스턴스에
`renderTo()` 메서드를 주입하는 플러그인이다.

## 설치
```js
import { DomainState, DomainRenderer } from './rest-domain-state-manager.js';
DomainState.use(DomainRenderer); // 앱 초기화 시 1회
```

## 지원 렌더링 타입

| `type`       | 렌더러 모듈                    | 생성 요소                          |
|-------------|-------------------------------|-----------------------------------|
| `'select'`  | `select.renderer.js`          | `<select>` + `<option>` 목록      |
| `'radio'`   | `radio-checkbox.renderer.js`  | `<input type="radio">` 그룹       |
| `'checkbox'`| `radio-checkbox.renderer.js`  | `<input type="checkbox">` 그룹    |
| `'button'`  | `button.renderer.js`          | `<button>` 그룹                   |

## 렌더링 조건
`renderTo()`는 `DomainState`가 **배열 데이터**를 보유하고 있을 때만 정상 동작한다.
목록 API(`GET /api/roles`)의 응답으로 생성된 `DomainState`가 그 예다.

## 덮어쓰기 동작
`renderTo()`를 같은 컨테이너에 여러 번 호출하면
기존 자식 요소를 모두 제거(`innerHTML = ''`)하고 새로 렌더링한다.

## See

 - module:plugin/domain-renderer/renderers/select.renderer renderSelect
 - module:plugin/domain-renderer/renderers/radio-checkbox.renderer renderRadioCheckbox
 - module:plugin/domain-renderer/renderers/button.renderer renderButton
 - module:plugin/domain-renderer/renderer.const RENDERER\_TYPE

## Type Aliases

- [RenderConfig](plugin.domain-renderer.DomainRenderer.TypeAlias.RenderConfig.md)
- [RenderResult](plugin.domain-renderer.DomainRenderer.TypeAlias.RenderResult.md)
- [RenderToMethod](plugin.domain-renderer.DomainRenderer.TypeAlias.RenderToMethod.md)

## Variables

- [DomainRenderer](plugin.domain-renderer.DomainRenderer.Variable.DomainRenderer.md)
