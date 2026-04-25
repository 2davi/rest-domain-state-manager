# Deep Copy Algorithm & Log Level Control (2026-03-27)

> **Milestone:** `v1.4.0`
> **Branch:** `feat/safe-clone-log-level`
> **References:** `ard-0002-alignment.md § 3.4`

---

## (a) 현행 코드 진단

### 문제 1 — `DomainVO.toSkeleton()`의 `JSON.parse(JSON.stringify())`

```javascript
// 현재 DomainVO.toSkeleton() 156번째 줄
val !== null && typeof val === 'object'
    ? JSON.parse(JSON.stringify(val))   // ← 문제
    : val,
```

이 방식이 조용히 파괴하는 타입들:

| 타입 | 결과 |
|---|---|
| `Date` 객체 | ISO 문자열로 변환 (타입 손실) |
| `undefined` 값 | 키 자체 소멸 |
| `Map`, `Set` | 빈 `{}` 또는 `[]`로 파괴 |
| `RegExp` | 빈 `{}` 객체로 손실 |
| 순환 참조 | 런타임 에러 throw |

`VO.toSkeleton()`은 `fromVO()` 팩토리의 입력 객체다. 여기서 타입이 파괴되면 Proxy가 잘못된 초기값을 추적하게 된다.

**이미 고쳐진 곳**: `DomainState.save()`의 롤백 스냅샷은 `structuredClone()`을 직접 사용하고 있다 (line 592). 이번 작업은 그 외 `toSkeleton()`의 잔존 병목을 제거하는 것이다.

### 문제 2 — `DomainVO.checkSchema()`의 Extra Keys 경고

```javascript
// 현재 checkSchema() 309번째 줄
extraKeys.forEach((k) => console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k)));
```

프로덕션 환경에서 백엔드가 `version`, `createdBy`, `lastModified` 같은 서버 메타 필드를 응답에 포함하면 **페이지 로드마다 `console.warn`이 반복 발화**된다. 진짜 경고를 묻어버리는 Signal-to-Noise 비율 저하의 주범이다.

반면 `missingKeys`는 기능 이상을 의미하므로 환경 무관하게 항상 출력해야 한다. 두 메시지의 심각도가 다른데 같은 레벨로 처리하고 있다.

---

## (b) 목표 아키텍처 설계

### `safeClone()` 설계 — Progressive Enhancement 패턴

```text
safeClone(value) 실행 흐름

  1순위: structuredClone 존재 여부 런타임 탐지
    typeof structuredClone !== 'undefined'
      → structuredClone(value)  ← V8 C++ 네이티브 경로
        Date·Map·Set·RegExp·Circular Reference 모두 올바르게 처리

  2순위: 폴백 (레거시 환경)
    → _cloneDeep(value)  ← 커스텀 재귀 구현
        null 함정, 원시값 탈출, Date·RegExp 분기, 배열 재귀, 객체 재귀
```

`structuredClone()`은 Chrome 98+, Firefox 94+, Safari 15.4+, Node.js 17+에서 지원된다. SI 환경의 구형 Android WebView나 일부 내부망 키오스크를 위해 폴백을 제공한다.

`_cloneDeep()`은 이 라이브러리의 VO 레이어 사용 범위에 맞게 구현한다. `DomainVO.static fields`의 `default` 값은 원시값, 단순 객체, 배열이 대부분이다. `Map`/`Set`은 VO 기본값으로 사용되는 사례가 현 코드베이스에 없으므로 폴백에서는 `Date`와 `RegExp`만 특수 처리하고 나머지는 얕은 복사로 처리한다. 단, `structuredClone` 경로는 이들을 완벽히 처리한다.

### `logger.js` — 라이브러리 전역 로그 제어 모듈

`DomainVO.checkSchema()`의 로그 레벨 문제와 `silent` 플래그를 처리하기 위해 라이브러리 전역 로그 상태를 관리하는 모듈을 `src/common/`에 신설한다.

`DomainState.configure()`가 이미 라이브러리 전역 설정의 진입점으로 자리잡았다. 여기에 `silent` 옵션을 추가하여 소비자가 모든 내부 로그를 억제할 수 있도록 한다.

```text
로그 레벨 분류 체계

  missingKeys 감지  → console.error (환경 무관)
                       기능에 영향을 주는 실제 오류. 프로덕션에서도 반드시 출력.

  extraKeys 감지    → 개발 환경에서만 console.warn
                       process.env.NODE_ENV !== 'production' 조건 하에서만 발화.
                       소비자 번들러 Tree-shaking으로 프로덕션 빌드에서 코드 블록 제거.

  silent: true      → console.error 포함 모든 내부 로그 억제
                       통합 테스트, 특정 운영 환경에서 콘솔 오염 차단 목적.
```

