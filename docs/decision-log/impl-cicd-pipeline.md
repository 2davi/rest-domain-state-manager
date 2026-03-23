# IMPL-005 — CI/CD 파이프라인 구축

| 항목      | 내용                                                      |
| --------- | --------------------------------------------------------- |
| 날짜      | 2026-03-23                                                |
| 브랜치    | `chore/lint-setup`, `chore/ci-setup`, `chore/npm-release` |
| 상위 결정 | [ARD-0001](/decision-log/ard-0001)                        |
| 상태      | 완료                                                      |

## 1. 문제 정의

### 1.1 코드 품질 자동화 부재

`package.json` 에 `eslint: ^9.0.0` 과 `prettier: ^3.5.0` 이 `devDependencies` 에 선언되어 있었으나, 설정 파일이 없는 깡통 상태였다. `npm run lint` 를 실행해도 아무것도 검사하지 않고 통과했다. 또한 커밋 메시지 형식에 대한 강제 수단이 없어 자동화된 버전 결정과 CHANGELOG 생성이 불가능했다.

### 1.2 수동 배포 프로세스

NPM 배포가 수동으로 이루어졌다. 버전 번호를 직접 올리고, CHANGELOG를 수동으로 작성하고, `npm publish` 를 직접 실행하는 방식은 실수를 유발하고 배포 이력 추적을 어렵게 한다.

## 2. 설계 결정

파이프라인을 3단계로 구성했다.

| 단계 | 내용                                  |
| ---- | ------------------------------------- |
| 4-A  | ESLint Flat Config + Prettier 도입    |
| 4-B  | GitHub Actions CI/Release 워크플로우  |
| 4-C  | semantic-release 기반 NPM 자동 배포   |

### 2.1 린팅 — ESLint 9 Flat Config 채택

ESLint 9는 기존 `.eslintrc.*` 방식을 Flat Config(`eslint.config.js`)로 대체했다. 이미 9.x가 설치되어 있으므로 신규 방식을 채택한다. Biome은 생태계 호환성과 이미 설치된 ESLint + Prettier 조합이 있다는 이유로 채택하지 않았다.

**규칙 선택 근거:**

- `no-unused-vars` — import 해놓고 쓰지 않는 코드를 CI에서 잡는다. `_` 로 시작하는 인자는 콜백의 무시 패턴(`(_event) => {}`)을 위해 예외 처리.
- `no-console` — `console.log` 가 프로덕션 번들에 포함되는 것을 방지한다. `debug/warn/error` 는 허용 목록에 둔다. `src/debug/` 가 의도적으로 `console.debug` 를 사용하고 에러 메시지 모듈이 `console.warn` 을 쓰기 때문이다.
- `jsdoc/check-tag-names` — `@module` 을 허용 목록에 명시했다. TypeDoc이 사용하는 커스텀 태그이기 때문이다.

**첫 린트 실행 결과 수정 이력:**

| 에러                   | 파일                   | 원인                                            | 해결                            |
| ---------------------- | ---------------------- | ----------------------------------------------- | ------------------------------- |
| `no-case-declarations` | `api-proxy.js:359,370` | `switch` `case` 블록에 스코프 없는 `const` 선언 | `splice` case에 `{}` 블록 명시  |
| `no-useless-escape`    | `debug-channel.js:612` | HTML 템플릿 문자열의 `<\/script>`               | `</script>` 로 교체             |
| `no-unused-vars`       | `api-handler.js:50`    | 리팩토링 과정에서 미사용 `ERR` import 잔류      | import 라인 삭제                |
| `no-console`           | `DomainState.js:643`   | `log()` 메서드의 의도된 `console.log`           | `eslint-disable-next-line` 처리 |

최종 결과: **에러 0개, 경고 20개 (JSDoc @param 설명 누락만 남음)**. 경고는 CI에서 blocking하지 않는다.

### 2.2 GitHub Actions — 두 워크플로우 설계

**CI 워크플로우 (`ci.yml`):**

- 트리거: `main`, `develop`, `feature/**`, `fix/**`, `refactor/**` 브랜치 push + `main`, `develop` 대상 PR
- Node.js 20/22 매트릭스 — 소비자가 어떤 버전을 사용할지 알 수 없으므로 LTS와 현재 안정 버전 양쪽을 검증한다.
- `npm ci` — `package-lock.json` 을 수정하지 않아 재현 가능한 설치를 보장한다.

