# CI/CD Pipeline — Milestone 4 (2026-03-23)

## 목적

> 코드 품질을 자동으로 강제하고, 커밋 한 번으로 테스트 → 빌드 → 릴리즈 → NPM 배포까지
> 전 과정이 자동으로 완결되는 글로벌 스탠다드 파이프라인을 구축한다.

Milestone 4는 세 단계로 나뉜다.

| 단계 | 작업                                 |
| ---- | ------------------------------------ |
| 4-A  | ESLint + Prettier 린팅 도입          |
| 4-B  | GitHub Actions CI/CD 워크플로우 구축 |
| 4-C  | NPM 빌드 및 자동 배포 파이프라인     |

---

## 4-A. 린팅(Linting) 도입

### (a) 작업 전 현황 진단

`package.json`에 `eslint: ^9.0.0`과 `prettier: ^3.5.0`이 `devDependencies`에 이미 선언되어 있었으나,
설정 파일이 전혀 없는 **깡통 상태**였다. `npm run lint`를 실행해도 아무것도 검사하지 않고
통과하는 상태였다.

ESLint 9는 기존 `.eslintrc.*` 방식을 **Flat Config(`eslint.config.js`)** 방식으로 대체했다.
이미 9.x가 설치되어 있으므로 Flat Config를 채택한다. Biome은 쓰지 않는다 —
이미 ESLint + Prettier 조합이 설치되어 있고 생태계 호환성이 더 높다.

---

### (b) 추가 설치 패키지.01

```bash
npm install -D @eslint/js eslint-plugin-jsdoc globals jsdom
```

| 패키지                | 역할                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `@eslint/js`          | ESLint 9 공식 권장 규칙 셋. Flat Config 환경의 `eslint:recommended` 역할                          |
| `eslint-plugin-jsdoc` | JSDoc 주석 품질 강제. 이 프로젝트는 JSDoc이 핵심 문서화 수단이므로 필수                           |
| `globals`             | `browser`, `node` 전역 변수 목록 제공. `window`, `document` 등을 미선언 변수로 오인하지 않도록 함 |
| `jsdom`               | Vitest `jsdom` 환경에서 `FormBinder`, `DomainRenderer` 테스트에 필요                              |

---

### (c) 신규 파일 — `eslint.config.js`

ESLint Flat Config 방식은 파일 하나에 배열로 설정을 쌓는다.
각 객체가 `files` 글로브 패턴에 해당하는 파일에만 적용된다.

```javascript
// eslint.config.js
import js      from '@eslint/js';
import jsdoc   from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [

    // ── 1. 전역 무시 패턴 ──────────────────────────────────────────────────
    // dist/, docs/.vitepress/cache/ 등 빌드 산출물과 자동 생성 파일은 검사하지 않는다.
    {
        ignores: [
            'dist/**',
            'docs/.vitepress/cache/**',
            'docs/.vitepress/dist/**',
            'node_modules/**',
            'coverage/**',
        ],
    },

    // ── 2. src/ 소스 파일 — 핵심 규칙 ────────────────────────────────────
    {
        files: ['src/**/*.js', 'index.js'],
        plugins: { jsdoc },
        languageOptions: {
            ecmaVersion:  2022,
            sourceType:   'module',
            // browser 전역 + ES2021 전역(globalThis 등)을 허용
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        rules: {
            ...js.configs.recommended.rules,

            // 선언했지만 쓰지 않는 변수 금지
            // _로 시작하는 인자(콜백 무시용)는 예외로 허용
            'no-unused-vars': ['error', {
                vars:               'all',
                args:               'after-used',
                argsIgnorePattern:  '^_',
                caughtErrors:       'all',
            }],

            // console.log 금지 (개발 중 남긴 디버그 로그 방지)
            // console.debug / .warn / .error / .group / .groupEnd / .table 허용
            // 이유: src/debug/ 는 의도적으로 console.debug를 쓰고,
            //       error.messages.js 의 console.warn 도 의도된 동작
            'no-console': ['warn', {
                allow: ['debug', 'warn', 'error', 'group', 'groupEnd', 'table'],
            }],

            'no-var':       'error',           // var 금지 — const/let만 허용
            'prefer-const': ['warn', { destructuring: 'all' }],
            'eqeqeq':       ['error', 'always', { null: 'ignore' }],

            // JSDoc 규칙
            'jsdoc/check-param-names':         'warn',
            'jsdoc/check-tag-names':           ['warn', { definedTags: ['module'] }],
            'jsdoc/check-types':               'warn',
            'jsdoc/require-param-description': 'warn',
        },
    },

    // ── 3. test/ 파일 — 규칙 완화 ─────────────────────────────────────────
    {
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-console':    'off',  // 테스트 파일은 console.log 허용
            'no-unused-vars': ['warn', {
                vars:              'all',
                args:              'after-used',
                argsIgnorePattern: '^_',
            }],
            'no-var':       'error',
            'prefer-const': 'warn',
            'eqeqeq':       ['error', 'always', { null: 'ignore' }],
        },
    },
];
```