`silent` 모드에서도 `console.error`를 막는 이유 — 소비자가 명시적으로 `silent: true`를 설정했다면 자신이 책임을 인지한 것이다. 통합 테스트 시 `console.error`까지 억제해야 하는 케이스가 실제로 존재한다.

---

## (c) 변경 파일별 세부 분석

### STEP A — `src/common/clone.js` 신규 생성

```javascript
/* global structuredClone */

/**
 * 깊은 복사(Deep Clone) 유틸리티
 *
 * `structuredClone()`을 1순위로 사용하고, 미지원 환경에서는
 * 커스텀 재귀 함수(`_cloneDeep`)로 폴백하는 Progressive Enhancement 패턴을 따른다.
 *
 * ## 사용 범위
 * `DomainVO.toSkeleton()`의 `static fields` 기본값 deep copy에 사용된다.
 * 기존 `JSON.parse(JSON.stringify())` 방식의 타입 파괴 문제를 해결한다.
 *
 * ## `_cloneDeep` 폴백 지원 타입
 * VO 레이어의 실제 사용 범위에 맞게 구현하였다.
 * `Map`·`Set`은 현 코드베이스의 VO 기본값에서 사용되지 않으므로 폴백에서 제외한다.
 * `structuredClone` 경로는 이들을 완벽히 처리한다.
 *
 * @module common/clone
 */

/**
 * 객체를 깊게 복사하는 내부 재귀 함수. `structuredClone` 미지원 환경에서 사용된다.
 *
 * ## 처리 규칙
 * - `null` / 원시값 → 즉시 반환 (null 함정 방어)
 * - `Date` → `new Date(obj.getTime())` 복사
 * - `RegExp` → `new RegExp(obj.source, obj.flags)` 복사
 * - 배열 → 각 요소를 재귀 복사한 새 배열
 * - 일반 객체 → `Object.keys()` 순회 재귀
 *
 * @param {*} obj - 복사할 값
 * @returns {*} 깊은 복사된 값
 */
function _cloneDeep(obj) {
    // null 함정 방어: typeof null === 'object' 이므로 반드시 먼저 검사한다
    if (obj === null) return null;

    // 원시값 탈출: string, number, boolean, undefined, symbol, bigint
    if (typeof obj !== 'object') return obj;

    // Date: new Date(obj)로 복사하면 밀리초 정밀도가 보장된다
    if (obj instanceof Date) return new Date(obj.getTime());

    // RegExp: source와 flags를 그대로 보존한다
    if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);

    // 배열: 각 요소를 재귀 복사
    if (Array.isArray(obj)) return obj.map(_cloneDeep);

    // 일반 plain 객체: own enumerable key 순회 재귀
    const cloned = /** @type {Record<string, unknown>} */ ({});
    for (const key of Object.keys(obj)) {
        cloned[key] = _cloneDeep(/** @type {any} */ (obj)[key]);
    }
    return cloned;
}

/**
 * 값을 깊게 복사한다.
 *
 * `structuredClone()`이 지원되는 환경에서는 V8 C++ 네이티브 직렬화 파이프라인을 사용한다.
 * 미지원 환경(구형 Android WebView, 일부 공공기관 내부망 키오스크 등)에서는
 * `_cloneDeep()`으로 폴백하여 점진적 향상(Progressive Enhancement)을 제공한다.
 *
 * ## 복사 지원 타입 비교
 *
 * | 타입                | `structuredClone` 경로 | `_cloneDeep` 폴백 |
 * |---------------------|------------------------|-------------------|
 * | 원시값              | ✅                     | ✅                |
 * | 일반 객체           | ✅                     | ✅                |
 * | 배열                | ✅                     | ✅                |
 * | `Date`              | ✅ (완전 보존)          | ✅                |
 * | `RegExp`            | ✅ (완전 보존)          | ✅                |
 * | `Map`, `Set`        | ✅ (완전 보존)          | ❌ (빈 객체로 폴백) |
 * | 순환 참조           | ✅                     | ❌ (스택 오버플로우) |
 *
 * @param {*} value - 복사할 값
 * @returns {*} 깊은 복사된 값
 *
 * @example <caption>기본 사용 — DomainVO.toSkeleton() 내부</caption>
 * const def = { city: 'Seoul', zip: '04524' };
 * const copy = safeClone(def);
 * copy.city = 'Busan';
 * console.log(def.city); // 'Seoul' — 원본 불변
 *
 * @example <caption>Date 보존 확인</caption>
 * const obj = { createdAt: new Date('2026-01-01') };
 * const copy = safeClone(obj);
 * console.log(copy.createdAt instanceof Date); // true — JSON 방식은 string으로 변환
 */
export function safeClone(value) {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(value);
    }
    return _cloneDeep(value);
}
```

