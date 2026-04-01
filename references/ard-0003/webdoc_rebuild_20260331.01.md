# WebDoc Rebuild (2026-03-31)

> **Milestone:** `v1.6.x`
> **Branch:** `chore/webdoc-rebuild`
> **References:** `ard-0003-alignment.md § 5`, `§ 7 (v1.6.x)`, `ard-0001-alignment.md § 7`

---

## (a) 현행 문서 상태 진단

### VitePress 문서의 현재 상태

```text
현재 문서 구조 (개략)

  docs/
  ├── index.md             ← 라이브러리 소개. VO 필수 뉘앙스 남아있음.
  ├── guide/
  │   ├── getting-started.md  ← 단일 진입점. Two-Track 분기 없음.
  │   └── ...
  └── api/                 ← TypeDoc 자동 생성. v1.4.x 이전 기준.
```

### 두 가지 핵심 문제

**문제 1 — Single-Track 문서 구조:**
현재 README와 Getting Started는 타겟 유저를 구분하지 않는다.
JSP 개발자와 React 개발자 모두에게 동일한 흐름으로 시작하게 안내한다.
`ard-0003-alignment.md § 5.3`에서 결정된 Two-Track README 분기 구조가 반영되어 있지 않다.

**문제 2 — TypeDoc 기준점 불일치:**
v1.4.x까지 추가된 `DomainCollection`, `UIComposer`, `UILayout`이
TypeDoc 문서에 반영되어 있지 않다.
v1.5.x에서 JSDoc 정비가 완료된 상태에서 TypeDoc을 재생성해야 완전한 API 레퍼런스가 된다.

### VitePress Interactive Playground

기존 Playground 컴포넌트는 v1.0.0 API 기준으로 작성되어 있다.
`trackingMode`, `bindCollection()`, `saveAll()` 등 신규 API를 반영해야 한다.

---

## (b) 목표 문서 구조 설계

### README Two-Track 분기 구조

```markdown
# REST Domain State Manager

> Proxy 기반 REST API 도메인 상태 관리자.
> HTTP 메서드 자동 분기, JSON Patch 직렬화, 보상 트랜잭션을 단 몇 줄로.

## 어떤 환경에서 쓰시나요?

### JSP / 레거시 환경 → [빠른 시작: 그리드 UI](#si-quickstart)
Spring Boot + JSP + jQuery 환경에서 1:N 폼 그리드를 10줄로 만드세요.
`fnAddRow()`, `fnRemoveRow()`, `fnReindexRows()` — 전부 사라집니다.

### React / Vue → [빠른 시작: 훅 연동](#modern-quickstart)
`useDomainState()` 한 줄로 GET → 수정 → PATCH 사이클을 자동화하세요.
fetch, useState, useEffect, 롤백 로직 — 전부 사라집니다.
```

### VitePress 문서 목차 재설계

```text
docs/
├── index.md               ← 랜딩. Two-Track 즉시 분기.
├── guide/
│   ├── si-quickstart.md   ← SI 트랙 Quick Start (신규)
│   │   예제: JSP 화면에서 <template> + bindCollection() 10줄 그리드
│   ├── modern-quickstart.md ← 모던 트랙 Quick Start (신규)
│   │   예제: React 컴포넌트 + useDomainState() 한 줄 연결
│   ├── core-concepts.md   ← DomainState, DomainVO(선택), DomainPipeline 개념
│   ├── domain-collection.md ← DomainCollection + saveAll (신규)
│   ├── ui-composer.md     ← UIComposer + UILayout + CollectionBinder (신규)
│   ├── tracking-modes.md  ← realtime vs lazy trackingMode 비교 (신규)
│   ├── idempotency.md     ← Idempotency-Key 사용 가이드 (신규)
│   └── migration-v2.md    ← FormBinder/DomainRenderer → UIComposer 전환 가이드 (신규)
├── api/                   ← TypeDoc 자동 생성 (v1.5.x JSDoc 기준 재생성)
└── .vitepress/
    └── config.js          ← 사이드바 구조 갱신
```

### SI Quick Start 예제 페이지 핵심 내용

v1.4.x에서 구현된 SI 구원자 트랙 시나리오(`ard-0003-alignment.md § 5.1`)를 그대로 예제로 사용한다.

```text
si-quickstart.md 구성

  1. 설치 (npm install)
  2. HTML <template> 선언 (코드 블록 전체)
  3. JS 연결 코드 (import + DomainState.use(UIComposer) + bindCollection())
  4. 버튼 연결 (addEmpty, removeChecked, save)
  5. "기존에 이랬던 코드가 이렇게 바뀐다" 비교표
     fnAddRow() 50줄 → addEmpty 한 줄
     fnReindexRows() 50줄 → 라이브러리 자동 처리
     serialize() → saveAll(batch) 한 줄
```

### 모던 Quick Start 예제 페이지 핵심 내용

