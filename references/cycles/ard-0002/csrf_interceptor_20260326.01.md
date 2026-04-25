# CSRF Interceptor Pipeline (2026-03-26)

> **Milestone:** `v1.1.0`
> **Branch:** `feature/csrf-interceptor`
> **References:** `ard-0002-alignment.md § 3.1`

---

## (a) 코드 구조 현황 진단

### `_fetch()` 현재 상태

```text
ApiHandler._fetch(url, options)
 │
 ├─ headers 병합: { ...this._headers, ...options.headers }
 │   └─ this._headers = { 'Content-Type': 'application/json' }  ← 고정값만 존재
 │
 ├─ fetch(url, { ...options, headers })
 ├─ res.ok === false → HttpError throw
 └─ return text || null
```

CSRF 토큰 관련 로직이 **전혀 없다.** 현재 `api-handler.js`는 다음 네 가지가 누락된 채로 동작하고 있다.

| 누락 항목               | 결과                                                        |
| ----------------------- | ----------------------------------------------------------- |
| 토큰 파싱 메커니즘      | Spring Security 연동 시 `403 Forbidden` 자동 발생           |
| 메서드별 헤더 삽입 분기 | 상태 변이 요청(`POST`/`PUT`/`PATCH`/`DELETE`)에 토큰 미전송 |
| 토큰 부재 시 에러 처리  | 잘못된 요청이 서버까지 전달된 후 서버 에러로 돌아옴         |
| Node.js 환경 가드       | Vitest에서 `document` 참조 에러 발생                        |

### 핵심 설계 결정: `init()` 분리 이유

토큰 파싱 로직을 `constructor`에 넣지 않고 별도 `init()` 메서드로 분리하는 이유가 있다.

`ApiHandler` 인스턴스는 서버 연결 설정(host, protocol 등)을 담당한다. CSRF 토큰은 **페이지가 렌더링된 이후** DOM에서 읽어야 하는 값이다. 즉, 인스턴스 생성 시점과 토큰 파싱 시점이 일치할 수 없다. JavaScript 모듈이 로드되는 시점에 `<meta>` 태그가 아직 DOM에 없을 수 있다. `init()`을 별도로 두면 소비자가 DOM이 준비된 시점을 직접 선택할 수 있다.

```javascript
// constructor에 넣으면 안 되는 이유
import { ApiHandler } from '...';
// 이 시점에 DOM이 준비되어 있다는 보장이 없다
const api = new ApiHandler({ host: 'localhost:8080' });  // ← 여기서 meta 태그 읽기 실패 가능

// init()으로 분리하는 이유
document.addEventListener('DOMContentLoaded', () => {
    // DOM 준비 완료 시점에 명시적으로 토큰 초기화
    api.init({ csrfSelector: 'meta[name="_csrf"]' });
});
```

---

## (b) 목표 아키텍처 설계

### `#csrfToken` 3-상태 설계

토큰의 상태를 세 단계로 구분한다. 이것이 "CSRF 미사용"과 "CSRF 사용 시도했으나 토큰 없음"을 구별하는 핵심이다.

```text
this.#csrfToken 상태표

  undefined  →  init() 미호출. CSRF 기능 비활성.
                _fetch() 내부에서 토큰 헤더 삽입 로직 자체를 건너뜀.
                CSRF 없는 환경(JWT 인증, API-only 앱)에서 정상 동작.

  null       →  init() 호출됨. 그러나 토큰을 DOM/Cookie에서 찾지 못함.
                상태 변이 요청(POST/PUT/PATCH/DELETE) 발생 시 즉시 throw.
                Silent Failure 방지. 개발 중 실수를 즉시 노출.

  string     →  init() 호출됨. 토큰 파싱 성공.
                상태 변이 요청 헤더에 'X-CSRF-Token': token 자동 주입.
```

### `init()` 토큰 탐색 우선순위 (단계적 탐색)

