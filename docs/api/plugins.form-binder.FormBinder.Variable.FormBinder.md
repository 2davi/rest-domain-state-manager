# Variable: FormBinder

> `const` **FormBinder**: `object`

`DomainState`에 HTML 폼 바인딩 기능을 주입하는 플러그인 객체.

`DomainState.use(FormBinder)` 한 번으로 설치한다.
설치 후 `DomainState.fromForm()` 정적 팩토리와
`domainState.bindForm()` 인스턴스 메서드가 활성화된다.

## Type Declaration

### install

> **install**: (`DomainStateClass`) => `void`

#### Parameters

##### DomainStateClass

*typeof* [`DomainState`](domain.DomainState.Class.DomainState.md)

#### Returns

`void`

## Example

```ts
import { DomainState, FormBinder } from './rest-domain-state-manager.js';
DomainState.use(FormBinder);

// fromForm — 신규 데이터 생성 (isNew: true → POST)
const formState = DomainState.fromForm('userForm', api, { debug: true });
await formState.save('/api/users');

// bindForm — 기존 데이터를 폼에 역동기화 후 추적 연결
const user = await api.get('/api/users/1');
user.bindForm('userForm'); // 폼에 현재 data를 채우고 이후 변경을 추적
```
