# IMPL-004 — 소스 디렉토리 구조 재편 (src-layout)

| 항목      | 내용                               |
| --------- | ---------------------------------- |
| 날짜      | 2026-03-20                         |
| 브랜치    | `refactor/src-layout`              |
| 상위 결정 | [ARD-0001](/decision-log/ard-0001) |
| 상태      | 완료                               |

## 1. 문제 정의

### 1.1 파편화된 디렉토리 구조

ARD-0000이 진단한 치명적 설계 결함 중 하나는 핵심 도메인 모델 파일들이 `src/` 밖에 위치한다는 것이었다.

```text
// 개선 전 — 파편화 상태
root/
├── rest-domain-state-manager.js   ← 진입점 파일명도 컨벤션에 어긋남
├── model/                         ← src/ 밖 파편 1
│   ├── DomainState.js
│   ├── DomainVO.js
│   └── DomainPipeline.js
├── plugin/                        ← src/ 밖 파편 2
│   ├── domain-renderer/
│   └── form-binding/
└── src/
    ├── core/
    ├── handler/                   ← 역할을 나타내지 않는 이름
    ├── common/
    ├── constants/
    └── debug/
```

이 구조의 문제점은 세 가지였다.

**번들러 Entry Point 추적 복잡성:** `tsconfig.json` 의 `include` 가 `"src/**/*"`, `"model/**/*"`, `"plugin/**/*"` 으로 세 경로를 별도 지정해야 했다. Vite의 번들링 시 모든 진입점이 서로 다른 컨텍스트에서 시작되어 Tree-shaking 분석이 복잡해진다.

**Tree-shaking 효율 저하:** NPM 패키지의 Tree-shaking이 효과적으로 작동하려면 모든 모듈이 하나의 루트 아래 응집되어 있어야 한다. 파편화된 구조에서 번들러는 모듈 간 의존 관계를 정확히 추적하기 어렵다.

**`src/handler/` 이름:** `ApiHandler` 가 HTTP 전송 레이어임을 나타내지 않는다. 동일한 역할 범주의 파일이 추가될 때 어떤 디렉토리에 속해야 하는지 기준이 불명확하다.

## 2. 설계 결정

### 2.1 목표 디렉토리 구조

```text
// 개선 후 — src/ 중심 응집
root/
├── index.js                       ← 진입점 (컨벤션 준수)
└── src/
    ├── domain/                    ← (was: model/)
    │   ├── DomainState.js
    │   ├── DomainVO.js
    │   └── DomainPipeline.js
    ├── network/                   ← (was: src/handler/)
    │   └── api-handler.js
    ├── plugins/                   ← (was: plugin/)
    │   ├── domain-renderer/
    │   └── form-binder/           ← (was: form-binding/)
    ├── core/
    ├── common/
    ├── constants/
    └── debug/
```

이 구조에서 `tsconfig.json include` 는 `["src/**/*", "index.js"]` 하나의 패턴으로 통합된다.

### 2.2 이름 변경 결정 근거

| 이전                           | 이후                       | 이유                                                        |
| ------------------------------ | -------------------------- | ----------------------------------------------------------- |
| `model/`                       | `src/domain/`              | DDD(Domain-Driven Design)의 용어 체계. 도메인 모델임을 명시 |
| `plugin/`                      | `src/plugins/`             | `src/` 통합 + 복수형으로 일관성 유지                        |
| `src/handler/`                 | `src/network/`             | HTTP 전송 레이어(Transport Layer)임을 명시                  |
| `plugin/form-binding/`         | `src/plugins/form-binder/` | 파일명 `FormBinder.js` 와 일치시킴                          |
| `rest-domain-state-manager.js` | `index.js`                 | NPM 패키지 진입점 컨벤션(`index.js`) 준수                   |

### 2.3 로직 변경 없는 순수 구조 작업

이 리팩토링은 파일 이동과 import 경로 갱신만 포함한다. 어떤 비즈니스 로직도 변경하지 않았다. 이것이 `feature/` 가 아닌 `refactor/` 브랜치를 사용한 근거다.

## 3. 변경 파일 및 커밋 시퀀스

파일 이동(커밋 1)과 import 경로 갱신(커밋 2)을 분리했다. 커밋 1 단독으로는 빌드가 실패하는 상태이나, 두 커밋을 분리하면 이동 diff와 경로 갱신 diff를 명확히 구분하여 리뷰할 수 있다.

```text
# 커밋 1 — 파일 이동만 (import 경로 수정 없음)
refactor(structure): move model/, plugin/, handler/ under src/ hierarchy

# 커밋 2 — import 경로 전체 갱신
refactor(structure, config): update all import paths, vite, tsconfig,
  and JSDoc @module tags for new directory layout
```

**TypeDoc JSDoc 링크 수정 (커밋 2 포함):** 구조 이동 후 TypeDoc 빌드에서 `{@link module:handler/api-handler}` 형태의 `module:` 네임스페이스 구문이 resolve되지 않는 에러가 발생했다. TypeDoc은 `{@link module:X}` 구문을 지원하지 않으며 심볼명을 직접 참조해야 한다. 11개 파일의 JSDoc `@see` 링크를 `{@link SymbolName}` 형태로 전면 교체했다.

## 4. 결과 및 검증

**빌드 검증:** 커밋 2 이후 `npm run build` 통과. `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 정상 생성.

**TypeDoc 검증:** `npm run docs:api` 통과. `docs/api/` 하위 레퍼런스 파일들 정상 생성.

**테스트 검증:** `npm test` 79/79 케이스 통과. 구조 변경이 기존 동작에 영향을 주지 않음 확인.
