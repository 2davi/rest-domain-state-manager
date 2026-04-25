# UIComposer & UILayout — src/ui/ Layer (2026-03-31)

> **Milestone:** `v1.4.x`
> **Branch:** `feature/ui-composer`
> **References:** `ard-0003-alignment.md § 6.2`, `ard-0002-alignment.md § 4.3 ~ 4.4`, `ard-0002-extensions.md § 4부 ~ 8부`

---

## (a) 현행 코드 진단

### 기존 플러그인의 방향 충돌

```text
FormBinder:
  DOM이 먼저 있고 State가 그것을 읽는 구조.
  개발자가 이미 작성한 <form>과 DomainState를 연결.
  DOM → State 방향.

DomainRenderer:
  State가 먼저 있고 DOM이 그것을 따라가는 구조.
  DomainCollection(또는 서버 응답 배열)을 <select>, <input type="radio">에 렌더링.
  State → DOM 방향.

CollectionBinder (신규):
  State 기반으로 그리드 DOM을 동적으로 생성하고 조작.
  State → DOM 방향.
```

`FormBinder`는 방향이 반대다. 세 역할을 하나의 플러그인에 억지로 합치면
"지금 내가 DOM을 읽어야 하나, 만들어야 하나"를 매 함수마다 분기해야 하는 내부 혼란이 생긴다.

### `plugins/` 레이어의 한계

`FormBinder`와 `DomainRenderer`는 편의 유틸 플러그인이다.
`UIComposer`는 애플리케이션 아키텍처에서 **view 레이어 자체를 선택적으로 위임할지 결정하는** 플러그인이다.
같은 `plugins/` 레이어에 두는 것은 무게감의 혼동이다.

### JS 객체 기반 태그 선언 방식 폐기 사유

이전 설계에서 `static item = { tag: 'tr', cellTag: 'td' }` 형태로
JS 객체에 태그 이름을 하드코딩하고 라이브러리가 `document.createElement`로 DOM을 빚어내는 방식을 검토했으나
**전면 반려**했다.

SI 환경 화면은 `<td>` 안에 `<div>`가 3개 들어가고 그 안에 `<span>`이 껴있는 구조가 일상적이다.
이를 JS 속성으로 표현하려 들면 `childTag`, `wrapperTag` 등 속성이 끝없이 늘어나
감당 불가 수준에 도달한다.

**결정: HTML `<template>` 요소 기반으로 전면 교체한다.**
라이브러리는 HTML 구조를 생성하지 않는다. 통제권은 HTML 작성자에게 있다.

---

## (b) 목표 아키텍처 설계

### `src/ui/` 레이어 신설

```text
src/
├── common/
├── constants/
├── core/
├── domain/
├── network/
├── debug/
├── workers/
├── plugins/       ← 편의 플러그인 (v2.0.0에서 deprecated 예정)
│   ├── domain-renderer/
│   └── form-binder/
└── ui/            ← 신규 레이어
    ├── UIComposer.js
    ├── UILayout.js
    ├── binder/        ← FormBinder 역할 흡수
    ├── renderer/      ← DomainRenderer 역할 흡수
    └── collection/    ← CollectionBinder 신규
```

`plugins/`는 삭제하지 않는다. 향후 Vue, React 등 프레임워크 어댑터를 배치하는 공간으로 역할 재정의.

### `UILayout` — HTML Template-Driven Binding

```text
DomainVO    → 데이터 계약 선언 ("이 도메인의 필드 구조는 이렇다")
UILayout    → UI 계약 선언   ("이 데이터를 화면에 이렇게 표현한다")
```

```javascript
class CertificateEditLayout extends UILayout {
    static templateSelector         = '#certRowTemplate';       // 편집 모드 템플릿
    static readonlyTemplateSelector = '#certRowReadTemplate';   // 읽기 모드 템플릿 (선택)
    static itemKey  = 'certId';  // lazy diff 기준 필드. v1.2.x LCS diff 연결.

    static columns = {
        certId:   { selector: '[data-field="certId"]' },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: {
            selector:  '[data-field="certType"]',
            sourceKey: 'certTypes',  // 런타임에 DomainCollection이 주입될 key
        },
    };
}
```

`UIComposer`가 설치되지 않은 상태에서 `bind()` 또는 `bindCollection()`이 호출되면
즉시 Error를 throw한다. 에러 메시지에 "UIComposer 플러그인을 먼저 설치하세요"를 명시.

### `readonlyTemplateSelector` 미선언 시 에러 처리

`mode: 'read'`로 `bindCollection()` 호출 시 `readonlyTemplateSelector`가 선언되지 않았으면
즉시 Error를 throw한다. 조용히 잘못된 레이아웃을 렌더링하는 Silent Failure를 허용하지 않는다.

