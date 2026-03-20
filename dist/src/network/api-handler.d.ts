/**
 * `ApiHandler._fetch()` 실패 시 throw되는 구조화된 HTTP 에러 객체.
 *
 * `catch(err)` 블록에서 `err.status`로 HTTP 상태코드 기반 분기가 가능하다.
 */
export type HttpError = {
    /**
     * - HTTP 응답 상태 코드 (예: `400`, `404`, `409`, `500`)
     */
    status: number;
    /**
     * - HTTP 응답 상태 텍스트 (예: `'Not Found'`, `'Conflict'`)
     */
    statusText: string;
    /**
     * - 응답 본문 텍스트 (서버가 내려준 에러 메시지 포함)
     */
    body: string;
};
/**
 * `ApiHandler.get()`의 `options` 파라미터.
 */
export type GetOptions = {
    /**
     * 이 요청에만 적용할 URL 설정 오버라이드.
     * 미입력 시 `ApiHandler` 인스턴스의 `_urlConfig`가 사용된다.
     */
    urlConfig?: import("../core/url-resolver.js").UrlConfig | undefined;
};
/**
 * `normalizeUrlConfig()`의 반환값.
 * 상세 정의는 `url-resolver.js`의 `NormalizedUrlConfig`를 참조한다.
 */
export type NormalizedUrlConfig = import("../core/url-resolver.js").NormalizedUrlConfig;
/**
 * `ApiHandler` 생성자에 전달하는 URL 입력 설정 객체.
 * 상세 정의는 `url-resolver.js`의 `UrlConfig`를 참조한다.
 */
export type UrlConfig = import("../core/url-resolver.js").UrlConfig;
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
export class ApiHandler {
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
    constructor(urlConfig?: UrlConfig);
    /**
     * 정규화된 URL 설정. 요청마다 `buildURL()`에 전달된다.
     * @type {NormalizedUrlConfig}
     */
    _urlConfig: NormalizedUrlConfig;
    /**
     * 디버그 플래그. `get()`으로 생성한 `DomainState`의 `debug` 옵션에 전파된다.
     * @type {boolean}
     */
    _debug: boolean;
    /**
     * 모든 요청에 공통으로 주입되는 HTTP 헤더.
     * `_fetch()` 호출 시 `options.headers`와 병합된다.
     * 요청별 헤더 오버라이드는 `options.headers`로 가능하다.
     * @type {Record<string, string>}
     */
    _headers: Record<string, string>;
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
    get(requestPath: string, { urlConfig }?: GetOptions): Promise<DomainState>;
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
    _fetch(url: string, options?: RequestInit): Promise<string | null>;
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
    getUrlConfig(): NormalizedUrlConfig;
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
    isDebug(): boolean;
}
import { DomainState } from '../domain/DomainState.js';
