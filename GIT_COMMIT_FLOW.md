# Git Commit Flow

이 문서는 **REST Domain State Manager(rest-domain-state-manager)** 레포지토리의 Git 브랜치/커밋/릴리스 흐름을 정의한다.
목적은 다음과 같다.

- `main` 브랜치를 **릴리스 전용**으로 보호한다.
- `dev` 브랜치를 **통합 개발 브랜치**로 사용한다.
- 모든 기능/수정은 **단기 feature 브랜치**에서 작업한다.
- 커밋 메시지는 **Conventional Commits** 규칙을 따른다.
- PR(Pull Request) merge 전에는 항상 **rebase/squash로 히스토리를 정리**한다.

---

## 1. 브랜치 전략

### 1.1 브랜치 종류

- **`main`**
  - NPM 배포, semantic-release, GitHub Release가 동작하는 **릴리스 전용 브랜치**.
  - 직접 커밋 금지. 오직 `dev` 또는 `fix/*` PR merge로만 변경한다.
- **`dev`**
  - 모든 기능 개발이 합쳐지는 **통합 개발 브랜치**.
  - `feature/*`, `fix/*`, `refactor/*` 등 단기 브랜치의 merge 대상.
- **단기 작업 브랜치**
  - `feature/<도메인>-<기능요약>`
  - `fix/<도메인>-<버그요약>`
  - `refactor/<영역>-<리팩토링요약>`
  - `docs/<영역>-<문서요약>`
  - `chore/<영역>-<환경-도구변경>`
  - 항상 `dev` 또는 `main`에서 분기한다.

### 1.2 브랜치 생성 규칙

새 기능/개선:

```bash
git switch dev
git pull origin dev
git switch -c feature/<scope>-<short-desc>
```

프로덕션 긴급 버그(hotfix):

```bash
git switch main
git pull origin main
git switch -c fix/<scope>-<bug-desc>
```

---

## 2. 기본 작업 흐름 (일반 기능 개발)

VSCode는 **터미널만 사용**하고, UI는 사용하지 않는 것을 전제로 한다.

### 2.1 작업 시작

```bash
git switch dev
git pull origin dev
git switch -c feature/<scope>-<short-desc>
```

예:

```bash
git switch dev
git pull origin dev
git switch -c feature/domain-optimistic-rollback
```

### 2.2 로컬 커밋 루틴

1. 변경사항 확인

   ```bash
   git status
   ```

2. 의미 있는 단위로 나눠서 commit

   ```bash
   git add <파일들>
   git commit -m "feat(domain): add optimistic rollback snapshot API"
   ```

3. 필요하면 여러 번 커밋하되, **한 커밋에는 하나의 논리 변경만 담는다**.

### 2.3 리모트 푸시 및 PR 생성

```bash
git push -u origin feature/<scope>-<short-desc>
```

GitHub에서:

- base(베이스): `dev`
- compare: `feature/<scope>-<short-desc>`
- CI 통과 후 리뷰 → **Squash & merge** 또는 rebase 기반 merge.

---

## 3. 긴급 수정 및 문서/환경 작업

### 3.1 프로덕션 긴급 버그 핫픽스

기준: 이미 릴리스된 버전에 치명적 버그 → `main`에서 바로 분기.

```bash
git switch main
git pull origin main
git switch -c fix/<scope>-<bug-desc>

# 작업
git add ...
git commit -m "fix(core): resolve proxy trap context loss on nested object"
git push -u origin fix/<scope>-<bug-desc>
```

GitHub에서 base를 `main`으로 하는 PR 생성 → merge 후 semantic-release가 patcH 버전 배포.

### 3.2 문서 및 설정 변경

문서/설정만 수정일 때도 브랜치 규칙은 동일하다.
예: 개발 계획/레퍼런스 문서(`ard-0002-alignment.md`) 추가.

```bash
git switch dev
git pull origin dev
git switch -c docs/roadmap-ard-0002

git add references/ard-0002-alignment.md PORTFOLIO.md
git commit -m "docs(roadmap): add ARD-0002 alignment reference"
git push -u origin docs/roadmap-ard-0002
```

- **타입(type)은 `docs`**, 스코프(scope)는 문서의 역할/도메인을 짧게 표현 (`roadmap`, `architecture`, `cicd`, `rollback` 등).

---

## 4. 커밋 히스토리 정리: rebase, squash

목표가 "커밋 기록 예쁘게 정리"인 만큼, **PR 올리기 전 로컬에서 항상 rebase/squash를 거친다**.

### 4.1 rebase로 기반 브랜치 최신화

작업 중에 `dev`가 앞서나갔을 때:

```bash
git switch dev
git pull origin dev

git switch feature/<scope>-<short-desc>
git rebase dev
```

- 충돌(conflict)이 나면:
  1. 파일에서 충돌 해결 후 `git add <파일>`
  2. `git rebase --continue`
- rebase를 취소하고 싶으면 `git rebase --abort`.

### 4.2 인터랙티브 rebase로 커밋 정리(squash)

