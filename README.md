# @2davi/rest-domain-state-manager

[![npm version](https://img.shields.io/npm/v/@2davi/rest-domain-state-manager)](https://www.npmjs.com/package/@2davi/rest-domain-state-manager)
[![CI](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

REST API 리소스를 Proxy로 감싸, **필드 변경을 자동으로 추적**하고,
**POST / PATCH / PUT을 스마트하게 분기**하는 zero-dependency 상태 관리 라이브러리.

저장 실패 시 클라이언트 상태를 자동 복원하는 **보상 트랜잭션**까지 내장.

---

## 어떤 환경에서 쓰시나요?

### JSP / 레거시 환경 → [SI 빠른 시작](#그리드-ui-바인딩--uicomposer--uilayout)

Spring Boot + JSP + jQuery 환경에서 1:N 폼 그리드를 10줄로 만드세요.  
`fnAddRow()`, `fnRemoveRow()`, `fnReindexRows()` — 전부 사라집니다.

### React / Vue → [프레임워크 연동 빠른 시작](#react-연동--usedomainstate)

`useDomainState()` 한 줄로 GET → 수정 → PATCH 사이클을 자동화하세요.  
`fetch`, `useState`, `useEffect`, 롤백 로직 — 전부 사라집니다.

---

## 이 라이브러리가 해결하는 것

REST API 프론트엔드 개발에서 반복되는 세 가지 문제를 해결합니다.

### 1. "어떤 필드가 바뀌었는지 모르겠다"

```javascript
// ❌ Before — 모든 필드를 수동으로 모아야 한다
const payload = {
    name:  document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    // ...필드가 30개면 30줄
};
await fetch('/api/users/1', { method: 'PUT', body: JSON.stringify(payload) });
```

```javascript
// ✅ After — 변경한 필드만 자동으로 추적되고, 적절한 HTTP 메서드가 선택된다
const user = await api.get('/api/users/1');
user.data.name = 'Davi';                // ← 이 변경이 자동으로 기록된다
await user.save('/api/users/1');         // → PATCH [{ "op": "replace", "path": "/name", "value": "Davi" }]
```

### 2. "저장 실패하면 화면이 꼬인다"

```javascript
// ❌ Before — 실패 시 수동 복원 코드를 매번 작성
try {
    await fetch('/api/users/1', { method: 'PATCH', body: ... });
} catch {
    // 이전 상태로 어떻게 되돌리지? UI에 반영된 값은?
}
```

```javascript
// ✅ After — 실패 시 save() 이전 상태로 자동 복원
try {
    await user.save('/api/users/1');
} catch (err) {
    // user.data는 이미 save() 호출 이전 상태로 되돌아가 있다.
    console.log(user.data.name); // → 변경 전 값
}
```

### 3. "1:N 그리드의 fnAddRow()가 끝없이 복사된다"

```javascript
// ❌ Before — 화면마다 복사되는 보일러플레이트
function fnAddRow() { /* N0 줄 */ }
function fnRemoveRow() { /* 인덱스 밀림 버그 */ }
function fnReindexRows() { /* N0 줄 */ }
function fnSelectAll() { /* N0 줄 */ }
```

```javascript
// ✅ After — HTML template 선언 + 컨트롤 함수 한 줄
const { addEmpty, removeChecked, validate } =
    certs.bind('#certGrid', { layout: CertLayout });
// addEmpty()      — 빈 행 추가
// removeChecked() — 체크된 행 역순 제거 (인덱스 밀림 자동 방지)
// validate()      — required 필드 검증
```

---

## 설치

```bash
npm install @2davi/rest-domain-state-manager
```

Node.js ≥ 20. 브라우저: Chrome 94+, Firefox 93+, Safari 15.4+.

---

## 빠른 시작 — 3분 안에 동작하는 코드

### STEP 1. API 핸들러 생성

```javascript
import { ApiHandler } from '@2davi/rest-domain-state-manager';

const api = new ApiHandler({ host: 'localhost:8080', debug: true });
```

### STEP 2. GET → 폼 바인딩 → 저장

```javascript
import { DomainState, UIComposer, UILayout } from '@2davi/rest-domain-state-manager';

DomainState.use(UIComposer); // 플러그인 설치 (앱 진입점에서 1회)

// ── UI 계약 선언: 어떤 필드가 어떤 DOM 요소에 연결되는지 ──
class UserFormLayout extends UILayout {
    static templateSelector = '#userFormTemplate';
    static columns = {
        name:  { selector: '[data-field="name"]',  required: true },
        email: { selector: '[data-field="email"]' },
        city:  { selector: '[data-field="city"]' },
    };
}
```

```javascript
// GET 응답이 자동으로 DomainState로 변환된다
const user = await api.get('/api/users/1');

// 폼에 바인딩하면, 사용자가 입력하는 동안 Proxy를 통해 상태가 자동으로 변경된다.
// 개발자가 user.data.name = '...' 같은 코드를 직접 작성할 필요가 없다.
const { unbind } = user.bindSingle('#userForm', { layout: UserFormLayout });

// 사용자가 name 필드에 'Davi'를 입력하고, city 필드에 'Seoul'을 입력한 뒤 저장 버튼을 클릭하면:
await user.save('/api/users/1');
// → PATCH [{ "op": "replace", "path": "/name", "value": "Davi" },
//          { "op": "replace", "path": "/city", "value": "Seoul" }]
// 사용자가 건드리지 않은 필드는 페이로드에 포함되지 않는다.
```

스크립트에서 직접 값을 넣는 것도 동일하게 동작합니다:

```javascript
user.data.name = 'Davi';            // → changeLog에 replace 기록
user.data.address.city = 'Seoul';   // → 중첩 경로도 자동 추적
```

폼 바인딩이든 스크립트 대입이든, **Proxy의 `set` 트랩을 통과하는 모든 변경이 자동 기록**됩니다.

### STEP 3. 신규 생성 (POST)

```javascript
import { DomainState, DomainVO } from '@2davi/rest-domain-state-manager';

class UserVO extends DomainVO {
    static fields = {
        name:  { default: '', validate: v => v.trim().length > 0 },
        email: { default: '' },
        age:   { default: 0, transform: Number },
    };
}

const newUser = DomainState.fromVO(new UserVO(), api);
newUser.data.name  = 'Davi';
newUser.data.email = 'davi@example.com';
await newUser.save('/api/users');  // → POST (isNew === true)
```

`DomainVO`는 선택적 레이어입니다. `DomainState.fromJSON()`은 VO 없이도 완전히 동작합니다.

---

## HTTP 메서드 자동 분기

`save()`는 두 가지 내부 상태를 분석하여 HTTP 메서드를 자동 결정합니다.

| 조건                                 | 메서드    | 근거                                   |
| ------------------------------------ | --------- | -------------------------------------- |
| `isNew === true`                     | **POST**  | 서버에 아직 존재하지 않는 신규 리소스  |
| 변경 없음 (`dirtyFields.size === 0`) | **no-op** | save() 조기 종료                       |
| 변경 비율 ≥ 70%                      | **PUT**   | 전체 교체가 JSON Patch 배열보다 효율적 |
| 변경 비율 < 70%                      | **PATCH** | RFC 6902 JSON Patch — 변경 부분만 전송 |

POST 성공 후 `isNew`가 `false`로 전환되어, 이후 저장은 PATCH 또는 PUT으로 분기합니다.

---

## 보상 트랜잭션 — 실패 시 자동 복원

`save()` 진입 시 `structuredClone()`으로 현재 상태 4종(데이터, 변경이력, dirty 필드, isNew 플래그)을
깊은 복사합니다. HTTP 요청이 실패하면 4종을 모두 save() 이전 시점으로 원자적 복원합니다.

```javascript
user.data.name = 'Davi';           // 변경 기록됨
await user.save('/api/users/1');    // 서버 500 에러 발생!
// → user.data.name은 자동으로 이전 값으로 복원됨
// → changeLog, dirtyFields도 save() 진입 이전 상태로 복원됨
// → 즉시 재시도 가능
```

`DomainPipeline`의 보상 트랜잭션과도 연계됩니다.
`strict: false` 모드에서 후속 `save()` 실패를 감지한 뒤,
이미 성공한 인스턴스에 `restore()`를 호출하여 전체 파이프라인의 일관성을 복구할 수 있습니다.

---

## 1:N 배열 관리 — DomainCollection

```javascript
import { DomainCollection } from '@2davi/rest-domain-state-manager';

// GET 응답 배열 → DomainCollection 변환
const certs = DomainCollection.fromJSONArray(
    await fetch('/api/certificates').then(r => r.text()),
    api
);

certs.add({ certName: '정보처리기사', certType: 'IT' });  // 항목 추가
certs.remove(0);                                          // 인덱스로 제거

await certs.saveAll({
    strategy: 'batch',           // 배열 전체를 단일 HTTP 요청으로 전송
    path: '/api/certificates',
});
// → PUT (기존 배열 전체 교체) 또는 POST (신규 생성)
```

---

## 그리드 UI 바인딩 — UIComposer + UILayout

HTML `<template>` 기반으로 DOM 구조를 선언하고, 라이브러리가 데이터를 채웁니다.
JS에서 DOM 구조를 생성하지 않으므로, CSS 프레임워크(Bootstrap, Tailwind)와 충돌 없이 사용할 수 있습니다.

### 1. HTML — `<template>` 선언

```html
<template id="certRowTemplate">
  <tr>
    <td><input type="checkbox" class="dsm-checkbox"></td>
    <td><span class="dsm-row-number"></span></td>
    <td><input type="text" data-field="certName" placeholder="자격증명"></td>
    <td>
      <select data-field="certType">
        <option value="IT">IT</option>
        <option value="LANG">어학</option>
      </select>
    </td>
  </tr>
</template>

<table>
  <tbody id="certGrid"></tbody>
</table>

<button id="btnAdd">행 추가</button>
<button id="btnRemove">선택 삭제</button>
<button id="btnSave">저장</button>
```

### 2. JS — UILayout 선언 + 바인딩

```javascript
import {
    ApiHandler, DomainState, DomainCollection,
    UIComposer, UILayout
} from '@2davi/rest-domain-state-manager';

// 플러그인 설치 (앱 진입점에서 1회)
DomainState.use(UIComposer);

// 화면별 UI 계약 선언
class CertLayout extends UILayout {
    static templateSelector = '#certRowTemplate';
    static itemKey          = 'certId';
    static columns = {
        certName: { selector: '[data-field="certName"]', required: true },
        certType: { selector: '[data-field="certType"]' },
    };
}

const api   = new ApiHandler({ host: 'localhost:8080' });
const certs = DomainCollection.fromJSONArray(
    // NOTE: 현재 ApiHandler.get() 메서드는 단일 객체 응답 중심으로 설계되어 있습니다 ^0^
    // TODO: 빠른 업데이트를 통해 fetch 병행 없이 불러오도록 개선하겠습니다 ^~^;
    await fetch('/api/certificates').then(r => r.text()),
    api
);

// 바인딩 → 컨트롤 함수 반환
const { addEmpty, removeChecked, validate } =
    certs.bind('#certGrid', { layout: CertLayout });

document.getElementById('btnAdd').onclick    = addEmpty;
document.getElementById('btnRemove').onclick = removeChecked;
document.getElementById('btnSave').onclick   = async () => {
    if (!validate()) return;
    await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
};
```

### 반환되는 컨트롤 함수

| 함수                 | 역할                                                      |
| -------------------- | --------------------------------------------------------- |
| `addEmpty()`         | 빈 행 추가 (template 복제 + input 리스너 자동 등록)       |
| `removeChecked()`    | 체크된 행 역순(LIFO) 제거 — 인덱스 밀림 자동 방지         |
| `removeAll()`        | 전체 행 제거                                              |
| `selectAll(checked)` | 전체 체크박스 일괄 설정                                   |
| `invertSelection()`  | 체크 상태 반전                                            |
| `validate()`         | `required: true` 필드 검증 + `is-invalid` CSS 클래스 토글 |
| `getCheckedItems()`  | 체크된 DomainState 배열 반환                              |
| `getItems()`         | 전체 DomainState 배열 반환                                |
| `getCount()`         | 총 행 수 반환                                             |
| `destroy()`          | 이벤트 리스너 정리                                        |

---

## React 연동 — useDomainState

서브패스 import로 React 어댑터를 사용합니다. React 18+ `useSyncExternalStore` 기반입니다.
React가 `peerDependencies(optional)`로 선언되어 있어, React 없이 설치해도 경고가 뜨지 않습니다.

```javascript
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

function UserProfile({ userState }) {
    const data = useDomainState(userState);

    return (
        <div>
            <input
                value={data.name}
                onChange={e => { userState.data.name = e.target.value; }}
            />
            <button onClick={() => userState.save('/api/users/1')}>
                저장
            </button>
        </div>
    );
}
```

혹은,

```javascript
import { ApiHandler, DomainState } from '@2davi/rest-domain-state-manager';
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

const api = new ApiHandler({ host: 'localhost:8080' });

function UserProfile({ userId }) {
    const [state, setUserState] = useState(null);

    useEffect(() => {
        api.get(`/api/users/${userId}`).then(setUserState);
    }, [userId]);

    const data = useDomainState(state); // Shadow State — 변경 시 자동 리렌더링

    if (!data) return <div>로딩 중...</div>;

    return (
        <form>
            <input
                value={data.name}
                onChange={e => { state.data.name = e.target.value; }}
            />
            <button onClick={() => state.save(`/api/users/${userId}`)}>
                저장 (PATCH 자동 분기)
            </button>
        </form>
    );
}
```

`userState.data.name = '...'`로 Proxy를 변이하면:

1. Microtask 배칭 완료 → Structural Sharing 기반 불변 스냅샷 재빌드
2. 변경된 키만 새 참조, 나머지 키는 이전 참조 재사용
3. React가 `getSnapshot()` 재호출 → `Object.is()` 비교 → 리렌더링

변경이 없으면 동일 참조를 반환하여 **무한 리렌더링 루프가 발생하지 않습니다.**
저장 실패 시 모든 상태가 `save()` 이전으로 자동 복원됩니다. `useState`로 에러 상태를 따로 관리할 필요가 없습니다.

---

## 병렬 fetch + 후처리 — DomainPipeline

여러 API를 병렬로 요청하고, 응답 순서와 무관하게 후처리를 체이닝합니다.

```javascript
const result = await DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/1'),
}, { strict: false })
.after('roles', async roles => {
    // roles 응답으로 셀렉트박스 옵션 채우기
})
.after('user', async user => {
    // user 응답으로 폼 데이터 채우기
})
.run();

// 개별 실패는 result._errors에 기록 (strict: false)
if (result._errors?.length) console.warn(result._errors);
```

---

## Idempotency-Key — 네트워크 재시도 안전

[IETF Idempotency-Key 표준 초안](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)에 기반합니다.

```javascript
const api = new ApiHandler({ host: 'api.example.com', idempotent: true });

try {
    await user.save('/api/users/1');
} catch {
    // 네트워크 타임아웃 후 재시도 — 동일 UUID가 자동 재사용됨
    await user.save('/api/users/1');
    // 서버는 동일 Idempotency-Key를 감지하여 중복 처리 방지
}
```

`save()` 성공 시 UUID 즉시 초기화. 실패 시 유지되어 재시도 안전.

---

## CSRF 보안

[OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) 준수.
`POST`, `PUT`, `PATCH`, `DELETE` 요청에만 `X-CSRF-Token` 헤더를 삽입합니다.

```javascript
const api = new ApiHandler({ host: 'localhost:8080' });

// DOM이 준비된 시점에 1회 호출
api.init();
// → <meta name="csrf-token" content="..."> 파싱
// → 이후 모든 뮤테이션 요청에 X-CSRF-Token 헤더 자동 주입

// 또는 쿠키에서 파싱
api.init({ csrfCookieName: 'XSRF-TOKEN' });
```

`init()` 미호출 시 CSRF 기능은 비활성 상태이며, 뮤테이션 요청에 토큰이 삽입되지 않습니다.

---

## Lazy Tracking Mode — 최소 페이로드

```javascript
const user = await api.get('/api/users/1', { trackingMode: 'lazy' });

user.data.name = 'A';
user.data.name = 'B';
user.data.name = 'C';  // 같은 필드를 3번 변경

await user.save('/api/users/1');
// realtime 모드: PATCH에 3개 항목 (A, B, C 각각 기록)
// lazy 모드:    PATCH에 1개 항목 (최종 결과 C만 전송)
```

`lazy` 모드에서는 Proxy `set` 트랩이 changeLog 기록을 건너뛰고,
`save()` 호출 시 초기 스냅샷과 현재 상태를 LCS 알고리즘으로 deep diff하여
**최종 변경 결과만** PATCH 페이로드에 포함합니다.

diff 연산은 브라우저 환경에서 Web Worker로 오프로딩되어 메인 스레드를 차단하지 않습니다.

---

## 디버거 — 멀티탭 실시간 상태 시각화

```javascript
const api = new ApiHandler({ host: 'localhost:8080', debug: true });
const user = await api.get('/api/users/1');

user.openDebugger();  // 디버그 팝업 열기
```

`BroadcastChannel` 기반으로 동일 출처의 모든 탭에서 `DomainState`의 상태를 실시간으로 확인할 수 있습니다.
탭이 닫히거나 응답이 없으면 Heartbeat GC가 자동으로 정리합니다.

---

## 주요 기능 요약

| 기능                | 설명                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| Proxy 자동 추적     | `set`, `delete`, 배열 변이(`push`, `splice`, `sort` 등) 전체 인터셉트 |
| RFC 6902 JSON Patch | changeLog를 표준 JSON Patch 배열로 직렬화                             |
| HTTP 메서드 분기    | `isNew` + `dirtyRatio` 기반 POST / PATCH / PUT 자동 결정              |
| 보상 트랜잭션       | `structuredClone` 기반 4종 상태 원자적 롤백                           |
| DomainCollection    | 1:N 배열 상태 + `saveAll({ strategy: 'batch' })`                      |
| UIComposer          | HTML `<template>` 기반 그리드/폼 바인딩 + 컨트롤 함수 반환            |
| React 어댑터        | `useSyncExternalStore` 기반 `useDomainState()` 훅                     |
| Idempotency-Key     | IETF Draft 기반 UUID 자동 발급/재사용                                 |
| CSRF 인터셉터       | 3-상태 설계. `<meta>` + 쿠키 파싱                                     |
| Lazy Tracking       | LCS deep diff + Worker 오프로딩. 최종 변경만 전송                     |
| Microtask 배칭      | `queueMicrotask` 스케줄러. 동기 블록 내 다중 변경 → 단일 flush        |
| V8 최적화           | WeakMap Lazy Proxying + Reflect API + DomainVO Shape 고정             |
| 플러그인 시스템     | `DomainState.use(plugin)` — 선택적 DOM 의존 기능 분리                 |
| 멀티탭 디버거       | BroadcastChannel + Heartbeat GC + Worker 직렬화                       |
| DomainPipeline      | 병렬 fetch + 순차 after() 체이닝 + 보상 트랜잭션 연계                 |
| Zero Dependency     | 런타임 의존성 0. `sideEffects: false` Tree-shaking 허용               |

---

## API 구성

```javascript
import {
    ApiHandler,         // HTTP 전송 레이어 (인스턴스 생성은 소비자가 담당)
    DomainState,        // 팩토리 3종 + save/remove + Shadow State + 플러그인
    DomainVO,           // 선택적 — 신규 INSERT 스키마 선언 시
    DomainCollection,   // 1:N 배열 상태 컨테이너 + saveAll
    DomainPipeline,     // 병렬 fetch + 순차 after() 체이닝
    UIComposer,         // HTML <template> 기반 그리드/폼 바인딩 플러그인
    UILayout,           // 화면별 UI 계약 선언 베이스 클래스
    closeDebugChannel,  // 디버그 채널 명시적 종료 (SPA 전환 시)
} from '@2davi/rest-domain-state-manager';

// React 어댑터 (별도 서브패스)
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
```

---

## 문서

전체 가이드, 아키텍처 심층 분석, 인터랙티브 플레이그라운드:
**[lab.the2davi.dev/rest-domain-state-manager](https://lab.the2davi.dev/rest-domain-state-manager)**

| 카테고리          | 페이지                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick Start**   | [SI 빠른 시작](https://lab.the2davi.dev/rest-domain-state-manager/guide/si-quickstart) · [모던 빠른 시작](https://lab.the2davi.dev/rest-domain-state-manager/guide/modern-quickstart)                                                                                                                                                                                                                                                                                         |
| **Guide**         | [DomainCollection](https://lab.the2davi.dev/rest-domain-state-manager/guide/domain-collection) · [UIComposer & UILayout](https://lab.the2davi.dev/rest-domain-state-manager/guide/ui-composer) · [Tracking Modes](https://lab.the2davi.dev/rest-domain-state-manager/guide/tracking-modes) · [Idempotency](https://lab.the2davi.dev/rest-domain-state-manager/guide/idempotency) · [save() 분기 전략](https://lab.the2davi.dev/rest-domain-state-manager/guide/save-strategy) |
| **Architecture**  | [Proxy 엔진](https://lab.the2davi.dev/rest-domain-state-manager/architecture/proxy-engine) · [HTTP 라우팅](https://lab.the2davi.dev/rest-domain-state-manager/architecture/http-routing) · [V8 최적화](https://lab.the2davi.dev/rest-domain-state-manager/architecture/v8-optimization)                                                                                                                                                                                       |
| **Playground**    | [인터랙티브 데모 11종](https://lab.the2davi.dev/rest-domain-state-manager/playground/)                                                                                                                                                                                                                                                                                                                                                                                        |
| **API Reference** | [TypeDoc 자동 생성](https://lab.the2davi.dev/rest-domain-state-manager/api/rest-domain-state-manager)                                                                                                                                                                                                                                                                                                                                                                         |
| **Decision Log**  | [ARD 4편 + IMPL 5편](https://lab.the2davi.dev/rest-domain-state-manager/decision-log/)                                                                                                                                                                                                                                                                                                                                                                                        |

---

## License

ISC © 2026 [2davi](https://github.com/2davi)
