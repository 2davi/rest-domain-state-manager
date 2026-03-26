# DI Refactor — Circular Dependency Elimination (2026-03-26)

> **Milestone:** `v1.0.0`
> **Branch:** `refactor/di-circular-dependency`
> **References:** `ard-0002-alignment.md § 3.2`

---

## (a) 코드 구조 현황 진단

### 순환 참조 실태

> `DomainState.js` ↔ `DomainPipeline.js`는 서로가 서로를 알아야 하는 **논리적 강결합(Tight Coupling)** 상태다.
> 현재는 이 구조적 모순을 런타임 브릿지 속성과 JSDoc 주석 꼼수로 봉합하고 있다.

```text
현재 의존 흐름 (문제)

  DomainState.js
  ├─ static PipelineConstructor = null        ← 런타임 브릿지 속성
  ├─ static all()
  │   └─ new DomainState.PipelineConstructor(...)  ← DomainPipeline을 간접 참조
  └─ @type {typeof import('./DomainPipeline.js')…} ← JSDoc 타입 임포트 (IDE hinting 전용)

  DomainPipeline.js
  ├─ import { ERR, LOG, ... }                 ← 런타임 import (단방향, 정상)
  └─ @typedef {import('./DomainState.js')…}   ← JSDoc 타입 임포트 (IDE hinting 전용)

  index.js (진입점)
  ├─ import DomainPipeline
  ├─ import DomainState
  └─ DomainState.PipelineConstructor = DomainPipeline  ← 브릿지 수동 주입
```

### 현 방식의 세 가지 구조적 결함

- **결함 1: 런타임 안전망 부재**
  - `DomainState.PipelineConstructor`는 `null`로 초기화된 `public` 정적 속성이다.
  - `index.js`를 거치지 않은 소비자(예: 트리 쉐이킹 후 개별 파일 직접 import)가 `DomainState.all()`을 호출하면 `throw new Error('[DSM] DomainPipeline이 주입되지 않았습니다...')`가 발화한다.
    - 이 에러는 정적 분석 단계에서 잡히지 않고 **런타임에 터진다.**
    - IDE는 `PipelineConstructor`가 공개 속성이므로 소비자가 외부에서 덮어쓰는 것을 막지 못한다.

- **결함 2: Vitest 단위 테스트 격리 불가**
  - `DomainState` 단독 테스트를 구성하려면, `DomainState.PipelineConstructor`에 **내부 브릿지 속성을 직접 덮어쓰는 꼼수**를 써야 한다.

```javascript
// 현재 테스트에서 필요한 꼼수
import { DomainState } from '../src/domain/DomainState.js';

// DomainPipeline 전체를 로드하지 않고 브릿지 속성을 직접 mock해야 한다
DomainState.PipelineConstructor = vi.fn(() => ({ run: vi.fn() }));
```

- 이 방식은 테스트 코드가 내부 구현 세부 사항(브릿지 속성명)에 강결합되어,
  리팩토링 시 테스트가 함께 깨지는 **Brittle Test** 문제를 내포한다.

**결함 3: `eslint-plugin-import/no-cycle` 미설치**

- 현재 `eslint.config.js`에 순환 참조 감지 규칙이 없어,
  향후 작업자가 의도치 않게 순환 참조를 재도입해도 CI 단계에서 자동 감지되지 않는다.
- `cicd_pipeline_20260323_01.md`에서 `eslint.config.js`가 이미 구성되었으므로, 규칙 한 줄 추가로 안전망을 구축할 수 있다.

---

## (b) 목표 아키텍처 설계

### 단방향 의존 그래프 확정

```text
목표 의존 흐름 (단방향)

  DomainPipeline.js
  └─ import { … } from './DomainState.js'  ← 런타임 단방향 의존 (정상)

  DomainState.js
  └─ (DomainPipeline를 전혀 알지 못함)     ← 역방향 의존 완전 제거

  index.js  (Composition Root)
  ├─ import DomainPipeline
  ├─ import DomainState
  └─ DomainState.configure({
         pipelineFactory: (...args) => new DomainPipeline(...args)
     })
```

- **의존 방향 원칙:** `DomainPipeline → DomainState`로 고정한다.
  - `DomainPipeline`은 `DomainState` 인스턴스를 인자로 받고 내부에서 다루므로, 이 방향의 의존은 불가피하고 자연스럽다.
  - 역방향(`DomainState → DomainPipeline`)은 `DomainState.all()`이라는 편의 메서드 하나 때문에 발생했다.
  - `DomainState.configure()`로 팩토리를 주입받으면, `DomainState`는 `DomainPipeline`의 존재 자체를 몰라도 된다.

### `DomainState.configure()` 인터페이스 설계

> 기존 `PipelineConstructor` 브릿지 속성을 `configure()` 정적 메서드로 대체한다.
> 소비자가 직접 접근할 수 없는 **모듈 레벨 클로저 변수**에 팩토리를 은닉한다.

