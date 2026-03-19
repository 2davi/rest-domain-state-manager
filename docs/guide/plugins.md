# 플러그인 시스템

DSM 코어 엔진은 브라우저 DOM 환경과 완전히 분리되어 있어 Node.js 백엔드에서도 작동합니다. UI와 관련된 기능들은 **플러그인(Plugin)** 형태로 주입하여 사용합니다.

## 1. FormBinder (폼 자동 바인딩)

`getElementById`의 늪에서 벗어나게 해주는 핵심 플러그인입니다. `input[name]` 속성의 점(`.`) 표기법을 읽어 중첩 객체로 자동 매핑합니다.

```javascript
import { DomainState, FormBinder } from 'rest-domain-state-manager';
DomainState.use(FormBinder); // 앱 초기화 시 1회 등록

// 폼 입력 요소들과 상태를 양방향으로 연결
const user = DomainState.fromForm('userForm', api);

// 사용자가 폼에 타이핑하면 자동으로 Proxy에 기록되며,
// 저장 시 POST로 신규 등록됩니다.
await user.save('/api/users');
```

## 2. DomainRenderer (DOM 렌더링)

목록형 API 응답(배열)을 `<select>`, `<radio>`, `<checkbox>`, `<button>` 등의 UI 요소로 단숨에 렌더링합니다.

```javascript
import { DomainState, DomainRenderer } from 'rest-domain-state-manager';
DomainState.use(DomainRenderer);

const roles = await api.get('/api/roles');

// 배열 데이터를 <select> 드롭다운으로 렌더링
roles.renderTo('#roleSelect', {
  type: 'select',
  valueField: 'roleId',     // <option value="...">
  labelField: 'roleName',   // <option>Text</option>
  class: 'form-select',
  placeholder: '역할을 선택하세요'
});
```