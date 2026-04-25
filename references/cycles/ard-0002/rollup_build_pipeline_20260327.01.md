# Hybrid Bundling & Type Inference (2026-03-27)

> **Milestone:** `v1.2.0`
> **Branch:** `chore/rollup-build-pipeline`
> **References:** `ard-0002-alignment.md § 3.6`

---

## (a) 현행 빌드 파이프라인 진단

### 현재 상태

```text
빌드 도구   : Vite 6 (Library Mode)
출력 포맷   : ESM(index.js) + CJS(index.cjs) — 단일 번들 파일
preserveModules : false (기본값) — 전체 라이브러리가 하나의 파일로 번들
d.ts 생성   : tsc --emitDeclarationOnly (tsconfig.json 단일 파일)
declarationMap  : false — "Go to Definition"이 .d.ts로 이동, 원본 소스로 미이동
```

### `package.json` 현재 `exports` 필드

```json
"exports": {
    ".": {
        "types":   "./dist/index.d.ts",
        "import":  "./dist/index.js",
        "require": "./dist/index.cjs"
    }
}
```

`"types"` 조건이 `"import"` 보다 앞에 와야 한다는 TypeScript 권장 순서는 지키고 있다.
`"import"` 확장자가 `.js`인 점 — `"type": "module"` 패키지에서 `.js`는 ESM으로 해석되므로 현재도 문제없다.
단, Rollup 전환 후 출력 파일명을 `.mjs`로 바꾸면 이 필드도 함께 갱신해야 한다.

### `tsconfig.json` 현재 상태

```json
{
    "compilerOptions": {
        "target":             "ESNext",
        "module":             "ESNext",
        "lib":                ["ESNext", "DOM"],
        "declaration":        true,
        "declarationDir":     "./dist",
        "emitDeclarationOnly": true,
        "allowJs":            true,
        "checkJs":            true,
        "moduleResolution":   "node",
        "strict":             true,
        "skipLibCheck":       true
    },
    "include": ["src/**/*", "index.js"]
}
```

- **두 가지 누락:**
  - `declarationMap: true` 미설정 → IDE "Go to Definition"이 `.d.ts`에서 멈추고 원본 `.js`로 이동 불가
  - `tsconfig.build.json` 미분리 → `checkJs: true`가 빌드용 설정인데 런타임 개발 시 IDE에 노이즈 유발 가능

### 결론: 무엇을 해야 하는가

| 항목                | 현재              | 목표             | 작업 필요 여부 |
| ------------------- | ----------------- | ---------------- | -------------- |
| 빌드 도구           | Vite Library Mode | Rollup 직접 사용 | **전환**       |
| preserveModules     | false             | true             | **설정 추가**  |
| 출력 파일명(ESM)    | `index.js`        | `index.mjs`      | **변경**       |
| exports 필드        | `.js`/`.cjs`      | `.mjs`/`.cjs`    | **갱신**       |
| declarationMap      | false             | true             | **추가**       |
| tsconfig.build.json | 미분리            | 빌드 전용 분리   | **생성**       |
| commitlint          |  설치됨           | —                | 불필요         |
| semantic-release    |  설치됨           | —                | 불필요         |
| npm pack 검증       | 미수행            | CI 스텝 추가     | **추가**       |

---

## (b) 핵심 설계 결정

### Vite → Rollup 전환 근거

Vite와 Rollup 모두 내부적으로 Rollup 번들러를 사용한다. 차이는 제어 계층의 투명성이다.

Vite Library Mode는 개발 서버, HMR, CSS 처리 등 애플리케이션 개발 기능이 함께 올라온다. `vite.config.js`에서 `rollupOptions`를 통해 Rollup 옵션을 노출하지만, Vite 자체 레이어가 일부 옵션을 오버라이드한다. `preserveModules: true`처럼 번들 출력 구조에 직접 영향을 주는 설정은 Rollup 직접 사용 시 더 예측 가능하게 동작한다.

REST DSM은 NPM 공개 배포가 목표인 순수 라이브러리다. 개발 서버가 필요 없다. `vite dev`는 VitePress 문서 개발 시에만 사용하고, 라이브러리 번들 빌드는 Rollup이 담당하도록 역할을 분리한다.

```text
vite dev       → VitePress 문서 개발 서버 (기존 유지)
rollup -c      → 라이브러리 번들 빌드 (신규)
tsc -p tsconfig.build.json → .d.ts 생성 (기존 tsc 유지, 설정 분리)
```