**규칙 선택 근거:**

- `no-unused-vars` — import 해놓고 안 쓰는 코드, 선언만 한 변수를 CI 단계에서 잡는다.
  `_`로 시작하는 인자 예외 처리를 둔 이유는 콜백에서 `(_event) => {}` 패턴을 쓰기 때문이다.
- `no-console` — `console.log`가 프로덕션 번들에 딸려 들어가는 것을 방지한다.
  `debug/warn/error`는 허용 목록에 있다. `src/debug/debug-channel.js`가 의도적으로
  `console.debug`를 사용하고, 에러 메시지 모듈이 `console.warn`을 쓰기 때문이다.
- `no-var` — 함수 스코프를 가지는 `var`의 호이스팅 문제를 원천 차단한다.
- `eqeqeq` — 타입 강제 변환이 숨어있는 `==` 비교를 금지한다. `null`만 예외로 허용한다.
- `jsdoc/check-tag-names` — `@module`은 TypeDoc이 사용하는 커스텀 태그라 허용 목록에 명시했다.

---

### (d) 신규 파일 — `.prettierrc`

```json
{
    "semi":          true,
    "singleQuote":   true,
    "quoteProps":    "as-needed",
    "trailingComma": "es5",
    "printWidth":    100,
    "tabWidth":      4,
    "useTabs":       false,
    "endOfLine":     "lf",
    "arrowParens":   "always"
}
```

**설정값 근거:**

| 설정            | 값         | 선택 이유                                                                        |
| --------------- | ---------- | -------------------------------------------------------------------------------- |
| `singleQuote`   | `true`     | 기존 소스 코드 전체가 작은따옴표 사용 중 — 기존 스타일 고정                      |
| `printWidth`    | `100`      | JSDoc 주석이 길고 정렬 패턴이 있는 코드라 80자는 너무 좁음                       |
| `tabWidth`      | `4`        | 기존 코드 인덴트가 4칸                                                           |
| `trailingComma` | `"es5"`    | 객체/배열 마지막 항목 뒤 쉼표. Git diff를 한 줄씩 깔끔하게 만드는 표준 관행      |
| `endOfLine`     | `"lf"`     | Windows 환경이지만 Git/CI 환경에서 LF를 강제하여 개행 차이로 인한 diff 오염 방지 |
| `arrowParens`   | `"always"` | 단일 매개변수 화살표 함수도 `(x) => x` 형태로 일관성 유지                        |

---

### (e) `package.json` scripts 수정

```json
"scripts": {
    "dev":            "vite",
    "build":          "vite build && tsc --emitDeclarationOnly",
    "lint":           "eslint src index.js",
    "lint:fix":       "eslint src index.js --fix",
    "format":         "prettier --write \"src/**/*.js\" \"index.js\" \"test/**/*.js\"",
    "format:check":   "prettier --check \"src/**/*.js\" \"index.js\" \"test/**/*.js\"",
    "test":           "vitest run",
    "prepublishOnly": "npm run lint && npm run test && npm run build",
    "docs:dev":       "vitepress dev docs",
    "docs:build":     "npm run docs:api && vitepress build docs",
    "docs:api":       "typedoc"
}
```

**변경 포인트:**

- `lint:fix` 추가 — 자동 수정 가능한 것들(`prefer-const` 등) 일괄 처리용
- `format:check` 추가 — CI에서 포맷 검사용 (수정 없이 diff만 확인)
- `prepublishOnly` — `npm publish` 전에 lint → test → build 순서로 전부 통과해야만 배포 가능