```text
// 에러 메시지 예시
[DSM] UIComposer.bindCollection(): mode: 'read'로 호출했으나
CertificateEditLayout에 readonlyTemplateSelector가 선언되지 않았습니다.
읽기 전용 템플릿을 static readonlyTemplateSelector = '#certRowReadTemplate' 형태로 선언하세요.
```

### `sourceKey` 패턴 — 정적 선언과 런타임 주입 분리

`UILayout`은 코드 작성 시점에 선언된다.
`certTypes` DomainCollection은 `DomainPipeline.run()` 이후 런타임에야 존재한다.
정적 선언이 런타임 데이터를 직접 참조할 수 없다.

```javascript
// bind() 호출 시 sources로 주입 — sourceKey 'certTypes'와 실제 컬렉션 연결
result.certificate.bindCollection('#certGrid', {
    layout:  CertificateEditLayout,
    sources: { certTypes: result.certTypes },
    mode:    'edit',
});
```

### `bindCollection()` 컨트롤 함수 반환 패턴

라이브러리는 어떤 버튼이나 체크박스가 존재하는지 알지 못하며, 알아서도 안 된다.
이벤트 바인딩의 주도권은 개발자에게 있다.

```javascript
const {
    addEmpty:      newCertificate,
    removeChecked: deleteCertificates,
    selectAll:     checkAll,
    validate:      validateCerts,
} = userState.bindCollection('certificateList', '#certGrid', {
    layout:  CertificateEditLayout,
    sources: { certTypes: certTypeCollection },
    mode:    'edit',
});

$('#btnAdd').on('click', newCertificate);
$('#btnRemove').on('click', deleteCertificates);
$('#checkboxAll').on('change', (e) => checkAll(e.target.checked));
```

개별 행 체크박스(`selectOne`)는 동적 DOM이므로 이벤트 위임으로 내부 자동 처리.
소비자가 직접 바인딩하는 것은 허용하지 않는다.

### CollectionBinder MVP 기능 목록

>
> **[기본 행 조작] — MVP:**

- `addEmpty()`: DomainCollection.add() + `<template>` 복제 + DOM 삽입 + 행 번호 갱신
- `removeChecked()`: 체크 행 인덱스 수집 → **역순 정렬** → DomainCollection.remove() + DOM 제거
- `removeAll()`: 전체 삭제
- `selectAll(checked)`: 전체 `.dsm-checkbox` 상태 설정
- `invertSelection()`: 선택 반전

>
> **[UI 보조] — MVP (내부 자동 처리):**

- 행 번호 자동 갱신
- 전체선택 체크박스 상태 동기화

>
> **[유효성 검사] — MVP:**

- `validate()`: `UILayout.columns`의 `required` 필드 순회 → 빈 값 행에 invalid-feedback 표시 → 전체 유효성 여부 반환

>
> **[행 순서 조작] — Extends (patch 버전):**

- `moveUp()`, `moveDown()`, 드래그 앤 드롭 정렬

>
> **[데이터 조작] — Extends (patch 버전):**

- `duplicateChecked()`: 선택 행 복사
- 선택 행 특정 필드 일괄 변경

### `FormBinder` / `DomainRenderer` deprecated 처리

v1.4.x 릴리즈 시점에 두 플러그인의 JSDoc에 `@deprecated` 태그를 추가한다.
사용 시 `console.warn`으로 안내 메시지 출력.
즉각 제거하지 않는다. migration guide 작성 후 v2.0.0에서 공식 deprecated.

---

## (c) 변경 파일별 세부 분석

### `src/ui/UILayout.js` — 신규 생성

```text
UILayout base class 공개 인터페이스

static templateSelector?         CSS 선택자: <template> 요소 (편집 모드)
static readonlyTemplateSelector? CSS 선택자: <template> 요소 (읽기 모드)
static itemKey?                  lazy diff 기준 필드명. 미선언 시 positional fallback.
static columns                   { fieldName: { selector, sourceKey?, required?, readOnly? } }
```

### `src/ui/UIComposer.js` — 신규 생성

```text
DomainState.use(UIComposer) 호출 시 plugin.install(DomainState)가 실행되어
다음 메서드를 DomainState.prototype에 주입한다:

  prototype.bind(containerSelector, options)
    → FormBinder 역할 흡수. UILayout, sources, mode 옵션 수용.

  prototype.bindCollection(fieldNameOrSelector, containerSelector, options)
    → CollectionBinder. Nested Array용.
       fieldName이 string: 부모 DomainState의 필드 배열과 연결 (Nested)
       fieldName이 없음: DomainCollection 직접 바인딩 (Root)

  DomainCollection.prototype.bind(containerSelector, options)
    → Root Array용. 동일 인터페이스.
```

### `src/ui/collection/` 내부 모듈 — 신규 생성

