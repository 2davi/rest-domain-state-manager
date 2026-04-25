# Rebuild VitePress WebDoc (2026-03-23)

## (a) 전체 작업 트리

```text
5-A. 인프라 셋업           ← CSS/테마 깨진 것 수정, theme/ 구조 구축
5-B. 메뉴 구조 재편        ← config.mts 전면 교체
5-C. 핵심 페이지 재작성    ← 내용 틀린 것 먼저, 철학 페이지 신규
5-D. Playground 구현       ← MockApiHandler + 6개 Vue 컴포넌트
5-E. 나머지 가이드 재작성  ← 엑셀 TC 연동
5-F. Architecture RFC 재작성
5-G. Decision Log 공개 문서화
5-H. README 재작성
```

## (b) WebDoc 아키텍처 설계

### 메뉴 구조도

```text
docs/
├── index.md                    ← 랜딩 페이지 (Before/After + 철학 snippet)
│
├── guide/
│   ├── installation.md         ← 1-1: 설치 (npm + CDN + 폴더 복사 3가지)
│   ├── quick-start.md          ← 1-2: 5분 완성 (API 호출 → 변경 → 저장 전체 흐름)
│   ├── api-handler.md          ← 1-3: ApiHandler 상세
│   ├── domain-state.md         ← 1-4: DomainState 팩토리 메서드 + 생명주기
│   ├── save-strategy.md        ← 1-5: save() 분기 전략 (dirtyFields 기반으로 재작성)
│   ├── domain-vo.md            ← 1-6: DomainVO 스키마
│   ├── pipeline.md             ← 1-7: DomainPipeline (all + after + strict)
│   ├── form-binder.md          ← 1-8: FormBinder 플러그인
│   ├── domain-renderer.md      ← 1-9: DomainRenderer 플러그인
│   └── debugger.md             ← 1-10: 디버거 사용법 (openDebugger)
│
├── architecture/
│   ├── overview.md             ← 전체 아키텍처 다이어그램 + 레이어 설명
│   ├── proxy-engine.md         ← Proxy 엔진 심층 분석 (RFC 스타일)
│   ├── state-lifecycle.md      ← 상태 생명주기 (isNew 전이, snapshot, rollback)
│   ├── http-routing.md         ← HTTP 메서드 자동 분기 알고리즘 (RESTful 멱등성)
│   ├── broadcast-channel.md    ← 디버그 채널 + Heartbeat GC 전략
│   └── v8-optimization.md      ← V8 최적화 (Hidden Class, WeakMap, Reflect)
│
├── philosophy.md               ← NEW: 철학과 가치관 페이지
│
├── decision-log/               ← NEW: 의사결정 로그
│   ├── index.md                ← 전체 결정 목록 타임라인
│   ├── ard-0000.md             ← ARD-0000 내용 문서화
│   └── ard-0001.md             ← ARD-0001 내용 문서화
│
├── playground/
│   └── how-it-works.md         ← NEW: Playground 구현 설명 페이지
│
└── api/                        ← TypeDoc 자동 생성 (기존 유지)
```

- **Getting Started:** `installation` + `quick-start` 분리. 설치 방법 3가지(npm, cdn, 폴더) 설명 추가.
  - ESM 전용 빌드는 추후 반영키로.
- **Plugins:** `FormBinder`와 `DomainRenderer` 분리.
- **Core Concept:** 모듈의 철학 설명으로 차별화.
- **Decision Log:** 신규 - ARD 문서들을 공개 문서로 정제해서 노출
- **Playground:** 신규 - Vue 컴포넌트 작성 (각 가이드 페이지 하단에 :::playground 커스텀 컨테이너로 감싸서 노출)
- **Architecture:** 섹션을 세분화

```javascript
Getting Started
  1-1. 설치         /guide/installation
  1-2. 빠른 시작    /guide/quick-start
  1-3. ApiHandler   /guide/api-handler

Core Concepts
  2-1. 팩토리 메서드          /guide/factories
  2-2. save() 분기 전략 ⭐   /guide/save-strategy
  2-3. DomainVO 스키마        /guide/domain-vo
  2-4. DomainPipeline         /guide/pipeline
  2-5. FormBinder 플러그인    /guide/form-binder
  2-6. DomainRenderer 플러그인/guide/domain-renderer
  2-7. 디버거                 /guide/debugger

Architecture
  3-1. 시스템 개요            /architecture/overview
  3-2. Proxy 엔진 심층 분석   /architecture/proxy-engine
  3-3. 상태 생명주기          /architecture/state-lifecycle
  3-4. HTTP 자동 라우팅       /architecture/http-routing
  3-5. 디버그 채널 프로토콜   /architecture/broadcast-channel
  3-6. V8 최적화 전략         /architecture/v8-optimization

Philosophy
  /philosophy

Decision Log
  /decision-log/index
  /decision-log/ard-0000
  /decision-log/ard-0001

Playground
  /playground/how-it-works

API Reference (TypeDoc 자동생성)
  DomainState / ApiHandler / DomainVO / DomainPipeline / DomainRenderer / FormBinder
```

### Playground 컴포넌트

> DSM 단위기능테스트케이스 시나리오 문서를 토대로 14개 도출

| Vue 컴포넌트      | 연결된 TC                | 담당 페이지                                         |
| ----------------- | ------------------------ | --------------------------------------------------- |
| `HttpMethodDemo`  | TC-DS-001, 003, 004, 005 | `save-strategy.md`                                  |
| `RollbackDemo`    | TC-DS-006, 009, TC-C-013 | `save-strategy.md`                                  |
| `DirtyFieldsDemo` | TC-C-010, 011            | `save-strategy.md` & `architecture/http-routing.md` |
| `BatchingDemo`    | TC-DS-010                | `architecture/proxy-engine.md`                      |
| `FormBinderDemo`  | TC-FB-001, 002, 003      | `form-binder.md`                                    |
| `RendererDemo`    | TC-DR-001                | `domain-renerer.md`                                 |

### 커스텀 CSS 스타일

```text
docs/.vitepress/
├── theme/
│   ├── index.js        ← VitePress 테마 진입점 (필수)
│   └── custom.css      ← 커스텀 스타일
└── config.mts
```

- css 깨짐 문제 -> `docs/.vitepress/theme/index.js` 파일이 존재해야 커스텀 CSS를 VitePress 위에 덮어씌울 수 있다.

- WebDoc 레퍼런스: Spring Boot, JEP Docs
  1. 높은 정보 밀도 — 스크롤 없이 많은 것을 볼 수 있는 레이아웃
  2. 일관된 코드 블록 스타일 — syntax highlighting + 파일명 표시
  3. 버전/상태 뱃지 — stable, experimental, deprecated
  4. 파라미터 테이블 — 타입/기본값/설명을 표로 정리
  5. 콜아웃(callout) 박스 — NOTE, TIP, WARNING, DANGER 구분
  6. 앵커 링크 — 각 헤딩에 직접 링크 가능

- 고채도 브랜드 컬러 (기본값 VitePress 퍼플 → DSM 전용 컬러로 교체)
- 본문 폰트: 시스템 sans-serif, 코드: JetBrains Mono / Fira Code
- 넉넉한 여백과 큰 헤딩
- 코드 블록: 파일명 뱃지 + 복사 버튼 (VitePress 기본 제공)
- callout 박스: ::tip / ::warning / ::danger (VitePress 기본 제공, 색상만 커스텀)
- 파라미터 테이블: 별도 CSS 클래스로 스타일링