v1.0.0부터 이미 동작하는 React 어댑터 예제를 중심으로 구성한다.

```text
modern-quickstart.md 구성

  1. 설치 (npm install)
  2. ApiHandler 생성 (한 줄)
  3. useDomainState() 예제 (React 컴포넌트 전체)
  4. 자동으로 처리되는 것들 목록
     - GET → DomainState 변환
     - data.name = '...' → changeLog 자동 기록
     - save() → PATCH 자동 분기
     - 실패 → 자동 롤백 (useState 없이)
  5. lazy 모드 옵션 소개 (1줄 추가로 성능 최적화)
```

### VitePress Interactive Playground 갱신

기존 Playground 컴포넌트를 두 버전으로 분리한다:

| 컴포넌트 | 트랙 | 보여주는 것 |
|---|---|---|
| `DomainStatePlayground.vue` | 모던 트랙 | `fromJSON()` + `data` 조작 + `getSnapshot()` 실시간 표시 |
| `CollectionPlayground.vue` | SI 트랙 | `DomainCollection` + `addEmpty()` + `removeChecked()` |

문서 페이지 내에서 Form을 수정하면 BroadcastChannel 디버그 패널이 즉각 반응하는 시각적 데모는 유지한다.

---

## (c) 변경 파일별 세부 분석

### `README.md` — 전면 개편

| 섹션 | 변경 내용 |
|---|---|
| 최상단 | Two-Track 즉시 분기 문구 추가 |
| SI Quick Start | 새 코드 예제로 교체 (`<template>` + `bindCollection()`) |
| 모던 Quick Start | `useDomainState()` 예제 유지, trackingMode 옵션 추가 소개 |
| DomainVO 소개 | "선택적 레이어" 명시. 기본 예제에서 VO 제거. |
| API 요약 테이블 | `DomainCollection`, `UIComposer`, `UILayout`, `trackingMode` 추가 |
| CSRF / Idempotency | 초기화 방법 및 사용 시나리오 섹션 추가 |

### `docs/guide/` — 신규 파일 생성

신규 생성 파일: `si-quickstart.md`, `modern-quickstart.md`, `domain-collection.md`, `ui-composer.md`, `tracking-modes.md`, `idempotency.md`, `migration-v2.md`

`migration-v2.md` 핵심 내용:

```text
FormBinder → UIComposer 전환 가이드

Before (deprecated):
  DomainState.use(FormBinder);
  state.syncToForm('#myForm');

After (UIComposer):
  DomainState.use(UIComposer);
  state.bind('#myForm', { layout: MyLayout });
```

### `docs/api/` — TypeDoc 재생성

v1.5.x에서 JSDoc 정비가 완료된 상태에서 `npm run docs:api`를 실행한다.
신규 클래스(`DomainCollection`, `UIComposer`, `UILayout`) 문서 자동 생성.
deprecated 클래스(`FormBinder`, `DomainRenderer`)에 deprecated 배너 자동 표시.

### `.vitepress/config.js` — 사이드바 갱신

```javascript
// 사이드바 구조 변경 요약
sidebar: [
  {
    text: '빠른 시작',
    items: [
      { text: 'JSP / 레거시 환경', link: '/guide/si-quickstart' },
      { text: 'React / Vue', link: '/guide/modern-quickstart' },
    ]
  },
  {
    text: '핵심 개념',
    items: [
      { text: 'DomainState', link: '/guide/core-concepts' },
      { text: 'DomainCollection', link: '/guide/domain-collection' },
      { text: 'UIComposer & UILayout', link: '/guide/ui-composer' },
      { text: '추적 모드 (realtime / lazy)', link: '/guide/tracking-modes' },
      { text: 'Idempotency-Key', link: '/guide/idempotency' },
    ]
  },
  {
    text: '마이그레이션',
    items: [
      { text: 'v2.0.0으로 이전하기', link: '/guide/migration-v2' },
    ]
  },
]
```

---

## (d) 예상 시나리오

### 시나리오 1. JSP 신입 개발자 첫 방문 흐름

```text
README 랜딩
  → "JSP / 레거시 환경" 링크 클릭
  → si-quickstart.md
  → <template> 코드 복사 → JSP에 붙여넣기
  → JS 5줄 복사 → 동작 확인
  → "기존 fnAddRow() 50줄이 이 한 줄로" 비교표에서 wow 경험
  → 추가 학습: ui-composer.md, core-concepts.md
```

### 시나리오 2. React 개발자 첫 방문 흐름

```text
README 랜딩
  → "React / Vue" 링크 클릭
  → modern-quickstart.md
  → useDomainState() 예제 복사
  → "useState 없음, useEffect 없음, 롤백 로직 없음" 확인
  → 추가 학습: tracking-modes.md (lazy 모드로 성능 최적화)
```

### 시나리오 3. 기존 소비자 마이그레이션 흐름

