/**
 * ApiHandler — HTTP 전송 레이어
 *
 * `fetch()` 위의 얇은 래퍼로, 다음을 담당한다.
 *
 * 1. **URL 설정 중앙 관리** — `normalizeUrlConfig()`로 정규화된 설정을 인스턴스에 캐싱
 * 2. **공통 헤더 관리** — `Content-Type: application/json` 자동 주입
 * 3. **에러 정규화** — `response.ok` 검사 → `HttpError` 구조체 throw
 * 4. **GET 응답 → `DomainState` 변환** — `DomainState.fromJSON()` 위임
 *
 * ## 인스턴스 생성 책임
 * 클래스만 export하고 **인스턴스 생성은 소비자(Consumer)가 담당**한다.
 * 서버 주소, 환경, 디버그 여부는 생성 시점에 결정되어 인스턴스에 캐싱된다.
 *
 * ## 다중 백엔드 서버 지원
 * 서버가 여러 개라면 각 서버마다 `ApiHandler` 인스턴스를 생성하고,
 * 해당 인스턴스를 `DomainState.fromVO()` / `fromForm()` 에 주입한다.
 * 인스턴스에 결합된 서버 설정이 모든 `save()` / `remove()` 요청에 자동 적용된다.
 *
 * ## 공개 메서드
 * - `init(config?)` — CSRF 토큰 초기화. DOM이 준비된 시점에 1회 호출한다. 미호출 시 CSRF 기능 비활성.
 * - `get(requestPath, options?)` — GET 요청 전송 후 `DomainState` 반환
 *
 * ## 내부 전용 메서드
 * - `_fetch(url, options?)` — `DomainState.save()` / `remove()` 에서 위임 호출
 * - `getUrlConfig()`         — `DomainState._resolveURL()` 에서 URL 설정 참조
 * - `isDebug()`              — 디버그 플래그 외부 노출
 *
 * @module network/api-handler
 * @see {@link module:domain/DomainState DomainState}
 * @see {@link module:core/url-resolver normalizeUrlConfig}
 *
 * @example <caption>기본 사용</caption>
 * import { ApiHandler } from './rest-domain-state-manager.js';
 * const api = new ApiHandler({ host: 'localhost:8080', debug: true });
 * const user = await api.get('/api/users/user_001');
 * user.data.name = 'Davi';
 * await user.save('/api/users/user_001');
 *
 * @example <caption>다중 백엔드 서버</caption>
 * const userApi  = new ApiHandler({ host: 'user-service.com', env: 'production' });
 * const orderApi = new ApiHandler({ host: 'order-service.com', env: 'production' });
 * const user  = await userApi.get('/api/users/1');
 * const order = await orderApi.get('/api/orders/999');
 * await user.save('/api/users/1');    // → user-service.com 으로 전송
 * await order.save('/api/orders/999'); // → order-service.com 으로 전송
 */

import { DomainState } from '../domain/DomainState.js';
import { normalizeUrlConfig, buildURL } from '../core/url-resolver.js';
import { ERR } from '../constants/error.messages.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `ApiHandler._fetch()` 실패 시 throw되는 구조화된 HTTP 에러 객체.
 *
 * `catch(err)` 블록에서 `err.status`로 HTTP 상태코드 기반 분기가 가능하다.
 *
 * @typedef {object} HttpError
 * @property {number} status     - HTTP 응답 상태 코드 (예: `400`, `404`, `409`, `500`)
 * @property {string} statusText - HTTP 응답 상태 텍스트 (예: `'Not Found'`, `'Conflict'`)
 * @property {string} body       - 응답 본문 텍스트 (서버가 내려준 에러 메시지 포함)
 */

/**
 * `ApiHandler.get()`의 `options` 파라미터.
 *
 * @typedef {object} GetOptions
 * @property {import('../core/url-resolver.js').UrlConfig} [urlConfig]
 *   이 요청에만 적용할 URL 설정 오버라이드.
 * @property {import('../domain/DomainVO.js').DomainVO}    [vo]
 *   스키마 검증 및 변환기 주입용 DomainVO 인스턴스.
 * @property {boolean} [strict=false]
 *   `true`이면 VO 스키마 불일치 시 Error를 throw한다.
 */

/**
 * `normalizeUrlConfig()`의 반환값.
 * 상세 정의는 `url-resolver.js`의 `NormalizedUrlConfig`를 참조한다.
 *
 * @typedef {import('../core/url-resolver.js').NormalizedUrlConfig} NormalizedUrlConfig
 */