---

### (f) 첫 린트 실행 결과 및 수정 이력

`npm run lint` 첫 실행 결과: **에러 4개, 경고 22개**

```text
src/core/api-proxy.js:359,370   error   no-case-declarations
src/debug/debug-channel.js:612  error   no-useless-escape
src/network/api-handler.js:50   error   no-unused-vars ('ERR')
src/domain/DomainState.js:643   warning no-console
index.js:2                      warning jsdoc/check-tag-names (@fileoverview)
src/common/js-object-util.js    warning jsdoc/require-param-description (9건)
src/constants/error.messages.js warning jsdoc/require-param-description (11건)
```

**에러 수정 내역:**

**E1 — `no-case-declarations` (`api-proxy.js`)**

`switch` 문의 `case` 블록 안에서 `const` 선언 시 블록 스코프가 없어서
다른 `case`에서 변수가 보이는 문제가 발생한다. `splice` `case`에 중괄호를 명시적으로 감싸서 해결.

```javascript
// 수정 전 (에러)
case 'splice':
    const startIdx = args[0] < 0 ? ...;   // ← 에러

// 수정 후
case 'splice': {
    const startIdx = args[0] < 0 ? ...;   // ← 블록 스코프 명시
    break;
}
```

**E2 — `no-useless-escape` (`debug-channel.js`)**

팝업 HTML 템플릿 문자열 안의 `<\/script>` — JS 문자열에서 `/`는 이스케이프 불필요.

```javascript
// 수정 전 (에러)
<\/script>

// 수정 후
</script>
```

**E3 — `no-unused-vars` (`api-handler.js`)**

리팩토링 과정에서 `ERR`를 import 해놓고 실제 사용처가 없어진 케이스. import 라인 삭제.

**E4 — `no-console` (`DomainState.js`)**

`log()` 퍼블릭 메서드 안의 `console.log` — 의도된 기능(changeLog 출력)이므로
`eslint-disable-next-line` 주석으로 해당 줄만 예외 처리.

```javascript
// eslint-disable-next-line no-console
console.log(this._getChangeLog());
```

**경고 처리:**

- `@fileoverview` → `@file` 교체 (`index.js`)
- `jsdoc/require-param-description` 20건 — 나중에 채우기로 결정. CI에서 경고는 blocking 안 함

> **수정 후 최종 린트 결과: 에러 0개, 경고 20개 (JSDoc @param 설명 누락만 남음)**

---

### (g) 커밋 메시지.01

```markdown
chore(lint): add ESLint Flat Config and Prettier with full rule set

  - eslint.config.js: Flat Config 방식 설정 (src/, test/ 분리 구성)
  - .prettierrc: 프로젝트 스타일 기준 포맷 규칙 확정
  - package.json: lint, lint:fix, format, format:check scripts 추가
  - no-case-declarations: api-proxy.js splice case 블록에 {} 명시
  - no-useless-escape: debug-channel.js </script> 이스케이프 제거
  - no-unused-vars: api-handler.js ERR import 제거
  - no-console: DomainState.js log() 메서드 eslint-disable-next-line 처리
  - @fileoverview → @file 교체 (index.js)
```

---

## 4-B. GitHub Actions 파이프라인 구축

### (a) 설계 목표

두 개의 워크플로우를 구성한다.

| 워크플로우 | 파일          | 트리거        | 목적                                                    |
| ---------- | ------------- | ------------- | ------------------------------------------------------- |
| CI         | `ci.yml`      | `push` / `PR` | lint → test → format check 자동 실행, 실패 시 머지 차단 |
| Release    | `release.yml` | `main` push   | lint → test → build → 시맨틱 릴리즈 → NPM 배포          |

---

### (b) 추가 설치 패키지.02

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

| 패키지                            | 역할                                   |
| --------------------------------- | -------------------------------------- |
| `@commitlint/cli`                 | 커밋 메시지 형식 검사 CLI              |
| `@commitlint/config-conventional` | Conventional Commits 규약 기반 규칙 셋 |

`@commitlint`가 하는 일: `feat:`, `fix:`, `refactor:` 같은 시맨틱 커밋 형식을
커밋 시점에 강제한다. 형식이 맞지 않으면 커밋 자체가 거부된다.
Release 워크플로우의 자동 CHANGELOG 생성이 커밋 메시지 파싱에 의존하기 때문에
이것이 전제조건이다.

