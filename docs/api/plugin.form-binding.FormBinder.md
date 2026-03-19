# plugin/form-binding/FormBinder

FormBinder — HTML 폼 자동 바인딩 플러그인

`DomainState` 코어 엔진에서 브라우저 DOM 의존성을 분리하여
플러그인 형태로 제공하는 폼 바인딩 모듈이다.

## 설치
```js
import { DomainState, FormBinder } from './rest-domain-state-manager.js';
DomainState.use(FormBinder); // 앱 초기화 시 1회
```

## 설치 후 활성화되는 기능

### 1. 정적 팩토리 — `DomainState.fromForm(formOrId, handler, opts?)`
HTML Form 요소의 현재 값으로 기본 골격을 생성하고,
`blur` / `change` 이벤트를 자동으로 Proxy에 바인딩한다. (`isNew: true`)

### 2. 인스턴스 메서드 — `domainState.bindForm(formOrId)`
이미 생성된 `DomainState`의 현재 데이터를 폼에 역방향 동기화하고,
이후 폼 입력이 Proxy를 통해 자동으로 추적되도록 이벤트를 바인딩한다.

## Form 이벤트 추적 전략

| 요소 타입                                                 | 추적 이벤트 | 이유                                       |
|----------------------------------------------------------|-------------|-------------------------------------------|
| `input[type=text\|password\|email\|textarea]`            | `focusout`  | 타이핑 중 불필요한 Proxy set 트랩 방지     |
| `select`, `input[type=radio\|checkbox]`, 그 외           | `input`     | 선택 즉시 값이 확정되어 즉시 반영           |

## `input[name]` 경로 표기법
`name` 속성에 점(`.`) 표기를 사용하면 중첩 객체 구조로 매핑된다.
```html
<input name="address.city" />  <!-- proxy.address.city 에 바인딩 -->
```

## 코어와의 분리 원칙
이 플러그인은 브라우저 DOM(`HTMLFormElement`, `document.getElementById`)에 의존한다.
코어 엔진(`api-proxy.js`, `DomainState.js`)은 DOM을 직접 참조하지 않으므로
Node.js 등 비(非)브라우저 환경에서도 코어를 독립적으로 사용할 수 있다.

## See

 - module:model/DomainState DomainState
 - module:core/api-proxy createProxy

## Interfaces

- [FromFormOptions](plugin.form-binding.FormBinder.Interface.FromFormOptions.md)

## Type Aliases

- [BindFormMethod](plugin.form-binding.FormBinder.TypeAlias.BindFormMethod.md)
- [FromFormFactory](plugin.form-binding.FormBinder.TypeAlias.FromFormFactory.md)

## Variables

- [FormBinder](plugin.form-binding.FormBinder.Variable.FormBinder.md)