```text
init({ csrfSelector?, csrfCookieName?, csrfToken? }) 호출 시

  1순위: csrfToken 직접 주입
     └─ typeof csrfToken === 'string' → #csrfToken = csrfToken
        (Vitest 환경, SSR 환경에서 DOM 없이 토큰을 직접 주입할 때 사용)

  2순위: DOM meta 태그 파싱 (브라우저 환경 전용)
     └─ typeof document === 'undefined' 이면 건너뜀 (Node.js 가드)
     └─ csrfSelector 지정 시 → document.querySelector(csrfSelector)?.content
     └─ csrfSelector 미지정 → document.querySelector('meta[name="_csrf"]')?.content
        (Spring Security 기본 meta 태그명)

  3순위: Cookie 파싱 (Double-Submit Cookie 패턴)
     └─ csrfCookieName 지정 시만 시도
     └─ document.cookie에서 해당 키 값 추출

  탐색 결과 없음 → #csrfToken = null
```

`Spring Security` 기본 설정은 `<meta name="_csrf" content="token-value">` 형태로 토큰을 노출하므로 `csrfSelector` 미지정 시 이것을 기본값으로 탐색한다.

### `_fetch()` 분기 삽입 위치

```text
_fetch(url, options) 호출 흐름 (변경 후)

  ① 헤더 초기화
     headers = { ...this._headers, ...(options.headers ?? {}) }

  ② CSRF 토큰 삽입 분기  ← NEW
     method = (options.method ?? 'GET').toUpperCase()
     MUTATING_METHODS = { 'POST', 'PUT', 'PATCH', 'DELETE' }

     if (MUTATING_METHODS.has(method)):
         if (this.#csrfToken === undefined): 건너뜀 (CSRF 미사용 모드)
         if (this.#csrfToken === null): throw ERR.CSRF_TOKEN_MISSING(method)
         if (typeof this.#csrfToken === 'string'): headers['X-CSRF-Token'] = this.#csrfToken

  ③ fetch(url, { ...options, headers })
  ④ res.ok === false → HttpError throw
  ⑤ return text || null
```

`GET`, `HEAD`, `OPTIONS`는 OWASP RFC 9110 기준 Safe Method로 분류되어 토큰 삽입 대상이 아니다.

---

## (c) 변경 파일별 세부 분석

### `src/constants/error.messages.js` — ERR 상수 추가

`// ── DomainPipeline ─────` 섹션 위에 CSRF 전용 섹션을 추가한다.

```javascript
// ── ApiHandler CSRF ────────────────────────────────────────────────────────
/**
 * @param {string} method - 요청을 시도한 HTTP 메서드
 */
CSRF_TOKEN_MISSING: (method) =>
    `${PREFIX} ApiHandler._fetch(): ${method} 요청에 CSRF 토큰이 필요하지만 ` +
    '토큰을 찾을 수 없습니다. api.init({ csrfSelector })를 호출하여 토큰을 초기화하세요.',

CSRF_INIT_NO_TOKEN: (selector) =>
    `${PREFIX} ApiHandler.init(): csrfSelector="${selector}"로 meta 태그를 찾았으나 ` +
    'content 속성이 비어있습니다. 서버가 토큰을 HTML에 올바르게 삽입했는지 확인하세요.',
```

### `src/network/api-handler.js` — 3개 지점 수정

#### 수정 1. Private class field 추가 (constructor 위)

```javascript
class ApiHandler {
    /**
     * CSRF 토큰 저장소. init() 호출 여부와 파싱 결과를 3-상태로 구분한다.
     *
     * - `undefined` : init() 미호출. CSRF 헤더 삽입 비활성.
     * - `null`      : init() 호출됨. 토큰 파싱 실패. 뮤테이션 요청 시 throw.
     * - `string`    : 정상 파싱된 토큰 값. 뮤테이션 요청 헤더에 자동 주입.
     *
     * Private class field로 선언하여 외부 직접 접근 및 덮어쓰기를 차단한다.
     *
     * @type {string | null | undefined}
     */
    #csrfToken = undefined;
```

#### 수정 2. `init()` 메서드 추가 (공개 API 섹션)