기능 개발 중 커밋이 너무 잘게 나뉘었을 때:

```bash
git switch feature/<scope>-<short-desc>
git rebase -i dev
```

에디터에서:

- 첫 커밋: `pick`
- 합치고 싶은 나머지 커밋: `s` 또는 `squash`

저장/종료 후, 합쳐진 커밋 메시지를 깔끔하게 정리.

예시 최종 메시지:

```text
feat(domain): add optimistic rollback snapshot API

- add DomainState.saveSnapshot and restoreSnapshot
- integrate with DomainPipeline rollback policy
- add Vitest scenarios for sequential/parallel rollback
```

> 원칙: **PR 기준으로 "읽을 만한 커밋 1~3개" 상태로 정리**하고 올린다.

---

## 5. main으로 릴리스 플로우

### 5.1 dev → main 릴리스

여러 feature/fix가 `dev`에 합쳐진 후 배포를 진행할 때:

1. `dev` 최신화

   ```bash
   git switch dev
   git pull origin dev
   ```

2. `main` 최신화 후 `dev`를 merge로 가져오기

   ```bash
   git switch main
   git pull origin main
   git merge --no-ff dev
   # 또는 GitHub에서 dev → main PR 생성
   ```

3. `main`에 push되면 GitHub Actions `release.yml`이 동작하고, semantic-release가:
   - Conventional Commits를 분석해 SemVer 버전 업 (feat → minor, fix/refactor/perf/revert → patch, docs/test/chore → 버전 변경 없음).
   - CHANGELOG.md 업데이트, package.json 버전 변경.
   - NPM publish 및 GitHub Release 생성.

### 5.2 feature 브랜치 정리

PR merge 후:

```bash
git branch -d feature/<scope>-<short-desc>
git push origin --delete feature/<scope>-<short-desc>
```

정기적으로 원격 정리:

```bash
git fetch --prune
```

---

## 6. Conventional Commits 규칙 (커밋 타입/스코프 가이드)

`commitlint.config.js`에서 허용하는 타입은 다음과 같다.

```js
[ 'feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'revert' ]
```

semantic-release는 타입별로 다음과 같이 동작한다.

| 타입(type)   | 용도                     | SemVer 영향    | 예시 상황                                                   |
| ------------ | ------------------------ | -------------- | ----------------------------------------------------------- |
| **feat**     | 새로운 기능 추가         | **minor** +1   | 새로운 DomainState API, 새로운 Pipeline 기능 추가           |
| **fix**      | 버그 수정                | **patch** +1   | Proxy trap 오작동, rollback 실패, 메모리 릭 수정            |
| **refactor** | 기능 변경 없는 구조 개선 | **patch** +1   | 성능/가독성 개선, 모듈 분리, 의존성 구조 개선               |
| **perf**     | 성능 최적화              | **patch** +1   | microtask batching, JSON Patch 최적화                       |
| **docs**     | 문서 변경                | 버전 변화 없음 | README, ARCHITECTURE, ARD, CI 문서, roadmap 문서            |
| **test**     | 테스트 코드 변경         | 버전 변화 없음 | Vitest 추가/수정, 시나리오 보강                             |
| **chore**    | 빌드/도구/CI 등 기타     | 버전 변화 없음 | ESLint/Prettier 설정, GitHub Actions, semantic-release 설정 |
| **revert**   | 이전 커밋 되돌리기       | **patch** +1   | 잘못 릴리스된 기능 롤백                                     |

### 6.1 스코프(scope) 작명 가이드

도메인(코드 영역) 기준으로 짓는다.

- `domain` : `DomainState`, `DomainVO`, core engine 관련
- `pipeline` : `DomainPipeline`, rollback/트랜잭션 정책
- `api` : `api-handler`, `api-mapper`, HTTP/CSRF 관련
- `worker` : Web Worker, stateRegistry, toPatch offloading 관련
- `debug` : debug channel, logging, diagnostics 관련
- `docs` : 문서 구조, 문서 시스템 자체 변경
- `cicd` : GitHub Actions, semantic-release, lint/test pipeline
- `build` : Vite/Rollup, tsconfig, bundling 설정

### 6.2 문서/계획/레퍼런스 커밋의 타입/스코프 예시

아키텍처 문서 추가/수정:

```text
docs(architecture): add V8 proxy JIT performance analysis
docs(architecture): refine rollback saga pattern constraints
```

개발 계획/Alignment 문서 추가 (`ard-0002-alignment.md` 같은 경우):

```text
docs(roadmap): add ARD-0002 alignment for rollback and DI roadmap
```

CI/CD 파이프라인 문서/설정 변경:

```text
docs(cicd): document semantic-release npm publishing pipeline
chore(cicd): add GitHub Actions CI and release workflows
```

테스트 전략/시나리오 문서:

```text
docs(test): add Vitest scenarios for optimistic rollback
```

> 규칙: **코드 동작에 관여하지 않는 설명/계획/가이드 → `docs`**, CI/빌드/도구 설정 변경 → `chore`.