```text
FormBinder 사용 중 deprecated 경고 콘솔에서 확인
  → migration-v2.md 링크 클릭
  → Before/After 코드 비교
  → UIComposer로 전환 완료
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일 | 변경 종류 | 변경 내용 |
|---|---|---|
| `README.md` | **수정** | Two-Track 분기 구조 전면 개편, 신규 API 추가, DomainVO 선택적 포지셔닝 |
| `docs/index.md` | **수정** | 랜딩 Two-Track 즉시 분기 추가 |
| `docs/guide/si-quickstart.md` | **신규 생성** | JSP 트랙 Quick Start |
| `docs/guide/modern-quickstart.md` | **신규 생성** | React/Vue 트랙 Quick Start |
| `docs/guide/domain-collection.md` | **신규 생성** | DomainCollection 사용 가이드 |
| `docs/guide/ui-composer.md` | **신규 생성** | UIComposer + UILayout + CollectionBinder 사용 가이드 |
| `docs/guide/tracking-modes.md` | **신규 생성** | realtime vs lazy 비교 및 선택 기준 |
| `docs/guide/idempotency.md` | **신규 생성** | Idempotency-Key 활성화 및 재시도 패턴 |
| `docs/guide/migration-v2.md` | **신규 생성** | FormBinder/DomainRenderer → UIComposer 전환 가이드 |
| `docs/api/` | **재생성** | TypeDoc `npm run docs:api` 실행 (v1.5.x JSDoc 기준) |
| `.vitepress/config.js` | **수정** | 사이드바 구조 갱신 |
| `docs/.vitepress/components/` | **수정** | DomainStatePlayground.vue, CollectionPlayground.vue 갱신 |

### Feature 브랜치명

```text
chore/webdoc-rebuild
```

### Commit Sequence

```markdown
# STEP A — README Two-Track 구조 전면 개편
docs: restructure README with Two-Track quick start paths

  - 최상단 Two-Track 즉시 분기 문구 추가
  - SI Quick Start: <template> + bindCollection() 예제로 교체
  - 모던 Quick Start: useDomainState() 예제 유지, trackingMode 소개 추가
  - DomainVO: 선택적 레이어로 재포지셔닝
  - 신규 API (DomainCollection, UIComposer, UILayout, trackingMode) 요약 테이블 추가


# STEP B — VitePress 신규 가이드 페이지 작성
docs: add si-quickstart, modern-quickstart, and core guide pages

  - docs/guide/si-quickstart.md: JSP 트랙 전체 예제
  - docs/guide/modern-quickstart.md: React 트랙 전체 예제
  - docs/guide/domain-collection.md: DomainCollection 사용 가이드
  - docs/guide/tracking-modes.md: realtime/lazy 비교
  - docs/guide/idempotency.md: Idempotency-Key 가이드


# STEP C — UIComposer 가이드 및 migration 문서 작성
docs: add ui-composer guide and migration-v2 guide

  - docs/guide/ui-composer.md: UIComposer + UILayout + CollectionBinder 가이드
  - docs/guide/migration-v2.md: FormBinder/DomainRenderer → UIComposer 전환 안내
  - Before/After 코드 비교 포함


# STEP D — TypeDoc API 레퍼런스 재생성
docs: regenerate TypeDoc API reference based on v1.5.x JSDoc

  - npm run docs:api 실행
  - DomainCollection, UIComposer, UILayout 문서 자동 생성 확인
  - deprecated 클래스 배너 표시 확인
  - docs/api/ 갱신 커밋


# STEP E — VitePress 사이드바 및 Playground 갱신
docs: update VitePress sidebar and Interactive Playground components

  - .vitepress/config.js 사이드바 구조 갱신
  - DomainStatePlayground.vue: trackingMode 옵션 반영
  - CollectionPlayground.vue: addEmpty/removeChecked 데모 추가
  - 문서 내 BroadcastChannel 디버그 패널 연동 유지
```

---

## (f) 검증 기준 (Definition of Done)

| 항목 | 기준 |
|---|---|
| `npm run docs:build` | 에러 없이 완료 |
| TypeDoc 빌드 | DomainCollection, UIComposer, UILayout 페이지 생성 확인 |
| README 첫 화면 | Two-Track 분기 문구 노출 확인 |
| SI Quick Start | JSP 예제 코드 복사 후 10분 내 동작 가능 수준 |
| 모던 Quick Start | React 예제 코드 복사 후 5분 내 동작 가능 수준 |
| DomainVO 포지셔닝 | README 기본 예제에서 VO 없는 흐름 우선 표시 확인 |
| migration 문서 | FormBinder Before → UIComposer After 코드 비교 존재 확인 |
| Playground | DomainStatePlayground, CollectionPlayground 정상 동작 확인 |
| 깨진 링크 | `vitepress build` 후 dead link 0건 확인 |
