# @2davi/rest-domain-state-manager

[![npm version](https://img.shields.io/npm/v/@2davi/rest-domain-state-manager)](https://www.npmjs.com/package/@2davi/rest-domain-state-manager)
[![CI](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Proxy 기반 REST API 도메인 상태 관리 라이브러리.  
HTTP 메서드 자동 분기, JSON Patch 직렬화, 보상 트랜잭션을 단 몇 줄로.

---

## 어떤 환경에서 쓰시나요?

### JSP / 레거시 환경 → [SI 빠른 시작](#si-빠른-시작)

Spring Boot + JSP + jQuery 환경에서 1:N 폼 그리드를 10줄로 만드세요.  
`fnAddRow()`, `fnRemoveRow()`, `fnReindexRows()` — 전부 사라집니다.

### React / Vue → [모던 빠른 시작](#모던-빠른-시작)

`useDomainState()` 한 줄로 GET → 수정 → PATCH 사이클을 자동화하세요.  
`fetch`, `useState`, `useEffect`, 롤백 로직 — 전부 사라집니다.

---

## SI 빠른 시작

Spring Boot + JSP 환경에서 자격증 그리드를 만드는 예제입니다.

**1. HTML `<template>` 선언**

```html
<!-- 행(row) 하나의 구조를 template으로 선언합니다 -->
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

**2. JS 연결 (10줄)**

```javascript
import {
    ApiHandler, DomainState, DomainCollection,
    UIComposer, UILayout
} from '@2davi/rest-domain-state-manager';

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
    await fetch('/api/certificates').then(r => r.text()),
    api
);

const { addEmpty, removeChecked, validate } =
    certs.bind('#certGrid', { layout: CertLayout });

document.getElementById('btnAdd').onclick    = addEmpty;
document.getElementById('btnRemove').onclick = removeChecked;
document.getElementById('btnSave').onclick   = async () => {
    if (!validate()) return;
    await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
};
```

**기존 코드와 비교**

| 항목 | 기존 | DSM |
|---|---|---|
| 행 추가 | `fnAddRow()` 50줄 | `addEmpty` 한 줄 |
| 행 번호 재정렬 | `fnReindexRows()` 50줄 | 라이브러리 자동 처리 |
| 선택 삭제 | 인덱스 밀림 버그 반복 | `removeChecked` (LIFO 자동 보장) |
| 배열 저장 | `serialize()` 50줄 + POST 직접 | `saveAll({ strategy: 'batch' })` |
| 실패 롤백 | 수동 복원 | 자동 복원 (`structuredClone` 기반) |

---

## 모던 빠른 시작

React 환경에서 단일 사용자 폼을 다루는 예제입니다.

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

저장 실패 시 모든 상태가 `save()` 이전으로 자동 복원됩니다. `useState`로 에러 상태를 따로 관리할 필요가 없습니다.

---

## 설치

```bash
npm install @2davi/rest-domain-state-manager
```

```javascript
import {
    ApiHandler,
    DomainState,
    DomainVO,          // 선택적 — 신규 INSERT 스키마 선언 시
    DomainCollection,  // 1:N 배열 관리
    DomainPipeline,    // 병렬 fetch + 후처리 체이닝
    UIComposer,        // HTML <template> 기반 그리드/폼 바인딩
    UILayout,          // 화면별 UI 계약 선언 베이스 클래스
} from '@2davi/rest-domain-state-manager';
```

Node.js ≥ 20. 브라우저: Chrome 94+, Firefox 93+, Safari 15.4+.

---

## HTTP 메서드 자동 분기

`save()`는 두 가지 내부 상태로 HTTP 메서드를 자동 결정합니다.

| 조건 | 메서드 | 근거 |
|---|---|---|
| `isNew === true` | **POST** | 서버에 아직 존재하지 않는 신규 리소스 |
| `isNew === false`, 변경 없음 | **PUT** | 의도적 재저장 — 멱등 전체 교체 |
| `isNew === false`, `dirtyRatio ≥ 0.7` | **PUT** | 70% 이상 변경 — Patch 배열보다 전체 교체가 효율적 |
| `isNew === false`, `dirtyRatio < 0.7` | **PATCH** | 부분 업데이트 — RFC 6902 JSON Patch 페이로드 |

---

## 주요 기능

- **Proxy 기반 자동 변경 추적** — `set`, `deleteProperty`, 배열 변이(`push`, `splice`, `sort` 등) 전체 인터셉트. 중첩 객체 설정 없이 자동 추적.
- **RFC 6902 PATCH 페이로드** — 내부 `changeLog`를 JSON Patch 배열로 직렬화.
- **Optimistic Rollback** — HTTP 실패 시 `structuredClone` 기반으로 4개 내부 상태를 `save()` 이전으로 원자적 복원. 즉시 재시도 가능.
- **DomainCollection + saveAll** — 1:N 배열 상태를 단일 `POST`/`PUT`으로 처리. `fnAddRow` 보일러플레이트 제거.
- **UIComposer + UILayout** — HTML `<template>` 기반 그리드 양방향 바인딩. JS에서 DOM 구조를 생성하지 않음.
- **Idempotency-Key 자동 발급** — 네트워크 타임아웃 재시도 시 동일 UUID 재사용. `ApiHandler({ idempotent: true })` 한 줄.
- **Lazy Tracking Mode** — `save()` 시점에 `_initialSnapshot`과 diff 연산으로 최종 변경만 추출. 중간 편집 이력 없이 최소 페이로드.
- **V8 최적화 Proxy 엔진** — WeakMap Lazy Proxying, `Reflect` API, 수학적 배열 Delta 알고리즘으로 Hidden Class 오염 없음.
- **플러그인 시스템** — `UIComposer`, `DomainRenderer`, `FormBinder`는 선택적 DOM 의존 플러그인. Core 엔진은 DOM 없이 Node.js에서 실행.
- **멀티탭 디버거** — `BroadcastChannel` 기반 실시간 디버그 팝업. Heartbeat GC로 오래된 탭 자동 정리.

---

## DomainVO — 선택적 레이어

`DomainVO`는 신규 INSERT 화면에서 기본값 골격과 유효성 검사 함수를 중앙 선언할 때 사용합니다.  
`DomainState.fromJSON()`은 VO 없이도 완전히 동작합니다.

```javascript
// DomainVO 없이도 동작
const user = await api.get('/api/users/1');
user.data.name = 'Davi';
await user.save('/api/users/1'); // ← 이것만으로 충분

// DomainVO를 쓰면 신규 INSERT 시 기본값 + 유효성 검사를 선언할 수 있음
class UserVO extends DomainVO {
    static fields = {
        name: { default: '', validate: v => v.trim().length > 0 },
        age:  { default: 0,  validate: v => v >= 0, transform: Number },
    };
}
const newUser = DomainState.fromVO(new UserVO(), api);
```

---

## 문서

전체 가이드, 아키텍처 심층 분석, 인터랙티브 플레이그라운드:  
**[lab.the2davi.dev/rest-domain-state-manager](https://lab.the2davi.dev/rest-domain-state-manager)**

- [SI 빠른 시작](https://lab.the2davi.dev/rest-domain-state-manager/guide/si-quickstart)
- [모던 빠른 시작](https://lab.the2davi.dev/rest-domain-state-manager/guide/modern-quickstart)
- [DomainCollection 가이드](https://lab.the2davi.dev/rest-domain-state-manager/guide/domain-collection)
- [UIComposer & UILayout](https://lab.the2davi.dev/rest-domain-state-manager/guide/ui-composer)
- [save() 분기 전략](https://lab.the2davi.dev/rest-domain-state-manager/guide/save-strategy)
- [API 레퍼런스](https://lab.the2davi.dev/rest-domain-state-manager/api/domain.DomainState.Class.DomainState)

---

## License

ISC © 2026 [2davi](https://github.com/2davi)