```javascript
    /**
     * CSRF 토큰을 초기화한다. DOM이 준비된 시점에 1회 호출한다.
     *
     * ## 탐색 우선순위
     * 1. `csrfToken` 직접 주입 (Vitest / SSR 환경용)
     * 2. `csrfSelector` CSS 선택자로 meta 태그 파싱
     * 3. `csrfSelector` 미지정 시 `meta[name="_csrf"]` 기본값으로 탐색
     * 4. `csrfCookieName` 지정 시 document.cookie 파싱
     * 5. 모두 실패 → `#csrfToken = null` (뮤테이션 요청 시 throw)
     *
     * ## 환경 호환성
     * - 브라우저: 모든 탐색 전략 사용 가능
     * - Node.js / Vitest: `typeof document === 'undefined'`이므로
     *   DOM 파싱을 건너뛰고 `csrfToken` 직접 주입 방식만 동작함
     *
     * @param {object}  config
     * @param {string}  [config.csrfSelector]   - CSRF 토큰을 담은 meta 태그의 CSS 선택자.
     *                                            기본값: `'meta[name="_csrf"]'` (Spring Security 기본)
     * @param {string}  [config.csrfCookieName] - Double-Submit Cookie 방식의 쿠키명.
     *                                            csrfSelector 탐색 실패 시 fallback으로 시도.
     * @param {string}  [config.csrfToken]      - 토큰 직접 주입. Vitest / SSR 환경에서 사용.
     *                                            지정 시 다른 탐색 전략보다 우선 적용됨.
     * @returns {ApiHandler} 체이닝용 this 반환
     *
     * @example <caption>Spring Security (meta 태그 기본값)</caption>
     * // HTML: <meta name="_csrf" content="abc123">
     * api.init({});  // csrfSelector 미지정 → 'meta[name="_csrf"]' 자동 탐색
     *
     * @example <caption>커스텀 선택자</caption>
     * // HTML: <meta name="csrf-token" content="abc123">
     * api.init({ csrfSelector: 'meta[name="csrf-token"]' });
     *
     * @example <caption>Double-Submit Cookie (Laravel / Django)</caption>
     * api.init({ csrfCookieName: 'XSRF-TOKEN' });
     *
     * @example <caption>Vitest 테스트 환경 — 직접 주입</caption>
     * api.init({ csrfToken: 'test-csrf-token' });
     */
    init({ csrfSelector, csrfCookieName, csrfToken } = {}) {
        // ── 1순위: 직접 주입 (Node.js / SSR / Vitest)
        if (typeof csrfToken === 'string') {
            this.#csrfToken = csrfToken;
            return this;
        }

        // ── 2순위: DOM meta 태그 파싱 (브라우저 전용)
        if (typeof document !== 'undefined') {
            const selector = csrfSelector ?? 'meta[name="_csrf"]';
            const metaEl = document.querySelector(selector);
            if (metaEl?.content) {
                this.#csrfToken = metaEl.content;
                return this;
            }

            // ── 3순위: Cookie 파싱 (Double-Submit Cookie 패턴)
            if (csrfCookieName) {
                const match = document.cookie
                    .split(';')
                    .map(c => c.trim())
                    .find(c => c.startsWith(`${csrfCookieName}=`));

                if (match) {
                    this.#csrfToken = decodeURIComponent(match.split('=')[1]);
                    return this;
                }
            }
        }

        // ── 탐색 실패: null로 마킹 → 뮤테이션 요청 시 throw
        this.#csrfToken = null;
        return this;
    }
```

#### 수정 3. `_fetch()` 내부 분기 삽입

```javascript
    // 파일 최상위 (class 선언 위 모듈 레벨)에 상수 선언
    // ← 이 위치. class ApiHandler { 선언 바로 위.
    /** RFC 9110 기준 상태 변이 메서드. CSRF 토큰이 반드시 필요하다. */
    const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);


    // _fetch() 내부 — 헤더 병합 이후, fetch() 호출 이전에 삽입
    async _fetch(url, options = {}) {
        const method = (options.method ?? 'GET').toUpperCase();

        const headers = {
            ...this._headers,
            ...(options.headers ?? {}),
        };

        // ── CSRF 토큰 삽입 분기 ────────────────────────────────────────────
        // #csrfToken === undefined: init() 미호출 → CSRF 기능 비활성, 건너뜀
        // #csrfToken === null     : init() 호출됐으나 토큰 없음 → 뮤테이션 요청 차단
        // #csrfToken === string   : 정상 토큰 → X-CSRF-Token 헤더 주입
        if (MUTATING_METHODS.has(method)) {
            if (this.#csrfToken === null) {
                throw new Error(ERR.CSRF_TOKEN_MISSING(method));
            }
            if (typeof this.#csrfToken === 'string') {
                headers['X-CSRF-Token'] = this.#csrfToken;
            }
        }
        // ──────────────────────────────────────────────────────────────────

        const res = await fetch(url, { ...options, headers });
        const text = await res.text();

        if (!res.ok) {
            throw /** @type {HttpError} */ ({
                status: res.status,
                statusText: res.statusText,
                body: text,
            });
        }

        return text || null;
    }