---

### STEP B — `src/common/logger.js` 신규 생성

```javascript
/* global process */

/**
 * 라이브러리 전역 로그 제어 모듈
 *
 * `DomainState.configure({ silent: true })`를 통해 모든 내부 로그를 억제할 수 있다.
 * 모듈 레벨 클로저 변수로 상태를 관리하여 외부에서 직접 접근을 차단한다.
 *
 * ## 로그 레벨 분류 체계
 *
 * | 구분               | 기본 동작                          | silent: true |
 * |--------------------|------------------------------------|--------------|
 * | Extra Keys 감지    | 개발 환경에서만 console.warn        | 억제         |
 * | Missing Keys 감지  | 환경 무관 console.error             | 억제         |
 * | CSRF 토큰 미발견   | console.warn                        | 억제         |
 *
 * @module common/logger
 */

/**
 * 모든 내부 로그를 억제하는 silent 플래그.
 * `DomainState.configure({ silent: true })`를 통해서만 변경된다.
 *
 * @type {boolean}
 */
let _silent = false;

/**
 * silent 플래그를 설정한다.
 * `DomainState.configure()` 내부에서만 호출된다.
 *
 * @param {boolean} value - 억제 여부
 * @returns {void}
 */
export function setSilent(value) {
    _silent = !!value;
}

/**
 * 현재 silent 플래그를 반환한다.
 *
 * @returns {boolean}
 */
export function isSilent() {
    return _silent;
}

/**
 * 개발 환경에서만 `console.warn`을 발화한다. `silent: true`이면 억제된다.
 *
 * Extra Keys 감지처럼 기능에 영향이 없는 정보성 경고에 사용한다.
 * `process.env.NODE_ENV`를 소비자 번들러가 교체하면 프로덕션 빌드에서
 * 이 함수를 호출하는 코드 블록 자체가 Tree-shaking으로 제거된다.
 *
 * @param {string} message - 출력할 경고 메시지
 * @returns {void}
 */
export function devWarn(message) {
    if (_silent) return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
    console.warn(message);
}

/**
 * 환경 무관하게 `console.error`를 발화한다. `silent: true`이면 억제된다.
 *
 * Missing Keys 감지처럼 기능 이상을 의미하는 오류에 사용한다.
 *
 * @param {string} message - 출력할 에러 메시지
 * @returns {void}
 */
export function logError(message) {
    if (_silent) return;
    console.error(message);
}
```

---

### STEP C — `DomainVO.js` 수정 (3개 지점)

#### 수정 1. import 추가

```javascript
import { ERR }       from '../constants/error.messages.js';
import { safeClone } from '../common/clone.js';          // ← 추가
import { devWarn, logError } from '../common/logger.js'; // ← 추가
```

#### 수정 2. `toSkeleton()` 내부 복사 교체

JSDoc의 `@property {*} [default]` 설명도 함께 업데이트한다.

```javascript
// FieldSchema @property 설명 변경 전
 * `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy하여

// 변경 후
 * `object` 또는 `array`이면 `safeClone(val)`로 deep copy하여
 * `structuredClone()`을 우선 사용하고, 미지원 환경에서는 재귀 폴백을 사용한다.
```

```javascript
// toSkeleton() JSDoc 처리 규칙 변경 전
 * 4. `default`가 `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy.

// 변경 후
 * 4. `default`가 `object` 또는 `array`이면 `safeClone(val)`로 deep copy.
 *    `structuredClone()`을 우선 사용하고 미지원 환경에서는 재귀 폴백으로 처리한다.
 *    `Date`·`RegExp` 등 특수 타입의 타입 손실을 방지한다.
```

```javascript
// 코드 변경 전
    val !== null && typeof val === 'object'
        ? JSON.parse(JSON.stringify(val)) // 객체/배열: deep copy
        : val, // 원시값: 그대로

// 변경 후
    val !== null && typeof val === 'object'
        ? safeClone(val)  // 객체/배열: deep copy (Date·RegExp 타입 보존)
        : val,            // 원시값: 그대로
```

#### 수정 3. `checkSchema()` 로그 레벨 분류 적용

