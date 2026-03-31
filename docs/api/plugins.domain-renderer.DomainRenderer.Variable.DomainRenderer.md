# ~~Variable: DomainRenderer~~

> `const` **DomainRenderer**: `object`

`DomainState`에 `renderTo()` DOM 렌더링 기능을 주입하는 플러그인 객체.

## Type Declaration

### ~~install~~

> **install**: (`DomainStateClass`) => `void`

#### Parameters

##### DomainStateClass

*typeof* [`DomainState`](domain.DomainState.Class.DomainState.md)

#### Returns

`void`

## Deprecated

v1.0.0에서 deprecated됩니다. ...를 사용하세요.

`DomainState.use(DomainRenderer)` 한 번으로 설치한다.
설치 후 모든 `DomainState` 인스턴스에서 `renderTo()`를 호출할 수 있다.

## Examples

```ts
import { DomainState, DomainRenderer } from './rest-domain-state-manager.js';
DomainState.use(DomainRenderer);

const roles = await api.get('/api/roles');

roles.renderTo('#roleSelect', {
    type:        'select',
    valueField:  'roleId',
    labelField:  'roleName',
    class:       'form-select',
    placeholder: '역할 선택',
});
```

```ts
DomainState.use(DomainRenderer).use(FormBinder);
```