```

`MUTATING_METHODS`를 `Set`으로 선언하는 이유는 `Array.includes()`가 O(n)인 반면 `Set.has()`는 O(1)이기 때문이다. 항목이 4개뿐이라 체감 차이는 없지만, 상수를 `Set`으로 선언하는 것이 의미론적으로도 더 정확하다. "이 메서드들의 집합"이지 "이 메서드들의 순서 있는 목록"이 아니니까.

`MUTATING_METHODS`는 클래스 바깥 모듈 레벨에 선언한다. 인스턴스마다 생성되는 값이 아니고, `init()` 호출 여부와도 무관한 순수 상수이기 때문이다.

---

## (d) 예상 시나리오

### 시나리오 1. Spring Security 환경 — 정상 흐름

```text
HTML (서버가 렌더링)
  <meta name="_csrf" content="a1b2c3d4">

소비자 코드
  const api = new ApiHandler({ host: 'localhost:8080' });
  api.init({});  // csrfSelector 미지정 → 'meta[name="_csrf"]' 자동 탐색
  └─ document.querySelector('meta[name="_csrf"]').content → 'a1b2c3d4'
  └─ this.#csrfToken = 'a1b2c3d4'

이후 state.save('/api/users/1') 호출 (PATCH)
  └─ _fetch(url, { method: 'PATCH', body: ... }) 진입
  └─ MUTATING_METHODS.has('PATCH') → true
  └─ #csrfToken === 'a1b2c3d4' (string)
  └─ headers['X-CSRF-Token'] = 'a1b2c3d4' 주입
  └─ Spring Security가 헤더 검증 → 200 OK
```

### 시나리오 2. init() 호출했으나 meta 태그 없음 — 방어 흐름

```text
소비자 코드
  api.init({});
  └─ document.querySelector('meta[name="_csrf"]') → null
  └─ csrfCookieName 미지정 → Cookie 탐색 건너뜀
  └─ this.#csrfToken = null  ← 탐색 실패 마킹

이후 state.save('/api/users/1') 호출
  └─ _fetch(url, { method: 'PATCH', ... }) 진입
  └─ MUTATING_METHODS.has('PATCH') → true
  └─ #csrfToken === null
  └─ throw ERR.CSRF_TOKEN_MISSING('PATCH')
  └─ "[DSM] ApiHandler._fetch(): PATCH 요청에 CSRF 토큰이 필요하지만..."
     서버까지 요청이 가지 않음. 개발 중 즉시 발각.
```

### 시나리오 3. init() 미호출 — CSRF 기능 비활성

```text
소비자 코드
  const api = new ApiHandler({ host: 'localhost:8080' });
  // init() 호출 없음

state.save() 호출
  └─ _fetch(url, { method: 'POST', ... }) 진입
  └─ MUTATING_METHODS.has('POST') → true
  └─ #csrfToken === undefined  ← init() 미호출 상태
  └─ 조건 분기 모두 건너뜀 (undefined는 null도 string도 아님)
  └─ X-CSRF-Token 헤더 없이 그대로 전송
     JWT 인증, API-only 앱 등 CSRF 불필요한 환경에서 정상 동작.
```

### 시나리오 4. Vitest 환경 — 직접 주입

```text
테스트 코드
  const api = new ApiHandler({ host: 'localhost:8080' });
  api.init({ csrfToken: 'test-token' });
  // typeof document === 'undefined' 이더라도
  // csrfToken 직접 주입이 1순위이므로 DOM 접근 없이 정상 초기화