---

### (c) 신규 파일 — `commitlint.config.js`

```javascript
// commitlint.config.js
export default {
    extends: ['@commitlint/config-conventional'],

    rules: {
        // type 허용 목록 — config-conventional 기본값에 perf 명시 추가
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'revert'],
        ],

        // 제목 최대 100자 (JSDoc이 긴 이 프로젝트 특성상 80은 빡빡함)
        'header-max-length': [2, 'always', 100],

        // 제목 끝 마침표 금지
        'subject-full-stop': [2, 'never', '.'],

        // 본문과 제목 사이 빈 줄 강제
        'body-leading-blank': [1, 'always'],
    },
};
```

**type 허용 목록 의미:**

| type       | 의미                           | 버전 영향       |
| ---------- | ------------------------------ | --------------- |
| `feat`     | 새로운 기능 추가               | minor 버전 상승 |
| `fix`      | 버그 수정                      | patch 버전 상승 |
| `refactor` | 동작 변경 없는 코드 구조 개선  | patch 버전 상승 |
| `perf`     | 성능 최적화                    | patch 버전 상승 |
| `docs`     | 문서 작업 (README, JSDoc 등)   | 버전 변경 없음  |
| `test`     | 테스트 코드 추가/수정          | 버전 변경 없음  |
| `chore`    | 빌드 세팅, 패키지 설정 등 잡일 | 버전 변경 없음  |
| `revert`   | 이전 커밋 되돌리기             | patch 버전 상승 |

---

### (d) 신규 파일 — `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop, 'feature/**', 'fix/**', 'refactor/**']
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    strategy:
      matrix:
        # Node.js 버전 매트릭스 — LTS(22) + 현재 안정 버전(20) 동시 검증
        node-version: [20, 22]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Format check
        run: npm run format:check
```

**설정값 근거:**

- `on.push.branches` — `main`, `develop`, `feature/**`, `fix/**`, `refactor/**` 브랜치에 push할 때마다 CI가 실행된다. 브랜치 이름이 명명 규칙을 따를 때만 자동으로 잡힌다.
- `on.pull_request.branches` — `main`과 `develop`으로 향하는 PR에 CI를 걸어 코드 품질 검증 없이는 머지할 수 없게 한다.
- `strategy.matrix.node-version: [20, 22]` — 동일 코드가 Node.js 20(LTS)과 22 양쪽에서 모두 통과하는지 검증한다. 소비자가 어떤 버전을 쓸지 모르기 때문.
- `npm ci` — `npm install`과 달리 `package-lock.json`을 절대 수정하지 않는다. CI 환경에서 재현 가능한 설치를 보장한다.
- `actions/checkout@v4`, `actions/setup-node@v4` — GitHub 공식 액션 최신 버전.

---

### (e) 신규 파일 — `.github/workflows/release.yml`

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

# 같은 브랜치에 연속 push가 들어올 때 이전 Release 워크플로우를 취소하고 최신 것만 실행
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: true

jobs:
  release:
    name: Semantic Release
    runs-on: ubuntu-latest

    # GitHub Token 쓰기 권한 필요 (릴리즈 생성, 태그 push)
    permissions:
      contents: write
      issues: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # 전체 히스토리 fetch — semantic-release가 커밋 분석에 필요
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

**설정값 근거:**

- `on.push.branches: [main]` — `main` 브랜치에 push될 때만 릴리즈를 시도한다.
  `develop`이나 `feature/` 에서는 절대 릴리즈가 일어나지 않는다.
- `concurrency.cancel-in-progress: true` — 예를 들어 main에 두 개의 커밋이 빠르게
  연속으로 push 되면, 첫 번째 Release 워크플로우를 취소하고 최신 것만 실행한다.
  중복 릴리즈 방지.
- `permissions: contents: write` — `semantic-release`가 GitHub에 태그를 push하고
  Release를 생성하려면 쓰기 권한이 필요하다.
- `fetch-depth: 0` — `semantic-release`는 마지막 태그 이후의 **전체 커밋 히스토리**를
  분석해 버전을 결정한다. 기본값(`1`)으로 얕은 클론을 하면 히스토리가 잘려서 분석 실패.
- `GITHUB_TOKEN` — GitHub이 자동으로 제공하는 임시 토큰. 별도 설정 불필요.
- `NPM_TOKEN` — GitHub Secrets에 직접 등록해야 하는 NPM 발급 토큰.

---

### (f) 커밋 메시지.02

```markdown
chore(ci): add GitHub Actions CI and Release workflows

  - .github/workflows/ci.yml: push/PR 트리거 lint + test + format:check
  - .github/workflows/release.yml: main push 트리거 semantic-release 파이프라인
  - commitlint.config.js: Conventional Commits 기반 커밋 메시지 형식 강제
  - package.json: @commitlint/cli, @commitlint/config-conventional devDeps 추가
  - package.json: engines.node >= 20.0.0 추가
```

---

## 4-C. NPM 빌드 및 자동 배포 파이프라인

### (a) 빌드 산출물 상태 점검

작업 전 `npm run build`를 실행하여 `dist/` 구조를 확인했다.

```text
dist/
├── index.js          ← ESM 번들 (92.06 kB, gzip: 25.30 kB)
├── index.cjs         ← CJS 번들 (27.95 kB, gzip: 10.47 kB)
├── index.js.map
├── index.cjs.map
├── index.d.ts        ← 루트 타입 선언
└── src/
    └── **/*.d.ts     ← 내부 모듈별 타입 선언