### `preserveModules: true` 가 필요한 이유

현재 단일 번들 방식에서 소비자가 `DomainState`만 import해도 `DomainRenderer`, `FormBinder`, `DomainPipeline` 코드가 전부 번들에 포함된다. `preserveModules: true`를 적용하면 `src/` 디렉토리 구조 그대로 `dist/` 에 출력되어 소비자 번들러가 실제로 사용된 파일만 가져갈 수 있다.

```text
preserveModules: false (현재)        preserveModules: true (목표)

dist/                                dist/
├── index.js  ← 전체 번들 하나       ├── index.mjs
└── index.cjs                        ├── index.cjs
                                     └── src/
                                          ├── domain/
                                          │   ├── DomainState.mjs
                                          │   ├── DomainVO.mjs
                                          │   └── DomainPipeline.mjs
                                          ├── network/
                                          │   └── api-handler.mjs
                                          └── plugins/
                                               ├── form-binder/
                                               └── domain-renderer/
```

소비자가 `import { DomainState } from '@2davi/rest-domain-state-manager'`만 쓰면 `DomainRenderer` 관련 코드는 최종 번들에서 완전히 제거된다.

### `declarationMap: true` 가 필요한 이유

현재 상태에서 소비자가 IDE에서 `DomainState.fromJSON`에 "Go to Definition"을 누르면 `dist/index.d.ts`로 이동한다. 타입 선언만 있고 구현 코드는 없는 파일이다.

`declarationMap: true`를 활성화하면 `.d.ts.map` 파일이 함께 생성되고, IDE가 이 맵을 따라 원본 `src/domain/DomainState.js`의 실제 구현 코드로 이동한다. JSDoc 주석, 구현 로직, 예제 코드를 소비자가 IDE를 떠나지 않고 바로 볼 수 있다.

---

## (c) 변경 파일별 세부 분석

### STEP A — Rollup 설치

```bash
npm install -D rollup @rollup/plugin-node-resolve
```

| 패키지                        | 역할                                           |
| ----------------------------- | ---------------------------------------------- |
| `rollup`                      | 번들러 핵심 엔진                               |
| `@rollup/plugin-node-resolve` | `node_modules` 의존성 해석. `bare import` 처리 |

`@rollup/plugin-commonjs`는 설치하지 않는다. 이 프로젝트는 `"type": "module"` 순수 ESM 패키지이고 `src/` 내부 코드에 CJS `require()`가 없다. CJS 출력 포맷은 Rollup이 ESM 소스를 변환하여 생성한다.

---

### STEP B — `rollup.config.js` 신규 생성

```javascript
// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default [

    // ── ESM 출력 ────────────────────────────────────────────────────────────
    {
        input: resolve(__dirname, 'index.js'),

        output: {
            dir:              'dist',
            format:           'es',
            preserveModules:  true,     // 모듈 구조 유지 → Tree-shaking 최적화
            entryFileNames:   '[name].mjs',
            sourcemap:        true,
        },

        plugins: [nodeResolve()],

        // 외부 의존성 선언: 번들에 포함하지 않음
        // 소비자 환경에서 설치된 버전을 사용하도록 위임
        external: [
            // 현재 dependencies가 없으므로 비어있음
            // React, Vue 등 peer dependency가 생기면 여기에 추가
        ],
    },

    // ── CJS 출력 ────────────────────────────────────────────────────────────
    {
        input: resolve(__dirname, 'index.js'),

        output: {
            dir:              'dist/cjs',
            format:           'cjs',
            preserveModules:  true,
            entryFileNames:   '[name].cjs',
            sourcemap:        true,
            // CJS 환경에서 ESM의 import.meta 구문 처리
            // Rollup이 자동으로 module.exports 패턴으로 변환
        },

        plugins: [nodeResolve()],

        external: [],
    },
];
```

**`preserveModules: true` 주의사항:**
단일 번들에 `name`이나 `file` 옵션 대신 `dir`을 사용해야 한다. `preserveModules`는 단일 파일 출력이 아닌 디렉토리 출력을 전제로 동작한다.

---

### STEP C — `package.json` 갱신

#### scripts 변경

```json
"scripts": {
    "build":  "rollup -c && tsc -p tsconfig.build.json",
    "types":  "tsc -p tsconfig.build.json",
    "lint":   "eslint src index.js",
    ...
    "prepublishOnly": "npm run lint && npm run test && npm run build"
}
```