---

## 7. 브랜치/커밋 실수 방지 루틴 (체크리스트)

터미널만 쓴다는 전제로, 브랜치 실수/히스토리 오염을 막는 일상 루틴이다.

1. **작업 시작 전**

   ```bash
   git status      # 현재 브랜치, 클린 상태 확인
   git branch      # * 표시된 브랜치가 맞는지 확인
   ```

2. **항상 dev에서 분기**

   ```bash
   git switch dev
   git pull origin dev
   git switch -c feature/<scope>-<short-desc>
   ```

3. **커밋 전**

   ```bash
   git status               # 변경 파일 목록 확인
   git diff                 # 수정 내용 확인 (unstaged)
   git diff --cached        # 수정 내용 확인 (staged)
   ```

4. **PR 올리기 전**

   ```bash
   git switch dev
   git pull origin dev

   git switch feature/<scope>-<short-desc>
   git rebase dev                            # 필요 시 -i로 squash
   git log --oneline --graph --decorate      # 최종 히스토리 확인
   ```

5. **merge 후**

   ```bash
   git switch dev
   git pull origin dev
   git branch -d feature/<scope>-<short-desc>
   git fetch --prune
   ```

---

## 8. 커밋 메시지 Before/After 리팩토링 예시

### 8.1 개발 계획/Alignment 문서 커밋

실제 상황: 다음 개발 계획을 정리한 ARD 문서를 레포에 추가.

#### 8.1.A. Before (나쁜 예)

```text
docs: add new document
```

- 타입만 있고, 무엇을, 왜 추가했는지 알 수 없다.

#### 8.1.B. After (권장 예)

```text
docs(roadmap): add ARD-0002 alignment for rollback and DI roadmap
```

- 타입: `docs`
- 스코프: `roadmap` → "향후 개발 방향/정렬" 문서임을 암시.
- subject: 어떤 ARD 문서인지, 주요 포커스(rollback, DI)를 보여 줌.

---

### 8.2 CI/CD 파이프라인 도입 커밋

실제 상황: ESLint/Prettier, GitHub Actions CI/Release, semantic-release 설정을 도입.

#### 8.2.A. Before (나쁜 예)

```text
chore: update configs
```

- 무엇을 업데이트했는지 전혀 알 수 없음.

#### 8.2.B. After (권장 예)

```text
chore(cicd): add GitHub Actions CI and semantic-release pipeline
```

- 타입: `chore` (동작 로직보다는 도구/파이프라인).
- 스코프: `cicd`.
- subject: CI와 릴리스 파이프라인이 도입되었음을 명확히 표현.

---

### 8.3 Optimistic Rollback(옵티미스틱 롤백) 기능 구현 커밋

실제 상황: DomainState/DomainPipeline에 스냅샷 기반 롤백 기능 구현, Vitest 시나리오 추가.

#### 8.3.A. Before (나쁜 예)

```text
feat: add rollback
```

- 어디에, 어떤 방식의 롤백인지 모호하다.

#### 8.3.B. After (권장 예)

```text
feat(domain): add snapshot-based optimistic rollback API
```

- 타입: `feat`.
- 스코프: `domain` (DomainState 중심 변경).
- subject: 스냅샷 기반 옵티미스틱 롤백 API라는 것을 명확하게 표현.

추가로 테스트만 따로 커밋할 경우:

```text
test(rollback): add Vitest scenarios for sequential and parallel rollback
```

---

### 8.4 리팩토링/성능 최적화 커밋

실제 상황: Proxy 트랩, JSON Patch, microtask batching을 이용해 성능/구조 개선.

#### 8.4.A. Before (나쁜 예)

```text
refactor: code cleanup
```

#### 8.4.B. After (권장 예)

```text
refactor(domain): separate core engine and DOM coupling
perf(worker): offload heavy JSON Patch to Web Worker
```

- 첫 커밋: 구조적 리팩토링 (코어 엔진과 DOM 분리).
- 둘째 커밋: 성능 최적화 (무거운 JSON Patch를 워커로 위임).

> 같은 브랜치 안에서 구조 리팩토링과 성능 최적화가 섞여 있다면, 가능하면 **두 개의 커밋으로 분리**하는 쪽을 선호한다.

---

### 8.5 "애매한 문서/메모"를 남길 때의 가이드

일정/생각 정리, 메모 수준 문서라도, 나중에 보면 전부 **프로젝트의 설계 히스토리**다.

#### 피해야 할 패턴

```text
docs: update notes
docs: wip
chore: tmp
```

#### 권장 패턴

```text
docs(roadmap): outline next milestones for Web Worker offloading
docs(architecture): capture V8 proxy JIT trade-offs and GC behavior
docs(cicd): document release branching strategy for dev and main
```

> 이 수준까지 맞춰 두면, 나중에 `git log --oneline`만 봐도 **어떤 의사결정이 언제, 어떤 맥락에서 이루어졌는지** 바로 복원할 수 있다.
