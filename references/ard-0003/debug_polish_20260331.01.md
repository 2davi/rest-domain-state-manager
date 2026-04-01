# Debug & Documentation Polish (2026-03-31)

> **Milestone:** `v1.5.x`
> **Branch:** `chore/debug-polish`
> **References:** `ard-0003-alignment.md § 7 (v1.5.x)`, `ard-0003-alignment.md 전체`

---

## (a) 현행 상태 진단

### v1.1.x ~ v1.4.x 누적 작업의 후처리 필요성

네 개의 feature 마일스톤을 거치는 동안 다음 항목들이 불일치 상태로 누적될 수 있다:

| 유형 | 발생 원인 | 리스크 |
|---|---|---|
| JSDoc 누락 | 빠른 구현 진행 중 주석 후순위 처리 | TypeDoc 생성 문서 불완전, IDE 자동완성 부재 |
| JSDoc 불일치 | 인터페이스 변경 후 주석 미갱신 | 문서와 코드가 따로 노는 신뢰도 하락 |
| deprecated 주석 미처리 | FormBinder/DomainRenderer 경고 누락 | 소비자가 이전 플러그인 계속 사용 |
| console 레벨 불일치 | `warn` / `error` / `devWarn` 혼용 | 운용 환경 콘솔 오염 |
| Vitest 커버리지 공백 | 엣지 케이스 누락 | Silent Failure 미탐지 |
| DomainVO 포지셔닝 미반영 | 선택적 레이어 재분류 문서화 미완료 | 소비자가 VO를 필수로 오해 |

### 핵심 원칙: "문서와 코드가 따로 노는 순간 라이브러리의 신뢰도는 박살 난다"

ard-0001-alignment.md에서 명시된 원칙이다.
이 마일스톤은 신규 기능을 추가하지 않는다. 기존 구현을 정비하고 서류를 맞추는 작업이다.

---

## (b) 점검 항목 및 작업 목록

### 점검 1. `DomainVO` 선택적 레이어 재분류

**배경:** `ard-0003-alignment.md` 진단 결과, `DomainVO`는 V8 Inline Caching 논거가 Proxy 도입으로 무효화되었으므로 필수가 아닌 선택적 부가 기능으로 재분류된다.

**작업 목록:**

| 파일 | 작업 내용 |
|---|---|
| `src/domain/DomainVO.js` | JSDoc 모듈 설명에 "선택적 레이어" 명시. V8 Hidden Class 논거 제거. 실제 가치(유효성 검사, 변환 함수 중앙화)만 기술. |
| `src/domain/DomainState.js` | `fromJSON()` / `fromVO()` JSDoc `@param options.vo` 주석에 "VO 없이도 완전히 동작한다" 명시 추가. VO 있는 심화 흐름은 별도 `@example` 캡션으로 구분. |
| `index.js` | 모듈 주석에서 VO 필수 뉘앙스 제거. |

---

### 점검 2. JSDoc 누락 및 불일치 전수 점검

**점검 대상 파일 목록:**

```text
신규 생성 파일 (v1.1.x ~ v1.4.x)
  src/domain/DomainCollection.js
  src/workers/diff.worker.js
  src/common/lcs-diff.js
  src/ui/UILayout.js
  src/ui/UIComposer.js
  src/ui/collection/*.js

기존 수정 파일
  src/domain/DomainState.js    ← v1.1.x, v1.2.x에서 다수 변경
  src/network/api-handler.js  ← v1.1.x에서 idempotent 옵션 추가
  src/core/api-proxy.js       ← v1.2.x에서 trackingMode 분기 추가
```

**JSDoc 점검 체크리스트:**

| 항목 | 기준 |
|---|---|
| `@param` 완전성 | 모든 공개 메서드의 파라미터 타입과 설명 존재 |
| `@returns` 완전성 | 반환값이 있는 모든 메서드에 `@returns` 존재 |
| `@throws` 완전성 | Error를 throw하는 모든 메서드에 `@throws` 및 조건 명시 |
| `@example` 존재 | 공개 API 메서드에 최소 1개 `@example` 존재 |
| `@deprecated` 반영 | FormBinder, DomainRenderer 모듈 레벨 JSDoc에 `@deprecated` 태그 존재 |
| TypeDoc 빌드 | `npm run docs:api` 에러 없이 완료 확인 |

---

### 점검 3. `console` 출력 레벨 일관성 검토

**현재 라이브러리 내 로그 레벨 체계:**

```text
devWarn(msg)    → NODE_ENV !== 'production' 시만 출력. 개발 환경 전용 경고.
logError(msg)   → 환경 무관 출력. 기능에 영향을 주는 심각한 문제.
console.warn    → 직접 호출. 레벨 관리 대상.
console.error   → 직접 호출. 레벨 관리 대상.
```