```

`package.json`의 `exports` 필드가 세 파일을 올바르게 매핑하고 있어 구조 이상 없음.

```json
"exports": {
    ".": {
        "types":   "./dist/index.d.ts",
        "import":  "./dist/index.js",
        "require": "./dist/index.cjs"
    }
}
```

---

### (b) `package.json` — `sideEffects: false` 추가

```json
{
    "sideEffects": false
}
```

**이 한 줄이 하는 일:**

번들러(Webpack, Rollup, Vite 등)는 패키지를 import할 때 "이 패키지 안에 side effect가 있을 수도 있다"고 가정하면 사용하지 않는 코드도 전부 번들에 포함시킨다. `sideEffects: false`를 선언하면 번들러가 **Tree-shaking**(트리 쉐이킹)을 공격적으로 적용하여 소비자가 실제로 import한 심볼만 번들에 포함시킨다.

예를 들어 소비자가 `DomainState`만 import했을 때, `DomainRenderer`, `FormBinder` 등 사용하지 않는 모듈이 최종 번들에서 제거된다.

---

### (c) 추가 설치 패키지 — semantic-release 플러그인

```bash
npm install -D \
  semantic-release \
  @semantic-release/changelog \
  @semantic-release/git \
  @semantic-release/npm \
  conventional-changelog-conventionalcommits