- `"build"`에서 `vite build` → `rollup -c`로 교체한다.
- `"types"` 스크립트를 별도 추가하여 `.d.ts`만 재생성이 가능하게 한다.

#### `exports` 필드 갱신

```json
"main":   "./dist/cjs/index.cjs",
"module": "./dist/index.mjs",
"types":  "./dist/index.d.ts",

"exports": {
    ".": {
        "types":   "./dist/index.d.ts",
        "import":  "./dist/index.mjs",
        "require": "./dist/cjs/index.cjs"
    }
}
```

`"types"` 조건은 반드시 첫 번째에 위치해야 한다. TypeScript가 `exports` 필드를 순서대로 평가하기 때문이다.

`"main"` fallback은 Webpack 4, Jest, 구형 도구 호환성을 위해 유지한다. 2026년 기준 대부분의 도구가 `exports`를 지원하지만 SI 환경에서는 레거시 빌드 도구가 여전히 사용된다.

---

### STEP D — `tsconfig.build.json` 신규 생성

```json
{
    "compilerOptions": {
        "target":              "ESNext",
        "module":              "ESNext",
        "lib":                 ["ESNext", "DOM"],
        "allowJs":             true,
        "checkJs":             false,
        "declaration":         true,
        "declarationMap":      true,
        "emitDeclarationOnly": true,
        "declarationDir":      "./dist",
        "moduleResolution":    "bundler",
        "strict":              true,
        "skipLibCheck":        true
    },
    "include": ["src/**/*", "index.js"]
}
```

**기존 `tsconfig.json`과의 차이점:**

| 옵션               | tsconfig.json (기존) | tsconfig.build.json (신규) | 이유                                                           |
| ------------------ | -------------------- | -------------------------- | -------------------------------------------------------------- |
| `checkJs`          | `true`               | `false`                    | 빌드 시 타입 에러로 빌드 차단하지 않음. 타입 체크는 IDE가 담당 |
| `declarationMap`   | 없음                 | `true`                     | "Go to Definition"이 원본 `.js`로 이동하도록 `.d.ts.map` 생성  |
| `moduleResolution` | `"node"`             | `"bundler"`                | Rollup + ESM 환경에 맞는 모듈 해석 전략                        |

기존 `tsconfig.json`은 IDE 타입 체크용으로 그대로 유지한다. `checkJs: true`가 개발 중 오류를 실시간으로 잡아주는 역할을 계속 수행한다.

**`moduleResolution: "bundler"`를 선택한 이유:**

TypeScript 5.0에서 도입된 `"bundler"` 모드는 Rollup, Vite 등 번들러 환경의 모듈 해석 방식을 정확하게 모델링한다. `"node"` 모드는 Node.js CJS 방식으로, ESM 파일에서 확장자 없는 import(`import { x } from './module'`)를 에러로 처리할 수 있다. `"bundler"` 모드는 이를 허용한다.

---

### STEP E — `package.json` `files` 필드 점검

현재 설정:

```json
"files": ["dist", "README.md", "LICENSE"]
```

Rollup `preserveModules` 출력 구조에서 `dist/` 전체가 포함되므로 이 필드는 변경 불필요. 단, `npm pack --dry-run`으로 실제 포함 파일 목록을 확인하는 검증 단계가 필요하다.

- **포함되지 말아야 할 것들:**
  - `src/` 원본 (소스맵이 연결되어 있어 간접 접근 가능하나, 원본 직접 포함 불필요)
  - `tests/`
  - `docs/`
  - `*.config.js` 설정 파일들
- `references/` 문서

---

## (d) 예상 시나리오

### 빌드 실행 흐름 (변경 후)

```text
npm run build
  │
  ├─ rollup -c
  │    ├─ ESM 빌드: dist/*.mjs + dist/src/**/*.mjs
  │    └─ CJS 빌드: dist/cjs/*.cjs + dist/cjs/src/**/*.cjs
  │
  └─ tsc -p tsconfig.build.json
       └─ dist/index.d.ts + dist/**/*.d.ts + dist/**/*.d.ts.map
```

### 소비자 ESM import 흐름

```javascript
// 소비자 코드 (ESM 환경)
import { DomainState } from '@2davi/rest-domain-state-manager';

// Node.js → package.json exports["."]['import'] 조건 탐색
// → ./dist/index.mjs 로드
// → DomainState만 사용한다면 DomainRenderer.mjs는 번들에 미포함 (Tree-shaking)
```

### 소비자 TypeScript 타입 추론 흐름

