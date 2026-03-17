# rest-domain-state-manager

> REST API 응답 데이터를 Proxy로 감싸 변경을 자동 추적하고,
> 저장 시점에 최적의 HTTP 메서드(POST / PUT / PATCH)로 자동 분기하는
> 순수 ES Module 기반 도메인 상태 관리 라이브러리.

번들러(Bundler) 없음 · npm 없음 · 외부 의존성 없음

---

## 왜 만들었나

SI 프로젝트 JSP 화면에서 반복되는 세 가지 패턴을 제거하기 위해 만들었다.

```javascript
// 기존 방식 — 저장마다 폼 값을 손으로 조립
const payload = {
  name:    document.getElementById('name').value,
  city:    document.getElementById('city').value,
  role:    document.getElementById('role').value,
  // ... 필드 늘어날수록 계속 추가
};

// 이 라이브러리 — 폼 바인딩 후 save() 한 줄
const user = DomainState.fromForm('userForm', api);
await user.save('/api/users/1');
// 변경된 필드만 PATCH, 변경 없으면 PUT, 신규면 POST — 자동 분기
```

---

## 빠른 시작

```html
<script type="module">
  import { api, DomainState, DomainVO, DomainRenderer }
    from './rest-domain-state-manager.js';

  DomainState.use(DomainRenderer);

  // GET → 변경 → 자동 PATCH
  const user = await api.get('/api/users/user_001');
  user.data.name = 'Davi';                 // Proxy가 변경 추적
  await user.save('/api/users/user_001');  // changeLog → PATCH

  // 병렬 fetch + 순차 후처리
  const result = await DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/1'),
  })
  .after('roles', async roles => {
    roles.renderTo('#roleSelect', {
      type: 'select', valueField: 'roleId', labelField: 'roleName',
      class: 'form-select', placeholder: '역할 선택',
    });
  })
  .run();
</script>
```

---

## 설치

```text
npm, bundler, CDN 불필요.
프로젝트 디렉토리에 폴더째 복사 후 import만 하면 된다.
```

`api-handler.js` 맨 아래 싱글톤 설정에서 서버 주소를 변경한다.

```javascript
// src/handler/api-handler.js
export const api = new ApiHandler({
  host:  'localhost:8080',   // ← 여기만 변경
  debug: true,
  env:   'development',
});
```

---

## 핵심 API

### DomainState

| 메서드 / 프로퍼티 | 설명                                      |
| ----------------- | ----------------------------------------- |
| `.data`           | 변경 추적 Proxy 객체 (유일한 외부 진입점) |
| `.save(path?)`    | POST / PUT / PATCH 자동 분기              |
| `.remove(path?)`  | DELETE                                    |
| `.log()`          | changeLog 콘솔 출력 (debug: true 시)      |
| `.openDebugger()` | 디버그 팝업 열기                          |

### 팩토리 메서드

```javascript
// A. GET 응답으로부터 생성 (isNew: false → PATCH/PUT 분기)
const user = await api.get('/api/users/1');
const user = DomainState.fromJSON(jsonText, api, { debug: true });

// B. DomainVO 기본값 골격으로 생성 (isNew: true → POST)
const user = DomainState.fromVO(new UserVO(), api, { debug: true });

// C. HTML Form 요소로부터 생성 (isNew: true → POST)
const user = DomainState.fromForm('userForm', api, { debug: true });
```

### DomainVO

```javascript
class UserVO extends DomainVO {
  static baseURL = 'localhost:8080/api/users';

  static fields = {
    userId:  { default: '' },
    name:    { default: '', validate: v => v.trim().length > 0 },
    age:     { default: 0,  validate: v => v >= 0, transform: Number },
    address: { default: { city: '', zip: '' } },
    role:    { default: 'USER' },
  };
}

const user = DomainState.fromVO(new UserVO(), api);
user.data.name = 'Davi';
await user.save();  // UserVO.baseURL 자동 사용
```

### DomainPipeline

```javascript
const result = await DomainState.all({
  roles: api.get('/api/roles'),
  user:  api.get('/api/users/1'),
}, { strict: false })         // strict: true → 첫 실패에서 즉시 reject
.after('roles', async roles => { /* roles는 DomainState */ })
.after('user',  async user  => { /* user는 DomainState */ })
.run();
// → { roles: DomainState, user: DomainState, _errors?: [...] }
```

### DomainRenderer (플러그인)

```javascript
DomainState.use(DomainRenderer);  // 앱 초기화 시 1회

const roles = await api.get('/api/roles');

// select
roles.renderTo('#roleSelect', {
  type: 'select', valueField: 'roleId', labelField: 'roleName',
  class: 'form-select', placeholder: '선택하세요',
  events: { change: (e) => console.log(e.target.value) },
});

// radio — name은 valueField 자동 사용 (MyBatis form submit 자동 매핑)
roles.renderTo('#roleRadio', {
  type: 'radio', valueField: 'roleId', labelField: 'roleName',
  containerClass: 'form-check', class: 'form-check-input', labelClass: 'form-check-label',
});

// checkbox
roles.renderTo('#roleCheck', {
  type: 'checkbox', valueField: 'roleId', labelField: 'roleName',
  containerClass: 'form-check form-check-inline',
  class: 'form-check-input', labelClass: 'form-check-label',
});

// button — data-value 속성으로 값 주입
roles.renderTo('#roleBtns', {
  type: 'button', valueField: 'roleId', labelField: 'roleName',
  class: 'btn btn-sm btn-outline-primary',
  css: { margin: '2px' },
  events: { click: (e) => console.log(e.target.dataset.value) },
});
```

---

## save() 분기 전략

```text
신규 데이터 (fromVO / fromForm으로 생성)
  → POST

기존 데이터 (GET으로 조회)
  변경 있음 → PATCH (RFC 6902 JSON Patch)
  변경 없음 → PUT
```

---

## 디버그 팝업

```javascript
DomainState.fromVO(new UserVO(), api, { debug: true, label: 'UserVO' });

// 팝업 열기
domainState.openDebugger();
```

같은 출처(Origin)의 모든 탭에서 `BroadcastChannel`로 연결된다.
팝업 하나에서 탭을 전환하며 각 탭의 DomainState 상태를 실시간으로 확인할 수 있다.

---

## 테스트

`proxy.test.html`을 VSCode Live Server로 열면 7개 케이스를 브라우저에서 직접 실행할 수 있다.

| 케이스   | 내용                                             |
| -------- | ------------------------------------------------ |
| 1        | GET → 변경 → PATCH / DELETE                      |
| 2        | fromVO → POST                                    |
| 3        | fromForm → 이벤트 추적 (blur / change)           |
| 4        | renderTo() — select / radio / checkbox / button  |
| 5        | DomainPipeline — strict: false / true            |
| 6        | Debug Popup 실시간 상태 확인                     |
| 7        | renderTo() class / css 커스텀 스타일링           |

연동 백엔드: Spring Boot 3+ · PostgreSQL · JdbcClient

---

## 디렉토리 구조

```text
rest-domain-state-manager/
├── rest-domain-state-manager.js   진입점
├── proxy.test.html                통합 테스트
├── model/
│   ├── DomainState.js
│   ├── DomainVO.js
│   └── DomainPipeline.js
├── src/
│   ├── constants/
│   ├── common/
│   ├── core/
│   ├── handler/
│   └── debug/
└── plugin/
    └── domain-renderer/
        └── renderers/
```

상세 설계는 [ARCHITECTURE.md](./ARCHITECTURE.md)를 참고한다.

---