```

| 패키지                                       | 역할                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `semantic-release`                           | 버전 결정, 태그 생성, 릴리즈 오케스트레이션 핵심 엔진  |
| `@semantic-release/commit-analyzer`          | 커밋 분석해서 다음 버전 결정 (semantic-release 내장)   |
| `@semantic-release/release-notes-generator`  | 릴리즈 노트 생성 (semantic-release 내장)               |
| `@semantic-release/changelog`                | `CHANGELOG.md` 자동 생성/갱신                          |
| `@semantic-release/npm`                      | `package.json` 버전 번호 갱신 + NPM Registry에 publish |
| `@semantic-release/git`                      | `CHANGELOG.md`, `package.json` 변경사항을 레포에 커밋  |
| `@semantic-release/github`                   | GitHub Release 생성 (semantic-release 내장)            |
| `conventional-changelog-conventionalcommits` | Conventional Commits 파싱 프리셋                       |

> `@semantic-release/changelog`를 `package-lock.json`과 함께 커밋하지 않으면
> GitHub Actions의 `npm ci`가 "Cannot find module" 에러를 낸다.
> **설치 후 반드시 `package.json`과 `package-lock.json`을 함께 커밋해야 한다.**

---

### (d) 신규 파일 — `.releaserc.json`

semantic-release의 동작 방식을 정의한다.

```json
{
    "branches": ["main"],
    "plugins": [
        [
            "@semantic-release/commit-analyzer",
            {
                "preset": "conventionalcommits",
                "releaseRules": [
                    { "type": "feat",     "release": "minor" },
                    { "type": "fix",      "release": "patch" },
                    { "type": "perf",     "release": "patch" },
                    { "type": "refactor", "release": "patch" },
                    { "type": "revert",   "release": "patch" },
                    { "type": "docs",     "release": false   },
                    { "type": "test",     "release": false   },
                    { "type": "chore",    "release": false   }
                ]
            }
        ],
        [
            "@semantic-release/release-notes-generator",
            {
                "preset": "conventionalcommits",
                "presetConfig": {
                    "types": [
                        { "type": "feat",     "section": "✨ Features"      },
                        { "type": "fix",      "section": "🐛 Bug Fixes"     },
                        { "type": "perf",     "section": "⚡ Performance"   },
                        { "type": "refactor", "section": "♻️ Refactors"     },
                        { "type": "docs",     "section": "📝 Documentation", "hidden": true },
                        { "type": "test",     "section": "✅ Tests",         "hidden": true },
                        { "type": "chore",    "section": "🔧 Chores",        "hidden": true }
                    ]
                }
            }
        ],
        [
            "@semantic-release/changelog",
            {
                "changelogFile": "CHANGELOG.md"
            }
        ],
        [
            "@semantic-release/npm",
            {
                "npmPublish": true
            }
        ],
        [
            "@semantic-release/git",
            {
                "assets": ["CHANGELOG.md", "package.json"],
                "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
            }
        ],
        "@semantic-release/github"
    ]
}
```

**플러그인 실행 순서와 역할:**

```markdown
1. commit-analyzer
   └─ 마지막 릴리즈 태그 이후 커밋들을 분석
   └─ feat → minor 버전, fix/perf/refactor → patch, docs/test/chore → 릴리즈 없음

2. release-notes-generator
   └─ 커밋들을 타입별로 분류해 릴리즈 노트 텍스트 생성

3. @semantic-release/changelog
   └─ CHANGELOG.md에 이번 릴리즈 노트를 맨 위에 prepend

4. @semantic-release/npm
   └─ package.json의 version 필드를 새 버전으로 갱신
   └─ npm publish --access public 실행 → NPM Registry에 배포

5. @semantic-release/git
   └─ 변경된 CHANGELOG.md + package.json을 커밋
   └─ 커밋 메시지: "chore(release): 0.6.0 [skip ci]"
   └─ "[skip ci]"가 있어야 이 커밋이 다시 Release 워크플로우를 트리거하지 않음

6. @semantic-release/github
   └─ GitHub에 Release 페이지 생성 (릴리즈 노트 포함)
   └─ 버전 태그(v0.6.0) push
```

**`"branches": ["main"]`** — `main` 브랜치에 push될 때만 릴리즈를 시도한다.
다른 브랜치는 이 설정에 없으므로 절대 릴리즈가 트리거되지 않는다.

---

### (e) 신규 파일 — `.npmignore`

`package.json`의 `files` 필드가 배포 파일을 제한하지만, `.npmignore`로 이중 방어한다.
패키지 소비자에게 불필요한 파일(소스, 테스트, 설정)을 배포 tarball에서 제외한다.

```text
# .npmignore
src/
test/
docs/
.github/
*.config.js
*.config.ts
.releaserc.json
.prettierrc
commitlint.config.js
vitest.config.js
CHANGELOG.md
tsconfig.json
```

---

### (f) GitHub Secrets 등록 — `NPM_TOKEN`

**NPM 토큰 발급:**

```markdown
1. https://www.npmjs.com 로그인
2. 우상단 아바타 → Access Tokens
3. Generate New Token → Granular Access Token 선택
4. Token name: github-actions-rest-domain-state-manager
5. Expiration: 365 days
6. Packages and scopes → @2davi/rest-domain-state-manager → Read and write
7. Generate token → 복사 (다시 볼 수 없음)
```

**GitHub Secrets 등록:**

```markdown
1. GitHub 레포지토리 → Settings
2. Secrets and variables → Actions
3. New repository secret
4. Name: NPM_TOKEN  /  Secret: 복사한 토큰 붙여넣기
5. Add secret
```

---

### (g) 커밋 메시지.03

```markdown
chore(release): add NPM publish pipeline via semantic-release

  - .releaserc.json: semantic-release 플러그인 체인 구성
    (commit-analyzer → changelog → npm → git → github)
  - .npmignore: 배포 tarball에서 src/, test/, 설정 파일 제외
  - package.json: sideEffects: false 추가 (Tree-shaking 명시 허용)
  - package.json: @semantic-release/npm, @semantic-release/changelog,
    @semantic-release/git, conventional-changelog-conventionalcommits 추가
  - package-lock.json: 위 패키지 lock 반영