```typescript
// 소비자 TypeScript 코드
import { DomainState } from '@2davi/rest-domain-state-manager';

const state = DomainState.fromJSON(json, api);
//            ^--- TypeScript가 exports["."]['types'] → dist/index.d.ts 탐색
//                 IDE "Go to Definition" → .d.ts.map → src/domain/DomainState.js
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일                  | 변경 종류     | 변경 내용                                                                                                                                                                          |
| --------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`        | **수정**      | `rollup` + `@rollup/plugin-node-resolve` devDep 추가, `scripts.build` 교체, `scripts.dev` 교체, `scripts.types` 추가, `exports` 필드 `.mjs`/`.cjs` 갱신, `main`/`module` 경로 갱신 |
| `rollup.config.js`    | **신규 생성** | ESM + CJS dual output, `preserveModules: true`, `external` 선언                                                                                                                    |
| `tsconfig.build.json` | **신규 생성** | `declarationMap: true`, `checkJs: false`, `moduleResolution: "bundler"`                                                                                                            |
| `tsconfig.json`       | **수정**      | `moduleResolution: "bundler"` 추가 (IDE 타입 체크 일관성)                                                                                                                          |
| `vite_config.js`      | **수정**      | `build.lib` 전체 제거. `vite.config.js`를 VitePress 전용으로 단순화                                                                                                                |

### Feature 브랜치명

```text
chore/rollup-build-pipeline
```

기능 추가가 아닌 빌드 도구 교체이므로 `chore/`. semantic-release 기준 버전 변화 없음.

### Commit Sequence

```markdown
# STEP A — Rollup 설치 + 설정 파일 생성
chore(build): replace vite library mode with rollup for npm package bundling

  - rollup, @rollup/plugin-node-resolve devDependency 추가
  - rollup.config.js 신규 생성: ESM(.mjs) + CJS(.cjs) dual output
  - preserveModules: true 설정으로 모듈 구조 유지 및 Tree-shaking 최적화
  - vite.config.js: build.lib 블록 제거 (index.html 플레이그라운드 전용으로 단순화)
  - @rollup/plugin-commonjs 미설치 사유: 순수 ESM 소스, CJS 변환은 Rollup 자체 처리


# STEP B — package.json 빌드 파이프라인 갱신
chore(build): update package.json scripts and exports for rollup output

  - scripts.build: vite build → rollup -c && tsc -p tsconfig.build.json
  - scripts.dev: vite → vitepress dev docs (VitePress 전용)
  - scripts.types 추가: tsc -p tsconfig.build.json
  - exports["."]['import']: index.js → index.mjs
  - exports["."]['require']: index.cjs → cjs/index.cjs
  - main/module 필드 경로 갱신


# STEP C — tsconfig.build.json 분리 + declarationMap 활성화
chore(build): separate tsconfig.build.json with declarationMap for better DX

  - tsconfig.build.json 신규 생성: 빌드 전용 TypeScript 설정
  - declarationMap: true 추가: Go to Definition → 원본 .js 이동
  - checkJs: false: 빌드 시 타입 오류로 차단 방지
  - moduleResolution: "bundler": Rollup ESM 환경 모델링
  - tsconfig.json: moduleResolution "node" → "bundler" 갱신


# STEP D — 번들 결과물 검증
chore(build): verify bundle output and npm pack dry-run

  - npm run build 실행 → dist/ 구조 확인
  - npm pack --dry-run 실행 → 배포 파일 목록 확인
  - src/, tests/, docs/ 미포함 확인
  - exports 필드 타입/import/require 경로 유효성 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                              | 기준                                  |
| --------------------------------- | ------------------------------------- |
| `npm run build`                   | 에러 없이 완료                        |
| `dist/index.mjs`                  | ESM 엔트리포인트 존재                 |
| `dist/cjs/index.cjs`              | CJS 엔트리포인트 존재                 |
| `dist/src/domain/DomainState.mjs` | `preserveModules` 적용 확인           |
| `dist/index.d.ts`                 | 타입 선언 파일 존재                   |
| `dist/index.d.ts.map`             | declarationMap 파일 존재              |
| IDE "Go to Definition"            | `.d.ts` → 원본 `.js` 이동 확인        |
| `npm pack --dry-run`              | `src/`, `tests/`, `docs/` 미포함 확인 |
| `npm run test`                    | 전체 테스트 통과 (기존 회귀 없음)     |
| `npm run lint`                    | error 0건                             |