```text
DomainState 모듈 내부 구조 (변경 후)

  [모듈 레벨]
  let _pipelineFactory = null;   ← 클로저 은닉. 외부 직접 접근 불가.

  [class DomainState]
  static configure({ pipelineFactory })
  └─ _pipelineFactory = pipelineFactory  ← 주입 창구는 오직 이 메서드 하나

  static all(resourceMap, options)
  └─ if (!_pipelineFactory) throw Error(...)
     return _pipelineFactory(resourceMap, options)
```

- `static PipelineConstructor = null` (public) → `let _pipelineFactory = null` (module-scoped)
  - 속성에서 모듈 레벨 변수로 교체하면 외부에서 직접 덮어쓸 수 없다.
  - 주입 창구가 `configure()` 하나로 명시적으로 제한된다.

### Composition Root 패턴 적용

```text
index.js 변경 전

  import { DomainPipeline } from '...';
  import { DomainState } from '...';
  DomainState.PipelineConstructor = DomainPipeline;   ← 브릿지 직접 주입

index.js 변경 후

  import { DomainPipeline } from '...';
  import { DomainState } from '...';
  DomainState.configure({
      pipelineFactory: (...args) => new DomainPipeline(...args)
  });                                                  ← 팩토리 주입 (Composition Root)
```

- `index.js`는 두 모듈을 `import`하는 **유일한 파일**이 된다.
- `DomainState.js`와 `DomainPipeline.js`는 각자 상대방의 파일을 알지 못한다.

---

## (c) 변경 파일별 세부 분석

### `eslint.config.js` — `import/no-cycle` 규칙 추가

- `cicd_pipeline_20260323_01.md`에서 구성된 Flat Config에 `eslint-plugin-import`를 추가한다.
- 추가 설치 패키지: `eslint-plugin-import`
- 규칙 추가 위치: `eslint.config.js`의 소스 파일 대상 설정 블록

```text
추가할 패키지
  npm install -D eslint-plugin-import

추가할 규칙
  'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }]
```

- `maxDepth: Infinity`: 간접 순환(A→B→C→A)도 모두 감지
- `ignoreExternal: true`: `node_modules` 내부까지 추적하지 않아 성능 저하 방지

### `DomainState.js` — 3개 지점 수정

| 수정 지점      | 변경 전                                         | 변경 후                                      |
| -------------- | ----------------------------------------------- | -------------------------------------------- |
| 모듈 레벨 변수 | (없음)                                          | `let _pipelineFactory = null` 추가           |
| 정적 속성      | `static PipelineConstructor = null`             | **제거**                                     |
| 정적 메서드    | (없음)                                          | `static configure({ pipelineFactory })` 추가 |
| `all()` 내부   | `DomainState.PipelineConstructor` 참조          | `_pipelineFactory` 참조로 교체               |
| JSDoc          | `@type {typeof import('./DomainPipeline.js')…}` | **제거**                                     |

### `index.js` — 브릿지 주입 → Composition Root

| 수정 지점   | 변경 전                                            | 변경 후                                                                                |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 의존성 조립 | `DomainState.PipelineConstructor = DomainPipeline` | `DomainState.configure({ pipelineFactory: (...args) => new DomainPipeline(...args) })` |

- export 구조 및 나머지 import 구문은 변경 없음.

### `DomainPipeline.js` — JSDoc `@typedef` 정리

- 런타임 `import` 구문은 원래부터 없었으므로 변경 없음.
- JSDoc `@typedef {import('./DomainState.js')…}` 참조는 런타임에 영향이 없으므로 유지.
  - 단, IDE 자동완성 및 TypeDoc 문서화를 위해 의도적으로 남겨두는 것임을 주석으로 명시한다.

---

## (d) 예상 시나리오

### 소비자 관점: 변경 후 정상 흐름

```text
① 소비자가 index.js 진입점을 통해 라이브러리를 로드

  import { DomainState, ApiHandler } from 'rest-domain-state-manager';
  └─ index.js 평가 시점에 DomainState.configure() 자동 실행됨
     → _pipelineFactory 주입 완료

② DomainState.all() 호출

  const pipeline = DomainState.all({
      roles: api.get('/api/roles'),
      user:  api.get('/api/users/1'),
  }, { strict: false });
  └─ _pipelineFactory(resourceMap, options) 호출
     → new DomainPipeline(resourceMap, options) 반환
     → DomainState는 DomainPipeline의 존재를 모르고, 팩토리만 실행함
```

### Vitest 단위 테스트 격리 흐름 (변경 후)

```text
DomainState 단독 테스트 파일

  import { DomainState } from '../src/domain/DomainState.js';
  // DomainPipeline import 불필요

  beforeEach(() => {
      const mockFactory = vi.fn(() => ({ run: vi.fn() }));
      DomainState.configure({ pipelineFactory: mockFactory });
  });

  it('.all()이 팩토리 반환값을 그대로 반환한다', () => {
      const pipeline = DomainState.all({ key: Promise.resolve() });
      expect(pipeline.run).toBeTypeOf('function');
  });
```

- `DomainPipeline`을 전혀 로드하지 않고 `DomainState`만 독립적으로 테스트 가능.
- `configure()` API를 통한 mock 주입이 **공개 계약(Public Contract)** 이므로 구현 변경에 취약하지 않다.