**Release 워크플로우 (`release.yml`):**

- 트리거: `main` push만. `develop`, `feature/` 에서는 절대 릴리즈가 일어나지 않는다.
- `concurrency.cancel-in-progress: true` — 연속 push 시 이전 워크플로우를 취소하여 중복 릴리즈를 방지한다.
- `fetch-depth: 0` — semantic-release가 마지막 릴리즈 태그 이후 전체 커밋 히스토리를 분석한다. 얕은 클론(`fetch-depth: 1`)에서는 히스토리가 잘려 버전 결정 실패.
- `permissions: contents: write` — semantic-release가 GitHub에 태그를 push하고 Release를 생성하려면 쓰기 권한이 필요하다.

### 2.3 semantic-release — 자동 버전 결정 및 NPM 배포

Conventional Commits 메시지를 파싱하여 버전을 자동 결정한다.

| 커밋 타입                               | 버전 영향             |
| --------------------------------------- | --------------------- |
| `feat:`                                 | minor (0.5.0 → 0.6.0) |
| `fix:`, `perf:`, `refactor:`, `revert:` | patch (0.5.0 → 0.5.1) |
| `BREAKING CHANGE:` 본문 포함            | major (0.5.0 → 1.0.0) |
| `docs:`, `test:`, `chore:`              | 변경 없음             |

**플러그인 실행 순서:**

```text
commit-analyzer → release-notes-generator → @semantic-release/changelog
→ @semantic-release/npm → @semantic-release/git → @semantic-release/github
```

`@semantic-release/git` 이 `CHANGELOG.md` 와 `package.json` 변경사항을 `chore(release): X.Y.Z [skip ci]` 메시지로 커밋한다. `[skip ci]` 가 없으면 이 커밋이 다시 Release 워크플로우를 트리거하는 무한 루프가 발생한다.

### 2.4 `"sideEffects": false` 추가 근거

번들러는 기본적으로 패키지 내 모든 코드를 번들에 포함시킨다. `sideEffects: false` 를 선언하면 번들러가 공격적인 Tree-shaking을 적용하여 소비자가 실제로 import한 심볼만 번들에 포함시킨다. 예를 들어 `DomainState` 만 import한 소비자의 번들에서 `DomainRenderer`, `FormBinder` 가 제거된다.

### 2.5 `@semantic-release/changelog` 설치 주의사항

이 패키지를 `package-lock.json` 과 함께 커밋하지 않으면 GitHub Actions의 `npm ci` 가 `Cannot find module '@semantic-release/changelog'` 에러를 낸다. `npm ci` 는 `package-lock.json` 에 없는 패키지를 설치하지 않기 때문이다. **반드시 `package.json` 과 `package-lock.json` 을 함께 커밋해야 한다.**

## 3. 결과

**브랜치 전략:**

```text
main          ← 릴리즈 전용. PR merge만 허용.
└── develop   ← 통합 브랜치
     ├── feature/xxx
     ├── fix/xxx
     └── refactor/xxx
```

**최종 반영 파일:**

| 파일                            | 종류 | 내용                                       |
| ------------------------------- | ---- | ------------------------------------------ |
| `eslint.config.js`              | 신규 | ESLint 9 Flat Config                       |
| `.prettierrc`                   | 신규 | 프로젝트 포맷 규칙                         |
| `commitlint.config.js`          | 신규 | Conventional Commits 강제                  |
| `.github/workflows/ci.yml`      | 신규 | lint + test + format:check                 |
| `.github/workflows/release.yml` | 신규 | semantic-release 파이프라인                |
| `.releaserc.json`               | 신규 | semantic-release 플러그인 체인             |
| `.npmignore`                    | 신규 | 배포 tarball 제외 목록                     |
| `package.json`                  | 수정 | scripts, `sideEffects`, `engines`, devDeps |

커밋 한 번으로 lint → test → build → CHANGELOG 생성 → NPM 배포 → GitHub Release 생성까지 전 과정이 자동으로 완결된다.
