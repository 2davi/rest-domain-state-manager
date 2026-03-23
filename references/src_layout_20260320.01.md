# Src Layout (2026-03-20)

## (a) 현재 디렉토리 구조 진단

```text
root/
├── rest-domain-state-manager.js   ← 진입점
├── model/                         ← ❌ src/ 밖 파편 1
│   ├── DomainState.js
│   ├── DomainVO.js
│   └── DomainPipeline.js
├── plugin/                        ← ❌ src/ 밖 파편 2
│   ├── domain-renderer/
│   │   ├── DomainRenderer.js
│   │   ├── renderer.const.js
│   │   └── renderers/
│   │       ├── select.renderer.js
│   │       ├── radio-checkbox.renderer.js
│   │       └── button.renderer.js
│   └── form-binding/
│       └── FormBinder.js
└── src/
    ├── core/
    ├── handler/                   ← ❌ 이름이 역할을 못 표현
    ├── common/
    ├── constants/
    └── debug/
```

1. 번들러 entry 추적이 복잡하고 Tree-shaking 효율이 떨어진다.
    `model/`, `plugin` 디렉토리가 `src/` 밖에 있다.
    `tsconfig.json` include를 보면 `"src/**/*"`, `"model/**/*"`, `"plugin/**/*"`으로 세 곳을 따로 지정하고 있다. 파편화의 증거.
2. `src/handler/`는 이름이 계층 역할을 나타내지 않는다.
    HTTP 전송 계층임을 명시하는 `network/`로 변경한다.
3. 진입점 파일명의 컨벤션은 `index.js`이다.

## (b) 목표 디렉토리 구조

> `tsconfig.js` include가 `"src/**/*` 하나로 끝난다. 이것이 정합성의 증거.

```text
root/
├── index.js                       ← 진입점 (rename)
└── src/
    ├── domain/                    ← NEW (was model/)
    │   ├── DomainState.js
    │   ├── DomainVO.js
    │   └── DomainPipeline.js
    ├── network/                   ← NEW (was src/handler/)
    │   └── api-handler.js
    ├── plugins/                   ← NEW (was plugin/)
    │   ├── domain-renderer/
    │   │   ├── DomainRenderer.js
    │   │   ├── renderer.const.js
    │   │   └── renderers/
    │   │       ├── select.renderer.js
    │   │       ├── radio-checkbox.renderer.js
    │   │       └── button.renderer.js
    │   └── form-binder/           ← NEW (was plugin/form-binding)
    │       └── FormBinder.js
    ├── core/                      ← 유지
    ├── common/                    ← 유지
    ├── constants/                 ← 유지
    └── debug/                     ← 유지
```

## (c) 이동시킬 파일 목록

| 이동 전                             | 이동 후                                 | 로직 변경  |
| ----------------------------------- | --------------------------------------- | ---------- |
| `rest-domain-state-manager.js`      | `index.js`                              |  **없음**  |
| `model/DomainState.js`              | `src/domain/DomainState.js`             |  **없음**  |
| `model/DomainVO.js`                 | `src/domain/DomainVO.js`                |  **없음**  |
| `model/DomainPipeline.js`           | `src/domain/DomainPipeline.js`          |  **없음**  |
| `src/handler/api-handler.js`        | `src/network/api-handler.js`            |  **없음**  |
| `plugin/domain-renderer/**`         | `src/plugins/domain-renderer/**`        |  **없음**  |
| `plugin/form-binding/FormBinder.js` | `src/plugins/form-binder/FormBinder.js` |  **없음**  |

- `src/core/`, `/src/common/`, `src/constants/`, `src/debug/`는 그대로 유지한다.
- `dist/` 하위의 `.d.ts` 파일들은 구 경로를 참조하지만, 재빌드할 것이므로 건들지 않는다.

## (d) Feature 브랜치명 및 커밋 메시지

- **브랜치명:** `refactor/src-layout`

- **Commit Sequence:**

```markdown
# 커밋 1 — 파일 이동만 (git mv, import 수정 없음)
refactor(structure): move model/, plugin/, handler/ under src/ hierarchy

  - model/              → src/domain/
  - plugin/             → src/plugins/
  - src/handler/        → src/network/
  - rest-domain-state-manager.js → index.js
  - 이 커밋 단독으로는 빌드 미통과 (import 경로 갱신 전 상태)

# 커밋 2 — import 경로 전체 갱신
refactor(structure): update all import paths for new directory layout

  - src/domain/DomainState.js     : ../src/* → ../* 단순화
  - src/domain/DomainPipeline.js  : ../src/* → ../* 단순화
  - src/domain/DomainVO.js        : ../src/* → ../* 단순화
  - src/network/api-handler.js    : ../../model/* → ../domain/*
  - src/plugins/DomainRenderer.js : ../../src/* → ../../*, ../../model/* → ../../domain/*
  - src/plugins/FormBinder.js     : ../../src/* → ../../*, ../../model/* → ../../domain/*
  - index.js                      : ./model/*, ./plugin/*, ./src/handler/* → ./src/domain/*, ./src/plugins/*, ./src/network/*
  - 이 커밋 이후 빌드 통과

# 커밋 3 — 설정 파일 및 JSDoc 갱신
refactor(config): update vite, tsconfig, and JSDoc @module tags

  - vite.config.js  : entry rest-domain-state-manager.js → index.js
  - tsconfig.json   : include ["src/**/*", "index.js"] (model/**, plugin/** 제거)
  - 이동된 파일 @module 태그 6개 갱신
  - inline import() 타입 참조 경로 갱신 (JSDoc @param, @typedef 내부)
```