**점검 기준:**

| 메시지 유형 | 적절한 레벨 | 현재 상태 확인 |
|---|---|---|
| Extra Keys 감지 (DomainVO) | `devWarn` — 운용 환경 콘솔 오염 방지 | 확인 필요 |
| `restore()` 스냅샷 없음 | `devWarn` — 정보성 경고 | 확인 필요 |
| `save()` 롤백 발생 | `logError` — 기능 영향 있음 | 확인 필요 |
| CSRF 토큰 없음 (`init()` 후) | `logError` → throw — 요청 차단 | v1.1.x에서 구현됨, 재확인 |
| Idempotency-Key UUID 발급 실패 | `devWarn` — 폴백 가능 시 경고만 | 확인 필요 |
| deprecated 플러그인 사용 | `devWarn` — 운용에서 불필요한 노이즈 방지 | v1.4.x에서 구현됨, 재확인 |
| CollectionBinder guard 초과 | `console.warn` — 임계값 이상 행 수 경고 | v1.4.x 실측 후 추가됨, 재확인 |

---

### 점검 4. Vitest 커버리지 공백 확인

**점검 방법:** `npm test -- --coverage` 실행 후 커버리지 리포트 분석.

**우선 점검 대상 — 엣지 케이스:**

| 파일 | 점검 케이스 |
|---|---|
| `DomainState.save()` | `trackingMode: 'lazy'` + `handler._idempotent: true` 조합 동시 작동 확인 |
| `DomainState.restore()` | `#idempotencyKey = undefined` + `#snapshot = undefined` 동시 확인 |
| `DomainCollection.remove()` | 빈 컬렉션에서 `remove()` 호출 시 에러 없음 확인 |
| `lcs-diff.js` | `itemKey` 있을 때 / 없을 때 모두 경계 케이스 (빈 배열, 단일 항목 배열) 확인 |
| `UIComposer` | `UIComposer` 설치 전 `bind()` 호출 → 명확한 에러 throw 확인 |
| `ApiHandler.init()` | `csrfToken` 직접 주입 + `idempotent: true` 동시 활성 시 헤더 두 개 모두 포함 확인 |

---

### 점검 5. Silent Failure 방어 로직 보강

**Silent Failure 정의:** 라이브러리가 잘못된 상태에서 에러 없이 계속 진행하여
소비자가 문제를 인지하지 못하는 상황.

**점검 목록:**

| 시나리오 | 현재 처리 | 목표 처리 |
|---|---|---|
| `DomainCollection.fromJSONArray()` — 배열이 아닌 JSON 수신 | 미확인 | 즉시 명확한 에러 throw |
| `UILayout.columns[field].selector` — DOM에 없는 요소 지정 | 미확인 | `devWarn` 출력 후 해당 필드 건너뜀 |
| `bindCollection()` — `templateSelector` DOM에 없음 | 미확인 | 즉시 명확한 에러 throw |
| `saveAll()` — `path` 인자 없이 호출 | 미확인 | `ApiHandler` 에러 위임 또는 사전 throw |

---

## (c) 변경 파일별 세부 분석

### 수정 범위 원칙

이 마일스톤에서 **새로운 런타임 동작을 추가하지 않는다.**
JSDoc 수정, 에러 메시지 명확화, 로그 레벨 수정은 런타임 동작 변경이 아니다.
Silent Failure → Error throw 전환은 런타임 동작 변경이므로 Vitest 테스트 추가를 수반한다.

---

## (d) 예상 시나리오

### 시나리오 1. TypeDoc 빌드 검증

```text
npm run docs:api

  → typedoc --options typedoc.json
  → 경고 없이 완료
  → docs/api/ 하위에 UIComposer, UILayout, DomainCollection 문서 생성 확인
  → DomainVO 모듈 설명에 "선택적" 문구 반영 확인
```

### 시나리오 2. 커버리지 목표

```text
npm test -- --coverage

  목표:
    Lines   ≥ 85%
    Branches ≥ 80%
    Functions ≥ 90%

  특별 주목:
    lcs-diff.js: 100% (핵심 알고리즘, 엣지 케이스 모두 커버)
    DomainCollection.js: ≥ 90%
    UIComposer.js: ≥ 85%
```

---

## (e) 계획 수립

### 수정 파일 목록