CollectionBinder 로직을 `UIComposer`의 내부 모듈로 처음부터 설계한다.
외부에는 `UIComposer` 이름으로만 노출한다.
v1.4.x 단계에서 CollectionBinder를 독립 플러그인으로 외부에 노출하면,
v2.0.0에서 흡수할 때 소비자가 migration 비용을 두 번 치른다.

### `index.js` — export 갱신

```javascript
import { UIComposer } from './src/ui/UIComposer.js';
import { UILayout }   from './src/ui/UILayout.js';

export {
    ApiHandler,
    DomainState, DomainVO, DomainCollection, DomainPipeline,
    UIComposer, UILayout,      // ← 추가
    DomainRenderer, FormBinder,  // ← deprecated 처리된 채로 유지
    closeDebugChannel,
};
```

### CollectionBinder guard 수치 결정 (v1.4.x 완료 후)

`ard-0003-alignment.md § 6.3`에 따라 구현 완료 후 `performance.measure()`로 실측한다.

| 측정 대상                                 | 측정 지점                                |
| ----------------------------------------- | ---------------------------------------- |
| `addEmpty()` 100회 연속 실행 시 누적 시간 | DOM 삽입 + `DomainCollection.add()` 포함 |
| `save()` 직전 `structuredClone` 시간      | 행 100개 × 필드 10개 기준                |

50ms(Long Task 기준) 초과 행 수 확인 후 `console.warn` 임계값으로 설정.

---

## (d) 예상 시나리오

### SI 구원자 트랙 — JSP 화면 최종 형태

```html
<template id="certRowTemplate">
    <tr class="cert-row">
        <td>
            <input type="checkbox" class="dsm-checkbox">
            <input type="hidden" data-field="certId">
        </td>
        <td><input type="text" class="form-control" data-field="certName"></td>
        <td><select class="custom-select" data-field="certType"></select></td>
    </tr>
</template>
```

```javascript
import { DomainState, ApiHandler, UIComposer, UILayout } from '@2davi/rest-domain-state-manager';

DomainState.use(UIComposer);

class CertLayout extends UILayout {
    static templateSelector = '#certRowTemplate';
    static itemKey = 'certId';
    static columns = {
        certId:   { selector: '[data-field="certId"]' },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: { selector: '[data-field="certType"]', sourceKey: 'certTypes' },
    };
}

const api = new ApiHandler({ host: 'localhost:8080' });

const [certTypes, certs] = await Promise.all([
    DomainState.fromJSONArray(await fetch('/api/cert-types').then(r => r.text()), api),
    DomainState.fromJSONArray(await fetch('/api/certificates').then(r => r.text()), api),
]);

const { addEmpty, removeChecked, validate } = certs.bindCollection('#certGrid', {
    layout:  CertLayout,
    sources: { certTypes },
    mode:    'edit',
});

document.getElementById('btnAdd').onclick    = addEmpty;
document.getElementById('btnRemove').onclick = removeChecked;
document.getElementById('btnSave').onclick = async () => {
    if (!validate()) return;
    await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
};
```

### `sourceKey` 연결 실패 시 에러

```text
bind() 내부에서 sources['certTypes'] 조회
  → sources 옵션에 'certTypes' 없음
  → throw Error(
      '[DSM] UIComposer.bindCollection(): UILayout.columns.certType에 선언된 ' +
      'sourceKey "certTypes"가 sources 옵션에 없습니다. ' +
      'bindCollection() 호출 시 sources: { certTypes: certTypeCollection }을 전달하세요.'
    )
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일                                            | 변경 종류     | 변경 내용                                                                                      |
| ----------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `src/ui/UILayout.js`                            | **신규 생성** | base class, static fields 선언, UIComposer 미설치 에러 throw                                   |
| `src/ui/UIComposer.js`                          | **신규 생성** | install() 메서드, bind/bindCollection 주입 로직                                                |
| `src/ui/binder/`                                | **신규 생성** | FormBinder 역할 흡수 내부 모듈                                                                 |
| `src/ui/renderer/`                              | **신규 생성** | DomainRenderer 역할 흡수 내부 모듈                                                             |
| `src/ui/collection/`                            | **신규 생성** | CollectionBinder MVP: addEmpty, removeChecked, removeAll, selectAll, invertSelection, validate |
| `index.js`                                      | **수정**      | UIComposer, UILayout import + export 추가                                                      |
| `src/plugins/form-binder/FormBinder.js`         | **수정**      | `@deprecated` JSDoc 추가 + `console.warn` 안내                                                 |
| `src/plugins/domain-renderer/DomainRenderer.js` | **수정**      | `@deprecated` JSDoc 추가 + `console.warn` 안내                                                 |
| `src/constants/error.messages.js`               | **수정**      | UIComposer 미설치 에러, readonlyTemplateSelector 미선언 에러, sourceKey 미주입 에러 상수 추가  |
| `tests/ui/UIComposer.test.js`                   | **신규 생성** | addEmpty, removeChecked, sourceKey 연결, validate, deprecated 경고 테스트                      |
| `tests/ui/UILayout.test.js`                     | **신규 생성** | UIComposer 미설치 에러, readonlyTemplateSelector 미선언 에러 테스트                            |

### Feature 브랜치명

```text
feature/ui-composer
```

### Commit Sequence

```markdown
# STEP A — src/ui/ 레이어 구조 및 UILayout base class 생성
feat(ui): create src/ui/ layer and UILayout base class

  - src/ui/ 디렉토리 구조 신설
  - UILayout.js: static templateSelector, readonlyTemplateSelector, itemKey, columns 선언
  - UIComposer 미설치 시 bind()/bindCollection() → Error throw
  - readonlyTemplateSelector 미선언 + mode: 'read' → Error throw
  - index.js UILayout export 추가
  - 에러 메시지 상수 추가 (error.messages.js)