```javascript
// 변경 전
    missingKeys.forEach((k) => console.error(ERR.VO_SCHEMA_MISSING_KEY(k)));
    extraKeys.forEach((k) => console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k)));

// 변경 후
    // missingKeys: 기능 이상을 의미하므로 환경 무관하게 항상 출력 (silent 제외)
    missingKeys.forEach((k) => logError(ERR.VO_SCHEMA_MISSING_KEY(k)));

    // extraKeys: 기능에 영향 없는 정보성 경고. 개발 환경에서만 출력.
    // process.env.NODE_ENV 치환 후 Tree-shaking으로 프로덕션 빌드에서 제거된다.
    extraKeys.forEach((k) => devWarn(ERR.VO_SCHEMA_EXTRA_KEY(k)));
```

JSDoc `## 콘솔 출력` 항목도 업데이트한다.

```javascript
 * ## 콘솔 출력
 * - `missingKeys`: `logError(ERR.VO_SCHEMA_MISSING_KEY(k))`  — 환경 무관 에러 (silent 제외)
 * - `extraKeys`:   `devWarn(ERR.VO_SCHEMA_EXTRA_KEY(k))`    — 개발 환경 전용 경고
 *
 * `DomainState.configure({ silent: true })` 설정 시 모든 출력이 억제된다.
```

---

### STEP D — `DomainState.configure()` 확장

`configure()` 메서드의 `{ pipelineFactory }` 구조분해에 `silent` 옵션을 추가한다.

```javascript
import { setSilent } from '../common/logger.js';  // import 추가
```

```javascript
    static configure({ pipelineFactory, silent } = {}) {
        // pipelineFactory 주입 (기존)
        if (pipelineFactory !== undefined) {
            if (typeof pipelineFactory !== 'function') {
                throw new TypeError(
                    '[DSM] DomainState.configure(): pipelineFactory는 함수여야 합니다.'
                );
            }
            _pipelineFactory = pipelineFactory;
        }

        // silent 플래그 설정 (신규)
        if (silent !== undefined) {
            setSilent(silent);
        }

        return DomainState;
    }
```

JSDoc `@param` 블록에 `silent` 추가:

```javascript
     * @param {object}   config
     * @param {Function} [config.pipelineFactory] - `(resourceMap, options) => DomainPipeline` 형태의 팩토리 함수
     * @param {boolean}  [config.silent=false]    - `true`이면 모든 내부 `console` 출력을 억제한다.
     *                                              통합 테스트 또는 특정 운영 환경에서의 콘솔 오염 차단 목적.
```

`@example`에도 추가:

```javascript
     * @example <caption>통합 테스트 환경 — 콘솔 억제</caption>
     * DomainState.configure({ silent: true });
```

`configure()`의 인자를 구조분해할 때 기존엔 `pipelineFactory`만 받았으니 `{ pipelineFactory }` → `{ pipelineFactory, silent } = {}`로 기본값 빈 객체도 추가해야 한다. `configure()`를 인자 없이 호출하는 경우를 방어한다.

---

## (d) 예상 시나리오

### 시나리오 1. `toSkeleton()` Date 기본값 보존

```text
class OrderVO extends DomainVO {
    static fields = {
        orderId:   { default: '' },
        createdAt: { default: new Date('2026-01-01') },   // Date 기본값
    };
}

new OrderVO().toSkeleton() 호출

  기존 (JSON.parse 방식):
    createdAt → "2026-01-01T00:00:00.000Z" (string! 타입 손실)

  변경 후 (safeClone):
    createdAt → Date 객체 그대로 보존 (deep copy, 독립 참조)
```

### 시나리오 2. `checkSchema()` Extra Keys 로그 환경 분기

```text
개발 환경 (NODE_ENV !== 'production'):
  응답에 VO에 없는 'version' 필드 포함
    → devWarn('[DSM] DomainVO 정합성 경고: ... "version"')
    → 콘솔에 출력됨

프로덕션 환경 (NODE_ENV === 'production'):
  번들러가 process.env.NODE_ENV를 'production'으로 치환
    → devWarn 내부의 조건 분기가 early return
    → Tree-shaking이 해당 코드 블록 제거
    → 콘솔에 아무것도 출력 안 됨
```

### 시나리오 3. `silent: true` — 통합 테스트 환경