```

---

## 최종 반영 파일 목록

| 파일                            | 변경 종류 | 내용                                                         |
| ------------------------------- | --------- | ------------------------------------------------------------ |
| `eslint.config.js`              | **신규**  | ESLint 9 Flat Config — src/, test/ 분리 규칙                 |
| `.prettierrc`                   | **신규**  | 프로젝트 스타일 기준 포맷 규칙                               |
| `commitlint.config.js`          | **신규**  | Conventional Commits 커밋 메시지 형식 강제                   |
| `.github/workflows/ci.yml`      | **신규**  | push/PR 트리거 lint + test + format:check                    |
| `.github/workflows/release.yml` | **신규**  | main push 트리거 semantic-release 파이프라인                 |
| `.releaserc.json`               | **신규**  | semantic-release 플러그인 체인 설정                          |
| `.npmignore`                    | **신규**  | 배포 tarball 제외 목록                                       |
| `package.json`                  | **수정**  | scripts 추가, sideEffects: false, engines 추가, devDeps 추가 |
| `src/core/api-proxy.js`         | **수정**  | `no-case-declarations` — splice case 블록 {} 명시            |
| `src/debug/debug-channel.js`    | **수정**  | `no-useless-escape` — `<\/script>` → `</script>`             |
| `src/network/api-handler.js`    | **수정**  | `no-unused-vars` — 미사용 ERR import 제거                    |
| `src/domain/DomainState.js`     | **수정**  | `no-console` — log() 메서드에 eslint-disable-next-line       |
| `index.js`                      | **수정**  | `@fileoverview` → `@file`                                    |

---

## 파이프라인 사용 가이드

### 브랜치 전략 전체 구조

```text
main          ← 릴리즈 전용. 직접 push 금지. PR merge만 허용.
│
└── develop   ← 통합 브랜치. feature들이 여기로 merge.
     │
     ├── feature/xxx   ← 기능 개발
     ├── fix/xxx       ← 버그 수정
     └── refactor/xxx  ← 리팩토링
```

- `main`에 push되는 순간 **Release 워크플로우가 자동 실행**된다.
- `feature/`, `fix/`, `refactor/`, `develop` 브랜치에 push되면 **CI 워크플로우가 자동 실행**된다.

---

### 시나리오 1 — 일반 기능 개발 및 릴리즈

**상황:** 새 기능을 개발하고 NPM에 배포한다.

```markdown
STEP 1. feature 브랜치 생성
  git checkout develop
  git pull origin develop
  git checkout -b feature/my-new-feature

STEP 2. 개발 및 커밋 (커밋 메시지 규칙 엄수)
  git add src/...
  git commit -m "feat(domain): add new feature X"
  # → commitlint가 메시지 형식을 검사한다. 형식 불일치 시 커밋 거부.

STEP 3. develop으로 PR 생성 및 머지
  git push origin feature/my-new-feature
  → GitHub에서 develop을 베이스로 PR 생성
  → CI 워크플로우 자동 실행 (lint + test + format:check, Node 20 + 22)
  → CI 통과 후 머지

STEP 4. main으로 PR 생성 및 머지
  → GitHub에서 main을 베이스로 develop의 PR 생성
  → CI 워크플로우 자동 실행
  → CI 통과 후 머지

STEP 5. Release 워크플로우 자동 실행
  → main에 머지되는 순간 release.yml 트리거
  → lint → test → build → npx semantic-release 순서 실행

STEP 6. semantic-release 자동 처리
  → 마지막 릴리즈 태그 이후 커밋 분석
  → feat: 커밋 발견 → minor 버전 상승 (예: 0.5.0 → 0.6.0)
  → CHANGELOG.md 갱신
  → package.json version 필드 갱신
  → npm publish → NPM Registry에 배포
  → GitHub Release 페이지 생성
  → chore(release): 0.6.0 [skip ci] 커밋 push