```

---

## (e) 계획 수립

### 수정 파일 목록 및 변경 범위

| 파일                                | 변경 종류  | 변경 내용                                                                                                                           |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/error.messages.js`   |  **수정**  | `ERR.CSRF_TOKEN_MISSING`, `ERR.CSRF_INIT_NO_TOKEN` 상수 추가                                                                        |
| `src/network/api-handler.js`        |  **수정**  | `MUTATING_METHODS` 모듈 상수 추가, `#csrfToken` private field 추가, `init()` 메서드 추가, `_fetch()` 분기 삽입, JSDoc 전면 업데이트 |
| `tests/network/api-handler.test.js` |  **수정**  | CSRF 관련 테스트 케이스 추가                                                                                                        |
| `README.md` / `docs/`               |  **수정**  | 거짓 보안 명세 제거, 실제 구현 명세 및 서버별 연동 가이드 추가                                                                      |

### Feature 브랜치명

```text
feature/csrf-interceptor
```

신규 기능 추가이므로 `refactor/`가 아닌 `feature/`다. 기존 `_fetch()` 동작 방식이 유지되면서 새 로직이 추가되는 형태다.

### Commit Sequence

```markdown
# STEP A — 에러 상수 추가
feat(constants): add CSRF_TOKEN_MISSING and CSRF_INIT_NO_TOKEN error messages

  - ERR.CSRF_TOKEN_MISSING(method): 뮤테이션 요청 시 토큰 없음 에러
  - ERR.CSRF_INIT_NO_TOKEN(selector): meta 태그 content 비어있을 때 경고


# STEP B — private field + init() 메서드
feat(network): add #csrfToken private field and init() to ApiHandler

  - #csrfToken 3-상태 private class field 추가 (undefined/null/string)
  - init({ csrfSelector, csrfCookieName, csrfToken }) 공개 메서드 추가
  - 탐색 우선순위: csrfToken 직접 주입 → meta 태그 → cookie → null
  - typeof document 환경 가드 추가 (Node.js / Vitest 호환)
  - Spring Security 기본값 'meta[name="_csrf"]' 자동 탐색
  - 체이닝 지원: init() returns this


# STEP C — _fetch() 분기 삽입
feat(network): inject X-CSRF-Token header for mutating methods in _fetch()

  - MUTATING_METHODS 모듈 레벨 Set 상수 추가 (POST/PUT/PATCH/DELETE)
  - _fetch() 내부에 CSRF 토큰 삽입 분기 추가
  - #csrfToken === null 시 뮤테이션 요청 차단 및 명확한 에러 throw
  - #csrfToken === undefined 시 CSRF 로직 전체 건너뜀 (하위 호환)
  - GET/HEAD/OPTIONS 요청에는 토큰 삽입 없음 (RFC 9110 Safe Method)


# STEP D — Vitest 테스트 추가
test(network): add CSRF token injection and error handling test cases

  - init() 미호출 시 뮤테이션 요청에 X-CSRF-Token 헤더 없음 확인
  - init({ csrfToken }) 직접 주입 후 POST/PUT/PATCH/DELETE에 헤더 삽입 확인
  - GET 요청에는 init() 후에도 헤더 미삽입 확인
  - #csrfToken === null 상태에서 뮤테이션 요청 시 Error throw 확인
  - jsdom 환경에서 meta 태그 파싱 성공 케이스 확인


# STEP E — 문서 업데이트
docs: replace false security claims with actual CSRF interceptor spec

  - api-handler.js 모듈 JSDoc 전면 업데이트
  - README에 CSRF 초기화 섹션 추가
  - Spring Security / Laravel / Django 서버별 연동 예시 추가
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                  | 기준                                                           |
| --------------------- | -------------------------------------------------------------- |
| `npm run lint`        | error 0건                                                      |
| `npm test`            | 전체 테스트 통과 (기존 TC-N-001~004 회귀 없음)                 |
| `init()` 미호출       | `_fetch()` 호출 시 X-CSRF-Token 헤더 없음, 정상 전송           |
| `init({ csrfToken })` | POST/PUT/PATCH/DELETE 요청에 `X-CSRF-Token: {token}` 헤더 포함 |
| `init()` 후 토큰 없음 | 뮤테이션 요청 시 `ERR.CSRF_TOKEN_MISSING` 에러 throw           |
| GET 요청              | `init()` 호출 여부와 무관하게 X-CSRF-Token 헤더 미삽입         |
| Node.js 환경          | `typeof document` 가드로 에러 없음                             |
| meta 태그 파싱        | jsdom 환경에서 `document.querySelector` mock으로 검증          |
