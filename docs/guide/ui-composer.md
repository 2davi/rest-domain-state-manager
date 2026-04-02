# UIComposer & UILayout

<span class="badge badge-new">v1.4.0</span>

`UIComposer`는 `DomainCollection`과 HTML `<template>`을 연결하는 바인딩 플러그인입니다.  
`UILayout`은 화면별 UI 계약(템플릿 선택자, 컬럼 매핑)을 선언하는 베이스 클래스입니다.

---

## 설치

```javascript
import { DomainState, UIComposer } from '@2davi/rest-domain-state-manager';

// 앱 초기화 시 1회 설치
DomainState.use(UIComposer);
```

---

## UILayout 선언

`UILayout`을 상속하여 화면별 UI 계약을 선언합니다.

```javascript
import { UILayout } from '@2davi/rest-domain-state-manager';

class CertLayout extends UILayout {
    // ── 필수: 편집 모드 <template> 선택자
    static templateSelector = '#certRowTemplate';

    // ── 선택: 읽기 전용 모드 <template> 선택자
    //   미선언 시 mode: 'read'로 bind() 호출 → 즉시 에러
    static readonlyTemplateSelector = '#certRowReadTemplate';

    // ── lazy diff 기준 필드 (DomainCollection.fromJSONArray itemKey로 전달됨)
    static itemKey = 'certId';

    // ── 필드 → DOM 요소 매핑
    static columns = {
        certName: {
            selector: '[data-field="certName"]',
            required: true,  // validate() 시 빈값 is-invalid 처리
        },
        certType: {
            selector:         '[data-field="certType"]',
            sourceKey:        'certTypes',        // <select> 옵션 소스
            sourceValueField: 'codeId',
            sourceLabelField: 'codeName',
        },
        certDate: {
            selector: '[data-field="certDate"]',
            readOnly: true,  // input 이벤트 리스너 미등록
        },
    };
}
```

### columns 옵션 정리

| 옵션 | 타입 | 설명 |
|---|---|---|
| `selector` | `string` | **필수.** `<template>` 복제본 내 요소 CSS 선택자 |
| `required` | `boolean` | `true`이면 `validate()` 시 빈값 검증 |
| `readOnly` | `boolean` | `true`이면 input 이벤트 리스너 미등록 |
| `sourceKey` | `string` | `<select>` 옵션 소스 컬렉션 키 |
| `sourceValueField` | `string` | `<option value>` 기준 필드명 (기본 `'id'`) |
| `sourceLabelField` | `string` | `<option>` 텍스트 기준 필드명 (기본 `'name'`) |

---

## DomainCollection.bind()

`UIComposer` 설치 후 `DomainCollection`에 `bind()` 메서드가 추가됩니다.

```javascript
const { addEmpty, removeChecked, removeAll, selectAll, validate, destroy } =
    certs.bind('#certGrid', {
        layout:            CertLayout,
        mode:              'edit',         // 'edit' | 'read'
        sources:           { certTypes: certTypeCollection },  // sourceKey 소스 맵
        selectAllSelector: '#selectAll',   // 전체선택 체크박스 연동
    });
```

### 반환되는 컨트롤 함수

| 함수 | 설명 |
|---|---|
| `addEmpty()` | 빈 행 추가. 생성된 `DomainState` 반환. |
| `removeChecked()` | 체크된 행 역순(LIFO) 제거 |
| `removeAll()` | 전체 행 제거 |
| `selectAll(checked)` | 전체 선택/해제 |
| `invertSelection()` | 선택 반전 |
| `validate()` | required 필드 검증. 유효하면 `true`. |
| `getCheckedItems()` | 체크된 `DomainState[]` 반환 |
| `getItems()` | 전체 `DomainState[]` 반환 |
| `getCount()` | 총 항목 수 반환 |
| `destroy()` | 이벤트 리스너 정리 |

---

## sourceKey — `<select>` 옵션 자동 채우기

`columns`에 `sourceKey`를 선언하고, `bind()` 호출 시 `sources`로 소스 컬렉션을 주입합니다.

```javascript
// 코드 목록을 서버에서 조회
const certTypes = DomainCollection.fromJSONArray(
    await fetch('/api/codes?group=CERT_TYPE').then(r => r.text()),
    api
);

// bind() 시 sources로 주입
const controls = certs.bind('#certGrid', {
    layout:  CertLayout,
    sources: { certTypes },  // CertLayout.columns.certType.sourceKey와 매칭
});
```

`sources`에 선언된 `sourceKey`가 없으면 즉시 에러를 throw합니다. Silent Failure를 허용하지 않습니다.

---

## readonlyTemplateSelector — 읽기 전용 모드

```javascript
class CertLayout extends UILayout {
    static templateSelector         = '#certEditTemplate';
    static readonlyTemplateSelector = '#certReadTemplate'; // ← 필수 선언
}

// 읽기 전용으로 바인딩
const controls = certs.bind('#certGrid', {
    layout: CertLayout,
    mode:   'read',  // readonlyTemplateSelector 사용, 이벤트 리스너 미등록
});
```

`readonlyTemplateSelector`를 선언하지 않고 `mode: 'read'`를 사용하면 즉시 명확한 에러를 throw합니다.

---

## DomainState.bindSingle() — 단일 폼 바인딩

단일 `DomainState`를 HTML 폼에 양방향 바인딩합니다.

```javascript
import { UILayout } from '@2davi/rest-domain-state-manager';

class UserFormLayout extends UILayout {
    static columns = {
        name:  { selector: '[name="userName"]' },
        email: { selector: '[name="userEmail"]' },
        role:  { selector: '[name="userRole"]' },
    };
}

const { unbind } = user.bindSingle('#userForm', { layout: UserFormLayout });

// 컴포넌트 언마운트 시 이벤트 리스너 정리
unbind();
```

---

## FormBinder / DomainRenderer와의 관계

::: warning deprecated
`FormBinder`와 `DomainRenderer`는 v1.4.0에서 deprecated 되었습니다.  
v2.x에서 제거 예정입니다. `UIComposer`로 전환을 권장합니다.

[전환 가이드 →](/guide/migration-v2)
:::

| 플러그인 | 방향 | 대체 |
|---|---|---|
| `FormBinder` | DOM → State | `bindSingle()` |
| `DomainRenderer` | State → DOM (단방향) | `bind()` (양방향) |
| `UIComposer` | 양방향 | — |

---

## 다음 단계

- [DomainCollection 가이드](/guide/domain-collection) — `saveAll`, `add`, `remove` 상세
- [SI 빠른 시작](/guide/si-quickstart) — 전체 JSP 그리드 예제
- [전환 가이드](/guide/migration-v2) — FormBinder → UIComposer