```

---

### 시나리오 2 — 버그 수정 패치 릴리즈

**상황:** `main`에 있는 버그를 긴급 수정해야 한다.

```markdown
STEP 1. fix 브랜치를 main에서 직접 생성 (hotfix는 develop을 거치지 않을 수 있음)
  git checkout main
  git pull origin main
  git checkout -b fix/critical-bug

STEP 2. 수정 및 커밋
  git add src/...
  git commit -m "fix(core): resolve proxy trap context loss on nested object"

STEP 3. main으로 직접 PR 생성
  git push origin fix/critical-bug
  → main을 베이스로 PR 생성
  → CI 통과 후 머지

STEP 4. Release 워크플로우 자동 실행
  → fix: 커밋 → patch 버전 상승 (예: 0.6.0 → 0.6.1)
  → 자동 배포
```

---

### 시나리오 3 — 버전 올림 없는 작업 (chore/docs/test)

**상황:** 린트 설정 변경, 문서 수정, 테스트 추가 — 배포 없이 main에 반영한다.

```markdown
STEP 1. 브랜치 생성 및 작업
  git checkout -b chore/update-lint-config

STEP 2. 커밋
  git commit -m "chore(lint): update eslint rule for param-description"

STEP 3. main으로 PR + 머지

STEP 4. Release 워크플로우 실행
  → semantic-release가 커밋 분석
  → chore: 커밋만 있으므로 releaseRules에서 release: false
  → "There are no relevant changes, so no new version is released." 출력
  → 버전 변경 없음, NPM 배포 없음, GitHub Release 없음
  → 워크플로우 정상 종료 (초록불)
```

---

### 시나리오 4 — 여러 기능을 묶어서 한 번에 릴리즈

**상황:** feature/A, feature/B, fix/C를 develop에 순서대로 머지한 후 한 번에 main에 올린다.

```markdown
STEP 1. feature/A → develop 머지
STEP 2. feature/B → develop 머지
STEP 3. fix/C → develop 머지

STEP 4. develop → main PR 생성
  → 세 브랜치의 커밋이 모두 포함된 상태
  → CI 통과 후 머지

STEP 5. semantic-release 분석
  → 마지막 릴리즈 이후 커밋:
    feat(domain): add feature A        ← minor 트리거
    feat(plugin): add feature B        ← minor 트리거
    fix(core): fix bug C               ← patch 트리거
  → 가장 높은 버전 영향 선택: minor
  → 0.5.0 → 0.6.0 으로 릴리즈

STEP 6. CHANGELOG.md 자동 생성
  ✨ Features
    - add feature A (feat(domain): ...)
    - add feature B (feat(plugin): ...)
  🐛 Bug Fixes
    - fix bug C (fix(core): ...)
```

---

### 버전 숫자 해석

semantic-release는 **시맨틱 버저닝(Semantic Versioning)** 규약을 따른다.

```text
MAJOR.MINOR.PATCH
  │      │     └─ fix, perf, refactor, revert
  │      └────── feat
  └───────────── BREAKING CHANGE (커밋 본문에 "BREAKING CHANGE:" 포함 시)
```

현재 버전이 `0.5.0`이라면:

- `feat:` 커밋 → `0.6.0`
- `fix:` 커밋 → `0.5.1`
- `BREAKING CHANGE:` 포함 커밋 → `1.0.0`

> **주의:** 첫 번째 major 버전(1.0.0)을 올리려면 커밋 본문(body)에 반드시
> `BREAKING CHANGE: 변경 내용 설명`을 명시해야 한다.
> type을 `feat!:` 처럼 `!`를 붙이는 방법도 동작한다.

---

### 커밋 메시지 작성 법칙 요약

```markdown
<type>(<scope>): <subject>
<공백 줄>
<body>  ← 선택. Why & How 위주로 작성
```

**올바른 예시:**

```markdown
feat(domain): add DomainState.clone() method

  - 현재 상태를 그대로 복제한 새 인스턴스 반환
  - changeLog와 dirtyFields는 초기화된 상태로 생성
  - fromJSON() 내부와 동일한 Proxy 생성 경로 사용
```

**틀린 예시 (commitlint 거부됨):**

```markdown
added new feature.         ← type 없음, 마침표 있음
Update: fix some stuff     ← type 형식 불일치
WIP                        ← type 없음
```