# STEP B — CollectionBinder MVP 구현
feat(ui): implement CollectionBinder MVP in src/ui/collection/

  - addEmpty(): DomainCollection.add() + <template> 복제 + DOM 삽입 + 행 번호 갱신
  - removeChecked(): 역순(LIFO) splice + DOM 제거
  - removeAll(): 전체 삭제
  - selectAll(checked): .dsm-checkbox 전체 상태 설정
  - invertSelection(): 선택 반전
  - selectOne: 이벤트 위임으로 내부 자동 처리 (소비자 바인딩 불가)
  - 행 번호 자동 갱신 (내부 자동)
  - 전체선택 체크박스 상태 동기화 (내부 자동)


# STEP C — validate() + sourceKey 연결
feat(ui): add validate() and sourceKey injection to CollectionBinder

  - validate(): required 필드 순회 → invalid-feedback 표시 → boolean 반환
  - sources 옵션 처리: sourceKey → DomainCollection → <option> 생성
  - sourceKey 미주입 → 명확한 Error throw (Silent Failure 불허)


# STEP D — UIComposer 플러그인 통합
feat(ui): implement UIComposer plugin installing bind/bindCollection

  - UIComposer.js: install(DomainState) 메서드
  - DomainState.prototype.bind() 주입 (FormBinder 흡수)
  - DomainState.prototype.bindCollection() 주입 (CollectionBinder 연결)
  - DomainCollection.prototype.bind() 주입 (Root Array용)
  - DomainRenderer 역할: sources + type='select' 분기로 bind() 내부에 흡수
  - index.js UIComposer export 추가


# STEP E — FormBinder / DomainRenderer deprecated 처리
chore(plugins): deprecate FormBinder and DomainRenderer

  - FormBinder.js: @deprecated JSDoc + console.warn 안내 메시지
  - DomainRenderer.js: @deprecated JSDoc + console.warn 안내 메시지
  - 즉각 제거 없음. v2.0.0에서 공식 제거 예정.


# STEP F — Vitest 통합 테스트 작성
test(ui): add UIComposer and UILayout integration tests

  - addEmpty() 후 DomainCollection.getCount() 증가 + DOM <tr> 추가 확인
  - removeChecked() 역순 splice: 2개 선택 삭제 시 올바른 항목 제거 확인
  - sourceKey 연결: sources 주입 후 <select> <option> 수 == DomainCollection 항목 수 확인
  - sourceKey 미주입 에러: Error throw 확인
  - validate(): required 빈 행 → false 반환 + invalid-feedback 표시 확인
  - UIComposer 미설치 bind() → Error throw 확인
  - deprecated 경고: DomainState.use(FormBinder) 시 console.warn 발화 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                    | 기준                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `npm run lint`          | error 0건                                                               |
| `npm test`              | 전체 테스트 통과 (기존 TC 회귀 없음)                                    |
| `addEmpty()`            | DomainCollection.getCount() 증가 + DOM에 `<tr>` 추가 확인               |
| `removeChecked()` 역순  | 2개 동시 삭제 시 올바른 항목만 제거 확인                                |
| `sourceKey` 연결        | sources 주입 후 `<select>` 내 `<option>` 수 == DomainCollection 항목 수 |
| `sourceKey` 미주입      | Error throw 확인 (Silent Failure 없음)                                  |
| `validate()`            | required 필드 빈 행 → `false` 반환 + invalid-feedback 표시              |
| `mode: 'read'` + 미선언 | `readonlyTemplateSelector` 없을 때 Error throw                          |
| FormBinder `use()`      | `console.warn` deprecated 안내 발화 확인                                |
| guard 수치              | `performance.measure()` 실측 완료 + 임계값 결정 후 릴리즈               |
