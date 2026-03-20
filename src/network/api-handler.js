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
 * - `get(requestPath, options?)` — 외부 개발자가 사용하는 유일한 HTTP 메서드
 *
 * ## 내부 전용 메서드
 * - `_fetch(url, options?)` — `DomainState.save()` / `remove()` 에서 위임 호출
 * - `getUrlConfig()`         — `DomainState._resolveURL()` 에서 URL 설정 참조
 * - `isDebug()`              — 디버그 플래그 외부 노출
 *
 * @module network/api-handler
 * @see {@link module:network/DomainState DomainState}
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

import { DomainState }                  from '../domain/DomainState.js';
import { normalizeUrlConfig, buildURL } from '../core/url-resolver.js';
import { ERR }                          from '../constants/error.messages.js';


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
 *   미입력 시 `ApiHandler` 인스턴스의 `_urlConfig`가 사용된다.
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
// ApiHandler 클래스
// ════════════════════════════════════════════════════════════════════════════════

class ApiHandler {

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
    async get(requestPath, { urlConfig } = {}) {
        const resolved = urlConfig ? normalizeUrlConfig(urlConfig) : this._urlConfig;
        const url      = buildURL(resolved, requestPath);
        const text     = await this._fetch(url, { method: 'GET' });

        if(text === null) throw new Error('[DSM] GET 응답 본문이 비어있습니다');

        return DomainState.fromJSON(text, this, {
            urlConfig: resolved,
            debug:     this._debug,
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
     * 2. `response.ok` 검사 → `false`이면 `HttpError` 구조체를 throw한다.
     * 3. 응답 본문을 `response.text()`로 읽어 반환한다.
     * 4. 응답 본문이 비어있으면 (`204 No Content` 등) `null`을 반환한다.
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
        const res  = await fetch(url, {
            ...options,
            headers: {
                ...this._headers,
                ...(options.headers ?? {}),
            },
        });
        const text = await res.text();

        if (!res.ok) {
            throw /** @type {HttpError} */ ({
                status:     res.status,
                statusText: res.statusText,
                body:       text,
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