| 파일 | 변경 종류 | 변경 내용 |
|---|---|---|
| `src/domain/DomainVO.js` | **수정** | JSDoc 모듈 설명 갱신: 선택적 레이어 명시, V8 논거 제거 |
| `src/domain/DomainState.js` | **수정** | `fromJSON()` JSDoc: VO 없는 기본 흐름 우선 명시, `save()` JSDoc: lazy/idempotent 병행 설명 |
| `src/network/api-handler.js` | **수정** | `idempotent` 옵션 JSDoc 보완 |
| `src/domain/DomainCollection.js` | **수정** | 전체 JSDoc 점검: @param, @returns, @throws, @example |
| `src/ui/UILayout.js` | **수정** | 전체 JSDoc 점검 |
| `src/ui/UIComposer.js` | **수정** | 전체 JSDoc 점검 |
| `src/common/lcs-diff.js` | **수정** | 알고리즘 설명 JSDoc 보강 |
| `src/common/logger.js` | **수정** | 로그 레벨 체계 주석 추가 |
| `src/plugins/form-binder/FormBinder.js` | **수정** | `@deprecated` 확인 및 `devWarn` 레벨 적용 |
| `src/plugins/domain-renderer/DomainRenderer.js` | **수정** | `@deprecated` 확인 및 `devWarn` 레벨 적용 |
| 해당 테스트 파일들 | **수정** | 커버리지 공백 채우는 엣지 케이스 추가 |

### Feature 브랜치명

```text
chore/debug-polish
```

신규 기능 없음. JSDoc, 로그 레벨, 엣지 케이스 방어 정비이므로 `chore/`.

### Commit Sequence

```markdown
# STEP A — DomainVO 선택적 레이어 재분류
docs(domain): reposition DomainVO as optional layer in JSDoc

  - DomainVO 모듈 JSDoc: 선택적 레이어 명시, V8 Hidden Class 논거 제거
  - DomainState.fromJSON() @param options.vo: "VO 없이도 완전히 동작" 명시
  - fromJSON() @example 캡션 분리: 기본 흐름(VO 없음) 우선, VO 심화 흐름 별도


# STEP B — JSDoc 전수 점검 및 보완
docs: audit and complete JSDoc across v1.1.x~v1.4.x additions

  - DomainCollection.js: @param, @returns, @throws, @example 전체 추가
  - UILayout.js: static fields 설명 보완
  - UIComposer.js: install() 메서드 및 주입 메서드 설명 보완
  - lcs-diff.js: 알고리즘 동작 설명 강화
  - api-handler.js: idempotent 옵션 @param 보완
  - DomainState.js: #idempotencyKey, _trackingMode, _initialSnapshot 설명 보완


# STEP C — console 출력 레벨 일관성 정비
refactor(common): normalize log levels across library

  - logger.js: devWarn/logError 사용 기준 주석 추가
  - Extra Keys 경고: console.warn → devWarn 전환 (운용 환경 콘솔 오염 방지)
  - restore() 스냅샷 없음: console.warn → devWarn
  - deprecated 플러그인: console.warn → devWarn


# STEP D — Silent Failure 방어 로직 보강
fix: add explicit error throws for silent failure scenarios

  - DomainCollection.fromJSONArray(): 배열 아닌 JSON 수신 시 Error throw
  - UIComposer.bindCollection(): templateSelector DOM에 없을 때 Error throw
  - UILayout.columns selector 미존재: devWarn + 해당 필드 건너뜀
  - 각 케이스 Vitest 테스트 추가


# STEP E — Vitest 커버리지 공백 보강
test: fill coverage gaps from v1.1.x~v1.4.x milestones

  - lazy+idempotent 조합 save() 동시 작동 확인
  - restore() 이후 #idempotencyKey undefined 확인
  - DomainCollection.remove() 빈 컬렉션 방어 확인
  - lcs-diff.js 경계 케이스: 빈 배열, 단일 항목 배열
  - ApiHandler 헤더 두 개 동시 삽입 (CSRF + Idempotency-Key) 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목 | 기준 |
|---|---|
| `npm run lint` | error 0건 |
| `npm test` | 전체 테스트 통과 |
| `npm test -- --coverage` | Lines ≥ 85%, Branches ≥ 80%, Functions ≥ 90% |
| `npm run docs:api` | 경고 없이 완료, UIComposer / UILayout / DomainCollection 문서 생성 확인 |
| DomainVO JSDoc | "선택적 레이어" 문구 반영 확인 |
| `fromJSON()` JSDoc | VO 없는 기본 흐름 @example 첫 번째로 배치 확인 |
| 로그 레벨 | Extra Keys 경고 운용 환경에서 `devWarn`으로 억제 확인 |
| Silent Failure | 배열 아닌 JSON 수신 시 Error throw 확인 |
| deprecated | FormBinder `use()` 시 `devWarn` 발화 확인 |