### `import/no-cycle` 재발 방지 시나리오

```text
누군가 실수로 DomainState.js에서 DomainPipeline.js를 직접 import하면

  // DomainState.js
  import { DomainPipeline } from './DomainPipeline.js';  ← 실수

  → npm run lint 실행 시
  error: Dependency cycle detected. (import/no-cycle)
     DomainState.js → DomainPipeline.js → DomainState.js
  
  → CI 파이프라인에서 자동 차단됨
```

---

## (e) 계획 수립

### 수정 파일 목록 및 변경 범위

| 파일 | 변경 종류 | 변경 내용 |
| --- | --- | --- |
| `package.json` | **수정** | `eslint-plugin-import` devDependency 추가 |
| `eslint.config.js` | **수정** | `eslint-plugin-import` 플러그인 등록 + `import/no-cycle` 규칙 추가 |
| `src/domain/DomainState.js` | **수정** | 모듈 레벨 `_pipelineFactory` 추가, `static PipelineConstructor` 제거, `static configure()` 추가, `all()` 내부 참조 교체, JSDoc 업데이트 |
| `index.js` | **수정** | `PipelineConstructor` 직접 주입 → `DomainState.configure()` 호출로 교체 |
| `src/domain/DomainPipeline.js` | **수정** | JSDoc 주석에 "IDE hinting 전용, 런타임 의존성 없음" 명시 추가 |
| `README.md` | **수정** | 모듈 의존 방향 다이어그램 갱신 |
| `tests/domain/DomainState.test.js` | **수정** | `PipelineConstructor` 직접 주입 방식 → `configure()` API 방식으로 교체 |

### Feature 브랜치명

```text
refactor/di-circular-dependency
```

- 기존 동작하는 외부 API(`DomainState.all()`)가 유지되므로 `feature/`가 아닌 `refactor/`
- 소비자 입장에서는 변경이 없으나 내부 구조가 개편되는 **아키텍처 리팩토링**이다.

### Commit Sequence

```markdown
# STEP A — ESLint 순환 참조 감지 안전망 구축
refactor(config): add eslint-plugin-import no-cycle rule

  - eslint-plugin-import devDependency 추가
  - eslint.config.js에 import/no-cycle 규칙 추가
  - maxDepth: Infinity, ignoreExternal: true 옵션 설정
  - npm run lint 실행으로 DomainState ↔ DomainPipeline 순환 경로 공식 확인


# STEP B + C — DomainState 의존성 역전 핵심 작업
refactor(domain): replace PipelineConstructor bridge with configure() DI pattern

  - 모듈 레벨 _pipelineFactory 클로저 변수 도입 (외부 직접 접근 차단)
  - static PipelineConstructor public 속성 제거
  - static configure({ pipelineFactory }) 메서드 추가
  - all() 내부 참조를 DomainState.PipelineConstructor → _pipelineFactory로 교체
  - DomainPipeline JSDoc 타입 임포트 및 관련 @type 선언 제거
  - JSDoc 업데이트: configure() 메서드 파라미터 및 에러 조건 명세


# STEP D — index.js Composition Root 재구성
refactor(core): restructure index.js as composition root via configure()

  - DomainState.PipelineConstructor 직접 주입 제거
  - DomainState.configure({ pipelineFactory }) 호출로 교체
  - 두 도메인 모듈이 오직 index.js에서만 조립됨을 주석으로 명시


# STEP E — Vitest 단위 테스트 격리 검증
test(domain): verify DomainState isolation with mocked pipelineFactory

  - DomainState.test.js: PipelineConstructor 직접 주입 방식 제거
  - configure({ pipelineFactory: vi.fn() }) 방식으로 mock 교체
  - DomainPipeline import 없이 DomainState 전체 테스트 통과 확인
  - all() 메서드: 팩토리 반환값을 그대로 반환하는지 단위 테스트 추가
  - configure() 미호출 시 all() 에러 throw 케이스 추가


# STEP F — 아키텍처 의존 다이어그램 문서 갱신
docs: update module dependency diagram for unidirectional DI architecture

  - README.md 모듈 의존 방향 다이어그램 갱신
  - DomainPipeline → DomainState 단방향 구조 명시
  - index.js가 Composition Root 역할을 수행함을 다이어그램에 반영
  - DomainPipeline.js JSDoc 주석: @typedef 유지 근거 명시
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                     | 기준                                                      |
| ------------------------ | --------------------------------------------------------- |
| `npm run lint`           | `import/no-cycle` 위반 0건                                |
| `DomainState.test.js`    | `DomainPipeline` import 없이 전체 테스트 통과             |
| `DomainPipeline.test.js` | 기존 테스트 케이스 전체 통과 (회귀 없음)                  |
| `all()` 동작             | `configure()` 후 `DomainPipeline` 인스턴스 정상 반환 확인 |
| `all()` 에러             | `configure()` 미호출 시 명확한 에러 메시지 throw 확인     |
| ESLint CI                | `ci.yml` 워크플로우에서 `import/no-cycle` 자동 차단 확인  |
