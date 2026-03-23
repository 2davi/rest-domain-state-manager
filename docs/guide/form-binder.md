# FormBinder 플러그인

<span class="badge badge-stable">Stable</span>

`FormBinder` 는 HTML 폼 요소와 `DomainState` 인스턴스를 양방향으로 연결하는 플러그인입니다. `getElementById()` 로 값을 하나씩 긁어모으는 작업을 완전히 대체합니다. DSM 코어는 DOM 의존성 없이 동작하므로, 이 기능은 선택적 플러그인으로 분리되어 있습니다.

## 등록

애플리케이션 초기화 시 한 번만 호출합니다.

```javascript
import { DomainState, FormBinder } from '@2davi/rest-domain-state-manager'

DomainState.use(FormBinder)
```

등록 후 `DomainState` 에 `fromForm()` 과 `bindForm()` 두 메서드가 추가됩니다.

## fromForm — 폼을 소스로 초기 상태 생성

```javascript
DomainState.fromForm(formOrId, handler, options?)
```

폼의 현재 값을 읽어 초기 상태를 구성하고, 이후 `input`/`change`/`blur` 이벤트를 통해 변경을 자동으로 Proxy에 반영합니다. `isNew: true` 로 설정됩니다.

```html
<form id="userForm">
    <input name="name"         value="홍길동" />
    <input name="email"        value="" />
    <input name="address.city" value="서울" />  <!-- 점 표기법으로 중첩 객체 매핑 -->
    <select name="role">
        <option value="user">일반</option>
        <option value="admin" selected>관리자</option>
    </select>
</form>
```

```javascript
const user = DomainState.fromForm('userForm', api)
// data: { name: '홍길동', email: '', address: { city: '서울' }, role: 'admin' }
// isNew: true

await user.save('/api/users')
// → POST
```

`input[name]` 의 점(`.`) 표기법을 자동으로 해석하여 중첩 객체로 매핑합니다. `address.city` 는 `{ address: { city: '...' } }` 구조로 변환됩니다.

## bindForm — 기존 상태를 폼에 역동기화

```javascript
domainState.bindForm(formOrId)
```

이미 생성된 `DomainState` 인스턴스의 데이터를 폼 요소에 채워 넣고, 이후 이벤트를 바인딩합니다. 서버에서 조회한 데이터로 편집 폼을 초기화할 때 사용합니다.

```javascript
const user = await api.get('/users/user_001')
// data: { name: 'Davi', role: 'admin', ... }

user.bindForm('editUserForm')
// 폼 요소에 서버 데이터가 자동으로 채워짐
// 이후 사용자 입력이 user.data에 반영됨

await user.save('/api/users/user_001')
// → PATCH (변경된 필드만 전송)
```

## 이벤트 동기화 전략

폼 입력 이벤트의 발생 빈도와 변경 확정 시점을 고려하여 요소 유형별로 다른 이벤트를 사용합니다.

<table class="param-table">
  <thead>
    <tr><th>요소 유형</th><th>동기화 이벤트</th><th>이유</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>input[type=text]</code>, <code>textarea</code></td>
      <td><code>blur</code></td>
      <td>타이핑 중 매 키마다 Proxy 트랩이 발생하면 changeLog가 불필요하게 쌓입니다. 입력 완료(포커스 이탈) 시점에 한 번 동기화합니다.</td>
    </tr>
    <tr>
      <td><code>select</code>, <code>radio</code>, <code>checkbox</code></td>
      <td><code>change</code></td>
      <td>값이 선택과 동시에 확정되므로 즉시 동기화합니다.</td>
    </tr>
    <tr>
      <td><code>input[type=email]</code>, <code>input[type=password]</code></td>
      <td><code>blur</code></td>
      <td>text와 동일하게 처리합니다.</td>
    </tr>
  </tbody>
</table>

## 인터랙티브 시연

<PlaygroundFormBinder />

## 인터랙티브 시연

`fromForm()` 과 `bindForm()` 두 가지 모드를 전환하며 폼 바인딩 동작을 직접 확인해보세요. text 필드는 포커스를 벗어날 때(`blur`), select는 값을 선택하는 즉시(`change`) 동기화됩니다.

<PlaygroundFormBinder />
