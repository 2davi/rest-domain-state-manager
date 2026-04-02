# JSP / 레거시 환경 빠른 시작

<span class="badge badge-stable">Stable</span>

Spring Boot + JSP + jQuery 환경에서 1:N 폼 그리드를 만드는 완전한 예제입니다.  
`fnAddRow()`, `fnReindexRows()`, `fnSave()` — 이 패턴을 10줄로 줄이는 것이 이 가이드의 목표입니다.

---

## 전제 조건

- `@2davi/rest-domain-state-manager` 설치 완료 ([설치 가이드](/guide/installation) 참고)
- Spring Boot + JSP 환경, `<script type="module">` 지원

---

## 시나리오 — 자격증 관리 그리드

사용자의 자격증 목록을 조회하고, 행을 추가/삭제한 뒤 전체를 한 번에 저장합니다.

---

## Step 1 — HTML `<template>` 선언

JS에서 DOM을 직접 생성하지 않습니다. 행(row) 구조를 HTML `<template>`으로 선언하면 라이브러리가 복제해서 사용합니다.

```html
<%-- certList.jsp --%>

<%-- 편집 모드 행 템플릿 --%>
<template id="certRowTemplate">
  <tr>
    <td><input type="checkbox" class="dsm-checkbox"></td>
    <td><span class="dsm-row-number"></span></td>
    <td>
      <input type="text" data-field="certName" class="form-control" placeholder="자격증명">
      <div class="invalid-feedback">자격증명은 필수입니다.</div>
    </td>
    <td>
      <select data-field="certType" class="form-select">
        <option value="IT">IT</option>
        <option value="LANG">어학</option>
        <option value="ETC">기타</option>
      </select>
    </td>
    <td><input type="text" data-field="certDate" class="form-control" placeholder="취득일"></td>
  </tr>
</template>

<%-- 그리드 --%>
<table class="table">
  <thead>
    <tr>
      <th><input type="checkbox" id="selectAll"></th>
      <th>번호</th><th>자격증명</th><th>종류</th><th>취득일</th>
    </tr>
  </thead>
  <tbody id="certGrid"></tbody>
</table>

<button type="button" id="btnAdd">행 추가</button>
<button type="button" id="btnRemove">선택 삭제</button>
<button type="button" id="btnSave">저장</button>
```

---

## Step 2 — UILayout 선언

화면별 UI 계약을 클래스로 선언합니다. `DomainVO`가 데이터 스키마를 선언하듯, `UILayout`은 UI 스키마를 선언합니다.

```javascript
import { UILayout } from '@2davi/rest-domain-state-manager';

class CertLayout extends UILayout {
    // 편집 모드에서 사용할 <template> 선택자
    static templateSelector = '#certRowTemplate';

    // lazy diff 시 항목 동일성 기준 필드 (LCS 알고리즘)
    static itemKey = 'certId';

    // 필드명 → DOM 요소 매핑
    static columns = {
        certName: {
            selector: '[data-field="certName"]',
            required: true,   // validate() 시 빈값 검증
        },
        certType: { selector: '[data-field="certType"]' },
        certDate: { selector: '[data-field="certDate"]' },
    };
}
```

---

## Step 3 — 초기화

```javascript
import {
    ApiHandler, DomainState, DomainCollection, UIComposer
} from '@2davi/rest-domain-state-manager';

// UIComposer 플러그인 설치 (앱 초기화 시 1회)
DomainState.use(UIComposer);

const api = new ApiHandler({ host: 'localhost:8080', basePath: '/app' });

// GET 응답 배열을 DomainCollection으로 변환
const certs = DomainCollection.fromJSONArray(
    await fetch('/app/api/certificates').then(r => r.text()),
    api
);
```

---

## Step 4 — 그리드 바인딩

```javascript
// 그리드 DOM에 DomainCollection을 바인딩하고 컨트롤 함수를 받습니다
const { addEmpty, removeChecked, validate, selectAll } =
    certs.bind('#certGrid', {
        layout:            CertLayout,
        mode:              'edit',         // 편집 모드
        selectAllSelector: '#selectAll',   // 전체선택 체크박스 연동
    });
```

바인딩 즉시:
- 기존 컬렉션 항목이 `<template>`을 복제하여 `#certGrid`에 렌더링됩니다
- 각 행의 `input`/`select` 변경이 즉시 `DomainState.data`에 반영됩니다 (양방향)
- 행 번호(`.dsm-row-number`)가 자동으로 1-based 번호로 채워집니다

---

## Step 5 — 버튼 연결

```javascript
document.getElementById('btnAdd').onclick    = addEmpty;
document.getElementById('btnRemove').onclick = removeChecked;

document.getElementById('btnSave').onclick = async () => {
    // required 필드 검증 — 빈값이면 is-invalid 클래스 추가
    if (!validate()) return alert('필수 항목을 입력하세요.');

    try {
        await certs.saveAll({
            strategy: 'batch',                // 배열 전체를 단일 요청으로
            path:     '/api/certificates',    // 엔드포인트
        });
        alert('저장되었습니다.');
    } catch (err) {
        // 실패 시 각 DomainState가 saveAll() 이전 상태로 자동 복원
        alert(`저장 실패: ${err.status} ${err.statusText}`);
    }
};
```

---

## 전체 흐름 요약

```javascript
import {
    ApiHandler, DomainState, DomainCollection,
    UIComposer, UILayout
} from '@2davi/rest-domain-state-manager';

DomainState.use(UIComposer);

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
    await fetch('/api/certificates').then(r => r.text()), api
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

---

## 기존 코드와 비교

| 항목 | 기존 jQuery 패턴 | DSM |
|---|---|---|
| 행 추가 | `fnAddRow()` 30~50줄 | `addEmpty` 한 줄 |
| 행 번호 재정렬 | `fnReindexRows()` 30~50줄 | 라이브러리 자동 처리 |
| 선택 삭제 | 인덱스 밀림 버그 반복 | `removeChecked` (LIFO 자동 보장) |
| DOM → 데이터 직렬화 | `fnSerialize()` 30~50줄 | `saveAll()` 자동 처리 |
| 배열 저장 | `$.ajax({ method: 'POST', data: ... })` | `saveAll({ strategy: 'batch', path })` |
| 실패 복원 | 수동 DOM 복원 또는 페이지 새로고침 | 자동 Optimistic Rollback |

---

## 다음 단계

- [DomainCollection 가이드](/guide/domain-collection) — `saveAll` 전략 및 lazy 모드 상세
- [UIComposer & UILayout](/guide/ui-composer) — `sourceKey`, `readonlyTemplateSelector`, `validate` 심화
- [Idempotency-Key](/guide/idempotency) — 네트워크 타임아웃 재시도 안전하게 처리하기