/**
 * `ApiHandler` 생성자에 전달하는 URL 입력 설정 객체.
 * 상세 정의는 `url-resolver.js`의 `UrlConfig`를 참조한다.
 *
 * @typedef {import('../core/url-resolver.js').UrlConfig} UrlConfig
 */

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 상수
// ════════════════════════════════════════════════════════════════════════════════

/**
 * CSRF 토큰 삽입이 필요한 HTTP 메서드 집합.
 * RFC 9110 기준 서버 상태를 변경하는 메서드만 포함한다.
 * GET / HEAD / OPTIONS / TRACE 는 Safe Method로 제외.
 *
 * Set으로 선언하는 이유: Array.includes()는 O(n), Set.has()는 O(1).
 * 항목이 4개뿐이라 실측 차이는 없으나, 의미론적으로 '순서 없는 집합'이 정확하다.
 *
 * @type {Set<string>}
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ════════════════════════════════════════════════════════════════════════════════
// ApiHandler 클래스
// ════════════════════════════════════════════════════════════════════════════════

class ApiHandler {
    // ── CSRF 토큰 저장소 ───────────────────────────────────────────────────────
    /**
     * CSRF 토큰 저장소. `init()` 호출 여부와 파싱 결과를 3-상태로 구분한다.
     *
     * | 상태        | 의미                                              | `_fetch()` 동작              |
     * |-------------|---------------------------------------------------|------------------------------|
     * | `undefined` | `init()` 미호출. CSRF 기능 비활성.                | 토큰 삽입 로직 전체 건너뜀   |
     * | `null`      | `init()` 호출됨. 토큰 파싱 실패.                  | 뮤테이션 요청 시 즉시 throw  |
     * | `string`    | 정상 파싱된 토큰 값.                               | `X-CSRF-Token` 헤더 자동 주입 |
     *
     * Private class field로 선언하여 외부 직접 접근 및 덮어쓰기를 차단한다.
     *
     * @type {string | null | undefined}
     */
    #csrfToken = undefined;

    // ════════════════════════════════════════════════════════════════════════════
    // 생성자
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * `ApiHandler` 인스턴스를 생성한다.
     *
     * `normalizeUrlConfig(urlConfig)`를 즉시 실행하여 URL 설정을 정규화하고
     * `this._urlConfig`에 캐싱한다. 이후 모든 요청은 이 캐싱된 설정을 기반으로 한다.
     *
     * @param {UrlConfig} [urlConfig={}]
     *   URL 설정 객체. `host` 또는 `baseURL` 중 하나를 포함해야 한다.
     * @throws {Error} `urlConfig`의 `protocol` 값이 유효하지 않은 경우
     * @throws {Error} `host`와 `baseURL`이 동시에 입력되어 충돌 해소가 불가능한 경우
     *
     * @example <caption>개발 환경 (HTTP 자동 선택)</caption>
     * const api = new ApiHandler({ host: 'localhost:8080', debug: true });
     *
     * @example <caption>운영 환경 (HTTPS 자동 선택)</caption>
     * const api = new ApiHandler({ host: 'api.example.com', env: 'production' });
     *
     * @example <caption>통합 문자열형 baseURL</caption>
     * const api = new ApiHandler({ baseURL: 'localhost:8080/app/api', debug: true });
     *
     * @example <caption>명시적 프로토콜</caption>
     * const api = new ApiHandler({ host: 'api.example.com', protocol: 'HTTPS' });
     */
    constructor(urlConfig = {}) {
        /**
         * 정규화된 URL 설정. 요청마다 `buildURL()`에 전달된다.
         * @type {NormalizedUrlConfig}
         */
        this._urlConfig = normalizeUrlConfig(urlConfig);

        /**
         * 디버그 플래그. `get()`으로 생성한 `DomainState`의 `debug` 옵션에 전파된다.
         * @type {boolean}
         */
        this._debug = urlConfig.debug ?? false;

        /**
         * 모든 요청에 공통으로 주입되는 HTTP 헤더.
         * `_fetch()` 호출 시 `options.headers`와 병합된다.
         * 요청별 헤더 오버라이드는 `options.headers`로 가능하다.
         * @type {Record<string, string>}
         */
        this._headers = { 'Content-Type': 'application/json' };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 공개 API
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * CSRF 토큰을 초기화한다. DOM이 준비된 시점에 1회 호출한다.
     *
     * ## 탐색 우선순위
     * 1. `csrfToken` 직접 주입 — Vitest / SSR 환경용
     * 2. `csrfSelector` CSS 선택자로 meta 태그 `content` 파싱
     * 3. `csrfSelector` 미지정 시 `'meta[name="_csrf"]'` 기본값으로 탐색 (Spring Security 기본)
     * 4. `csrfCookieName` 지정 시 `document.cookie` 파싱 (Double-Submit Cookie 패턴)
     * 5. 모두 실패 → `#csrfToken = null` (뮤테이션 요청 발생 시 throw)
     *
     * ## 환경 호환성
     * `typeof document === 'undefined'`인 Node.js / Vitest 환경에서는
     * DOM 탐색을 건너뛴다. 이 환경에서는 `csrfToken` 직접 주입만 동작한다.
     *
     * @param {object} [config={}]             - CSRF 토큰 탐색 전략을 구성하는 옵션 객체.
     * @param {string} [config.csrfSelector]   - CSRF 토큰 meta 태그 CSS 선택자.
     *                                           기본값: `'meta[name="_csrf"]'`
     * @param {string} [config.csrfCookieName] - Double-Submit Cookie 방식의 쿠키명.
     *                                           csrfSelector 탐색 실패 시 fallback.
     * @param {string} [config.csrfToken]      - 토큰 직접 주입. 지정 시 다른 탐색보다 우선.
     * @returns {ApiHandler} 체이닝용 `this` 반환
     *
     * @example <caption>Spring Security — meta 태그 기본값 자동 탐색</caption>
     * // 서버가 렌더링한 HTML: <meta name="_csrf" content="abc123">
     * api.init({});
     *
     * @example <caption>커스텀 선택자 (Laravel / Django)</caption>
     * // HTML: <meta name="csrf-token" content="abc123">
     * api.init({ csrfSelector: 'meta[name="csrf-token"]' });
     *
     * @example <caption>Double-Submit Cookie</caption>
     * api.init({ csrfCookieName: 'XSRF-TOKEN' });
     *
     * @example <caption>Vitest / SSR 환경 — 직접 주입</caption>
     * api.init({ csrfToken: 'test-csrf-token' });
     */
    init({ csrfSelector, csrfCookieName, csrfToken } = {}) {
        // ── 1순위: 직접 주입 ─────────────────────────────────────────────────
        // Node.js, SSR, Vitest 환경에서 DOM 없이 토큰을 주입할 때 사용한다.
        if (typeof csrfToken === 'string') {
            this.#csrfToken = csrfToken;
            return this;
        }

        // ── 2·3순위: DOM 탐색 (브라우저 환경 전용) ───────────────────────────
        // Node.js / Vitest 환경에서는 document 자체가 없으므로 전체 블록을 건너뛴다.
        if (typeof document !== 'undefined') {
            // 2순위: meta 태그 파싱
            // csrfSelector 미지정 시 Spring Security 기본 태그명으로 탐색한다.
            const selector = csrfSelector ?? 'meta[name="_csrf"]';
            const metaEl =
                /** @type {Element | HTMLMetaElement | null} */ document.querySelector(selector);

            if (metaEl && metaEl instanceof HTMLMetaElement) {
                if (metaEl.content) {
                    // 정상 케이스
                    this.#csrfToken = metaEl.content;
                    return this;
                } else {
                    // 태그는 있는데 content가 비어있음 → 서버 사이드 버그
                    // throw가 아닌 console.warn으로 처리하는 게 맞다.
                    // init() 시점에 throw하면 앱 자체가 초기화를 못 하니까.
                    // 대신 이후 뮤테이션 요청에서 null 상태로 throw되어 감지된다.
                    console.warn(ERR.CSRF_INIT_NO_TOKEN(selector));
                    // #csrfToken = null 처리로 흘러내려감 (의도적)
                }
            }

            // 3순위: cookie 파싱 (Double-Submit Cookie 패턴)
            // csrfCookieName을 명시한 경우에만 시도한다.
            if (csrfCookieName) {
                const match = document.cookie
                    .split(';')
                    .map((c) => c.trim())
                    .find((c) => c.startsWith(`${csrfCookieName}=`));

                if (match) {
                    this.#csrfToken = decodeURIComponent(match.split('=')[1]);
                    return this;
                }
            }
        }

        // ── 탐색 실패: null 마킹 ─────────────────────────────────────────────
        // init()은 분명히 호출됐는데 토큰을 찾지 못한 상태.
        // undefined(미호출)와 달리, 뮤테이션 요청이 들어오면 즉시 throw한다.
        this.#csrfToken = null;
        return this;
    }

    /**
     * HTTP GET 요청을 전송하고 응답을 `DomainState`로 변환하여 반환한다.
     *
     * ## 내부 처리 흐름
     * ```
     * requestPath + urlConfig
     *   ↓ buildURL()
     * 최종 URL
     *   ↓ this._fetch(url, { method: 'GET' })
     * 응답 텍스트 (JSON 문자열)
     *   ↓ DomainState.fromJSON(text, this, { urlConfig, debug })
     * DomainState (isNew: false)
     * ```
     *
     * 반환된 `DomainState`는 `isNew: false`이므로 `save()` 시 PATCH 또는 PUT을 전송한다.
     * `debug: true`이면 반환된 `DomainState`도 디버그 채널에 연결된다.
     *
     * @param {string}     requestPath - 엔드포인트 경로 (예: `'/api/users/user_001'`)
     * @param {GetOptions} [options={}] - 요청별 추가 옵션
     * @returns {Promise<DomainState>} 응답 데이터를 담은 `DomainState` 인스턴스 (`isNew: false`)
     * @throws {HttpError} 서버가 `response.ok === false` 응답을 반환한 경우
     * @throws {SyntaxError} 응답 본문이 유효하지 않은 JSON인 경우 (`DomainState.fromJSON` 내부)
     *
     * @example <caption>기본 GET → 수정 → 저장</caption>
     * const user = await api.get('/api/users/user_001');
     * console.log(user.data.name); // GET 응답 데이터 읽기
     * user.data.name = 'Davi';     // changeLog에 replace 기록
     * await user.save('/api/users/user_001'); // PATCH 전송
     *
     * @example <caption>요청별 URL 오버라이드</caption>
     * const user = await api.get('/api/users/1', {
     *     urlConfig: { host: 'staging.example.com' },
     * });
     *
     * @example <caption>에러 처리</caption>
     * try {
     *     const user = await api.get('/api/users/INVALID_ID');
     * } catch (err) {
     *     if (err.status === 404) console.error('사용자를 찾을 수 없습니다.');
     * }
     */
    async get(requestPath, { urlConfig, vo, strict = false } = {}) {
        const resolved = urlConfig ? normalizeUrlConfig(urlConfig) : this._urlConfig;
        const url = buildURL(resolved, requestPath);
        const text = await this._fetch(url, { method: 'GET' });

        if (text === null) throw new Error('[DSM] GET 응답 본문이 비어있습니다');

        return DomainState.fromJSON(text, this, {
            urlConfig: resolved,
            debug: this._debug,
            vo: vo ?? null,
            strict: strict,
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 내부 전용 메서드 (DomainState가 위임 호출)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * `fetch()` 공통 처리 메서드. `DomainState.save()` / `remove()` 내부에서 위임 호출된다.
     *
     * ## 처리 내용
     * 1. `this._headers`와 `options.headers`를 병합하여 공통 헤더를 주입한다.
     * 2. **CSRF 토큰 삽입** — `init()`으로 토큰이 주입된 상태이고 뮤테이션 메서드
     *    (`POST` / `PUT` / `PATCH` / `DELETE`)인 경우 `X-CSRF-Token` 헤더를 추가한다.
     *    `init()` 미호출(`#csrfToken === undefined`) 시 이 단계를 건너뛴다.
     * 3. `response.ok` 검사 → `false`이면 `HttpError` 구조체를 throw한다.
     * 4. 응답 본문을 `response.text()`로 읽어 반환한다.
     * 5. 응답 본문이 비어있으면 (`204 No Content` 등) `null`을 반환한다.
     *
     * ## 헤더 병합 우선순위
     * `options.headers`가 `this._headers`보다 우선 적용된다. (스프레드 오버라이드)
     * ```
     * { ...this._headers, ...options.headers }
     * ```
     *
     * @param {string}      url            - `buildURL()`이 반환한 완성된 요청 URL
     * @param {RequestInit} [options={}]   - `fetch()` 두 번째 인자와 동일. `method`, `body`, `headers` 포함.
     * @returns {Promise<string | null>} 응답 본문 텍스트. 빈 응답이면 `null`.
     * @throws {HttpError} `response.ok === false`인 경우 (`{ status, statusText, body }`)
     * @throws {Error}     `init()` 호출 후 토큰 파싱에 실패한 상태(`#csrfToken === null`)에서
     *                     뮤테이션 메서드 요청 시. 요청은 서버에 전달되지 않는다.
     *
     * @example <caption>DomainState.save() 내부에서의 POST 호출</caption>
     * await this._handler._fetch(url, {
     *     method: 'POST',
     *     body:   JSON.stringify({ name: 'Davi' }),
     * });
     *
     * @example <caption>DomainState.save() 내부에서의 PATCH 호출</caption>
     * await this._handler._fetch(url, {
     *     method: 'PATCH',
     *     body:   JSON.stringify([{ op: 'replace', path: '/name', value: 'Davi' }]),
     * });
     *
     * @example <caption>DomainState.remove() 내부에서의 DELETE 호출</caption>
     * await this._handler._fetch(url, { method: 'DELETE' });
     * // 204 No Content → null 반환
     */
    async _fetch(url, options = {}) {
        const method = (options.method ?? 'GET').toUpperCase();

        // 헤더를 변수로 먼저 구성한다.
        // CSRF 토큰을 조건부로 추가해야 하므로 스프레드 한 방으로 끝내지 않고
        // 별도 객체로 분리한다.
        const headers = {
            ...this._headers,
            .../** @type {Record<string, string>} */ (options.headers ?? {}),
        };

        // ── CSRF 토큰 삽입 ────────────────────────────────────────────────────
        //
        // | #csrfToken 상태 | 이 블록에서 일어나는 일                          |
        // |-----------------|--------------------------------------------------|
        // | undefined       | init() 미호출. 아무것도 하지 않음. (CSRF 비활성) |
        // | null            | init() 호출됐으나 토큰 없음. throw.              |
        // | string          | X-CSRF-Token 헤더 주입.                          |
        //
        // GET / HEAD / OPTIONS 등 Safe Method는 이 블록 자체에 진입하지 않는다.
        // (OWASP CSRF Prevention Cheat Sheet, RFC 9110 § 9.2.1)
        if (MUTATING_METHODS.has(method)) {
            if (this.#csrfToken === null) {
                throw new Error(ERR.CSRF_TOKEN_MISSING(method));
            }
            if (typeof this.#csrfToken === 'string') {
                headers['X-CSRF-Token'] = this.#csrfToken;
            }
            // this.#csrfToken === undefined → 조건 미해당. 건너뜀.
        }
        // ─────────────────────────────────────────────────────────────────────

        const res = await fetch(url, {
            ...options,
            headers, // 위에서 조립한 headers 객체로 덮어씀
        });

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

    /**
     * 이 `ApiHandler` 인스턴스의 정규화된 URL 설정을 반환한다.
     *
     * `DomainState._resolveURL()`에서 `requestPath`와 조합할 때 참조한다.
     * 인스턴스 생성 시 `normalizeUrlConfig()`가 반환한 값을 그대로 반환한다.
     *
     * @returns {NormalizedUrlConfig} `{ protocol, host, basePath }` 정규화된 URL 설정
     *
     * @example <caption>DomainState._resolveURL() 내부에서의 사용</caption>
     * // DomainState 내부:
     * _resolveURL(requestPath) {
     *     const config = this._urlConfig ?? this._handler?.getUrlConfig() ?? {};
     *     return buildURL(config, requestPath ?? '');
     * }
     */
    getUrlConfig() {
        return this._urlConfig;
    }

    /**
     * 이 `ApiHandler` 인스턴스의 디버그 플래그를 반환한다.
     *
     * `get()`으로 생성한 `DomainState.fromJSON()`에 `debug` 옵션으로 전달되어
     * 반환된 `DomainState`의 디버그 채널 연결 여부를 결정한다.
     *
     * @returns {boolean} 디버그 모드 활성화 여부
     *
     * @example
     * const api = new ApiHandler({ host: 'localhost:8080', debug: true });
     * api.isDebug(); // → true
     *
     * const user = await api.get('/api/users/1');
     * user._debug; // → true (ApiHandler의 debug 플래그가 전파됨)
     */
    isDebug() {
        return this._debug;
    }
}

export { ApiHandler };