```text
// 테스트 설정 파일 또는 beforeAll
DomainState.configure({ silent: true });

// 이후 DomainVO.checkSchema()가 Missing Keys를 감지해도 콘솔에 아무 출력 없음
// Vitest 결과에 console.error 노이즈가 섞이지 않음
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일 | 변경 종류 | 변경 내용 |
|---|---|---|
| `src/common/clone.js` | **신규 생성** | `_cloneDeep()` (폴백 재귀), `safeClone()` (탐지 + 폴백 연결) |
| `src/common/logger.js` | **신규 생성** | `_silent` 클로저 변수, `setSilent()`, `isSilent()`, `devWarn()`, `logError()` |
| `src/domain/DomainVO.js` | **수정** | `safeClone` import, `devWarn`/`logError` import, `toSkeleton()` 복사 교체, `checkSchema()` 로그 레벨 분류, JSDoc 업데이트 |
| `src/domain/DomainState.js` | **수정** | `setSilent` import, `configure()` `silent` 옵션 추가, JSDoc 업데이트 |

### Feature 브랜치명

```
feat/safe-clone-log-level
```

`safeClone()` 공개 API는 없으므로(내부 유틸) `feat:`이지만 소비자에게 영향을 주는 `DomainState.configure({ silent })` API가 신규 추가된다. semantic-release 기준 minor 버전 +1.

### Commit Sequence

```markdown
# STEP A — clone 유틸리티 모듈 신규 생성
feat(common): add safeClone utility with structuredClone and _cloneDeep fallback

  - src/common/clone.js 신규 생성
  - _cloneDeep(): null 방어, 원시값 탈출, Date·RegExp 분기, 배열·객체 재귀
  - safeClone(): typeof structuredClone 탐지 후 네이티브 or 폴백 분기
  - Map·Set 폴백 미지원 사유 JSDoc에 명시


# STEP B — logger 유틸리티 모듈 신규 생성
feat(common): add logger utility with silent flag and log level control

  - src/common/logger.js 신규 생성
  - _silent 모듈 클로저 변수 (외부 직접 접근 차단)
  - setSilent(value): DomainState.configure()에서만 호출
  - devWarn(message): 개발 환경 전용 console.warn (NODE_ENV + silent 이중 게이트)
  - logError(message): 환경 무관 console.error (silent 게이트만)


# STEP C — DomainVO deep copy 교체 + 로그 레벨 분류
feat(domain): replace JSON.parse deep copy with safeClone in DomainVO.toSkeleton

  - toSkeleton(): JSON.parse(JSON.stringify()) → safeClone() 교체
  - checkSchema(): console.error → logError(), console.warn → devWarn() 교체
  - import safeClone, devWarn, logError 추가
  - FieldSchema @property JSDoc: deep copy 방식 설명 갱신
  - toSkeleton() JSDoc: 처리 규칙 4번 갱신
  - checkSchema() JSDoc: 콘솔 출력 항목 갱신


# STEP D — DomainState.configure() silent 옵션 추가
feat(domain): extend DomainState.configure() with silent option

  - import setSilent from common/logger.js 추가
  - configure({ pipelineFactory, silent }): silent 옵션 처리 추가
  - configure() 인자에 기본값 빈 객체 추가 (인자 없는 호출 방어)
  - JSDoc @param에 silent 항목 추가
  - @example: 통합 테스트 환경 silent 사용 예시 추가


# STEP E — Vitest 단위 테스트
test(common): add safeClone and DomainVO log-level test cases

  - safeClone — structuredClone 경로: Date·RegExp·배열·중첩 객체 타입 보존 확인
  - safeClone — _cloneDeep 폴백: global.structuredClone = undefined 후 동일 케이스 검증
  - safeClone — null·원시값 직접 반환 확인
  - DomainVO.toSkeleton() — Date 기본값이 Date 타입으로 복사되는지 확인
  - DomainVO.toSkeleton() — 인스턴스 간 참조 독립성 확인 (deep copy 보장)
  - checkSchema() — extraKeys: NODE_ENV=production 시 console.warn 미발화 확인
  - checkSchema() — missingKeys: NODE_ENV=production 시에도 logError 발화 확인
  - configure({ silent: true }) — checkSchema() missing/extra 모두 억제 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목 | 기준 |
|---|---|
| `npm run lint` | error 0건 |
| `npm test` | 전체 테스트 통과 (기존 회귀 없음) |
| `safeClone(new Date(...))` | 반환값이 `Date` 인스턴스 (`instanceof Date === true`) |
| `safeClone` 인스턴스 독립성 | 복사본 변경이 원본에 영향 없음 |
| `_cloneDeep` 폴백 | `global.structuredClone = undefined` 환경에서 동일 결과 |
| `devWarn` 프로덕션 게이트 | `NODE_ENV=production` 시 `console.warn` 미발화 |
| `logError` 환경 무관 | `NODE_ENV=production` 시에도 `console.error` 발화 |
| `configure({ silent: true })` | `checkSchema()` missing·extra 모두 억제 |
| `toSkeleton()` Date 기본값 | `Date` 타입 보존, 인스턴스 간 참조 독립 |
