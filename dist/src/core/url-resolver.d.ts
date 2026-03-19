/**
 * `ApiHandler` 생성자 및 `normalizeUrlConfig()`에 전달하는 URL 입력 설정 객체.
 *
 * `host`와 `baseURL`은 **택일(mutually exclusive)**이다.
 * 동시에 입력하면 자동 충돌 해소를 시도하고, 불가능하면 `Error`를 throw한다.
 *
 * @typedef {object} UrlConfig
 *
 * @property {string}  [protocol]
 *   사용할 프로토콜 키. 대소문자 무관.
 *   허용값: `'HTTP'` | `'HTTPS'` | `'FILE'` | `'SSH'`
 *   미입력 시 `env` / `debug` 플래그로 자동 결정된다.
 *
 * @property {string}  [host]
 *   프로토콜을 제외한 호스트 문자열.
 *   예: `'api.example.com'`, `'localhost:8080'`
 *   `baseURL`과 택일.
 *
 * @property {string}  [basePath]
 *   모든 요청에 공통으로 붙는 경로 접두사. (Context Path + 추가 경로)
 *   예: `'/app/api'`, `'/v1'`
 *   `host` 방식 사용 시 별도 지정.
 *   `baseURL` 방식 사용 시 `baseURL` 파싱으로 자동 추출.
 *
 * @property {string}  [baseURL]
 *   `host + basePath`를 하나의 문자열로 합친 통합 URL 설정.
 *   프로토콜 접두사(`http://` 등)가 포함된 경우 자동으로 제거된다.
 *   예: `'localhost:8080/api'`, `'https://api.example.com/v1'`
 *   `host`와 택일.
 *
 * @property {string}  [env]
 *   실행 환경 식별자. 프로토콜 자동 결정에 사용된다.
 *   허용값: `'development'` | `'production'`
 *
 * @property {boolean} [debug=false]
 *   `true`이면 개발 환경으로 간주하여 HTTP를 기본 프로토콜로 사용한다.
 *   `env`가 명시된 경우 `debug`보다 `env`가 우선한다.
 */
/**
 * `normalizeUrlConfig()`의 반환값. 모든 URL 조합 함수의 공통 입력 타입.
 *
 * `protocol`은 이미 확정된 문자열(`'http://'` 등)이며,
 * `host`와 `basePath`는 슬래시가 정규화된 상태다.
 *
 * @typedef {object} NormalizedUrlConfig
 * @property {string} protocol - 확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`)
 * @property {string} host     - 프로토콜 제외 호스트 (예: `'api.example.com'`, `'localhost:8080'`)
 * @property {string} basePath - 슬래시 정규화된 공통 경로 접두사 (예: `'/app/api'`, `''`)
 */
/**
 * `resolveProtocol()`의 입력 옵션 객체.
 *
 * @typedef {object} ResolveProtocolOptions
 * @property {string}  [protocol] - `UrlConfig.protocol`과 동일. 대소문자 무관.
 * @property {string}  [env]      - `UrlConfig.env`와 동일.
 * @property {boolean} [debug=false] - `UrlConfig.debug`와 동일.
 */
/**
 * `ApiHandler._fetch()` / `DomainState.save()` 실패 시 throw되는 구조화된 HTTP 에러.
 *
 * @typedef {object} HttpError
 * @property {number} status     - HTTP 상태 코드 (예: `404`, `500`)
 * @property {string} statusText - HTTP 상태 텍스트 (예: `'Not Found'`)
 * @property {string} body       - 응답 본문 텍스트 (서버가 내려준 에러 메시지 포함)
 */
/**
 * URL 입력 설정 객체(`UrlConfig`)를 받아 정규화된 내부 형태(`NormalizedUrlConfig`)로 변환한다.
 *
 * `ApiHandler` 생성자에서 1회 호출되어 인스턴스에 캐싱된다.
 * 이후 요청마다 `buildURL()`에 전달되어 최종 URL을 조합한다.
 *
 * ## host + baseURL 동시 입력 충돌 해소
 *
 * | 케이스 | 조건                            | 처리                                   |
 * |--------|--------------------------------|----------------------------------------|
 * | A      | `baseURL`이 `host`로 시작       | `basePath`로 해석 + 콘솔 경고          |
 * | B      | `baseURL` 안에 `host` 포함     | `host` 무시 + 콘솔 경고                |
 * | C      | 두 값이 완전히 무관             | `Error` throw (자동 해소 불가)          |
 *
 * ## baseURL 파싱 규칙
 * `baseURL`만 입력된 경우(또는 케이스 A 처리 후):
 * 1. 프로토콜 접두사(`http://` 등)를 제거한다.
 * 2. 첫 번째 `/`를 기준으로 `host`와 `basePath`를 분리한다.
 * 3. `/`가 없으면 전체가 `host`이고 `basePath`는 빈 문자열이 된다.
 *
 * @param {UrlConfig} [config={}] - URL 입력 설정 객체
 * @returns {NormalizedUrlConfig} 정규화된 URL 설정 (`protocol`, `host`, `basePath`)
 * @throws {Error} `host`와 `baseURL`이 동시에 입력되어 자동 해소가 불가능한 경우 (케이스 C)
 * @throws {Error} `protocol` 값이 허용된 키(`'HTTP'|'HTTPS'|'FILE'|'SSH'`)가 아닌 경우
 *
 * @example <caption>구조 분해형 입력</caption>
 * normalizeUrlConfig({ host: 'api.example.com', basePath: '/v1', env: 'production' });
 * // → { protocol: 'https://', host: 'api.example.com', basePath: '/v1' }
 *
 * @example <caption>통합 문자열형 입력</caption>
 * normalizeUrlConfig({ baseURL: 'localhost:8080/api', debug: true });
 * // → { protocol: 'http://', host: 'localhost:8080', basePath: '/api' }
 *
 * @example <caption>프로토콜 접두사 포함된 baseURL</caption>
 * normalizeUrlConfig({ baseURL: 'https://api.example.com/v1' });
 * // → { protocol: 'https://', host: 'api.example.com', basePath: '/v1' }
 *
 * @example <caption>케이스 A 충돌 해소</caption>
 * normalizeUrlConfig({ host: 'localhost:8080', baseURL: 'localhost:8080/api' });
 * // console.warn 출력 후 → { protocol: 'https://', host: 'localhost:8080', basePath: '/api' }
 */
export function normalizeUrlConfig(config?: UrlConfig): NormalizedUrlConfig;
/**
 * 주어진 옵션을 우선순위에 따라 평가하여 프로토콜 문자열을 결정한다.
 *
 * ## 우선순위
 * 1. `protocol` 명시 → `PROTOCOL[key]` 반환 (예: `'https://'`)
 * 2. `env` 명시 → `DEFAULT_PROTOCOL[env]` 반환 (없으면 `DEFAULT_PROTOCOL['development']`)
 * 3. `debug: true` → `PROTOCOL.HTTP` (`'http://'`)
 * 4. 그 외 → `PROTOCOL.HTTPS` (`'https://'`) — 보안 기본값
 *
 * `normalizeUrlConfig()` 내부에서 호출되며, 단독으로도 사용 가능하다.
 *
 * @param {ResolveProtocolOptions} [opts={}] - 프로토콜 결정 옵션
 * @returns {string} 확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`, `'file://'`)
 * @throws {Error} `protocol` 값이 `VALID_PROTOCOL_KEYS`에 없는 경우
 *
 * @example <caption>명시적 프로토콜</caption>
 * resolveProtocol({ protocol: 'HTTPS' }); // → 'https://'
 * resolveProtocol({ protocol: 'http' });  // → 'http://'  (대소문자 무관)
 *
 * @example <caption>env 기반 결정</caption>
 * resolveProtocol({ env: 'production' });  // → 'https://'
 * resolveProtocol({ env: 'development' }); // → 'http://'
 *
 * @example <caption>debug 플래그 기반 결정</caption>
 * resolveProtocol({ debug: true });  // → 'http://'
 * resolveProtocol({ debug: false }); // → 'https://'
 * resolveProtocol({});               // → 'https://'  (기본값)
 *
 * @example <caption>유효하지 않은 protocol 키</caption>
 * resolveProtocol({ protocol: 'FTP' }); // → Error throw
 */
export function resolveProtocol({ protocol, env, debug }?: ResolveProtocolOptions): string;
/**
 * 정규화된 URL 설정(`NormalizedUrlConfig`)과 `requestPath`를 조합하여 최종 URL 문자열을 반환한다.
 *
 * `DomainState.save()` / `remove()` 및 `ApiHandler.get()` 호출마다 실행된다.
 *
 * ## 조합 규칙
 * 1. `requestPath`가 프로토콜을 포함한 full URL이면 `normalized`를 무시하고 그대로 반환한다.
 * 2. 각 파트(`protocol`, `host`, `basePath`, `requestPath`)를 배열로 만들어
 *    빈 값을 필터링한 뒤 `/`로 연결한다.
 * 3. 슬래시 중복을 제거하기 위해 `protocol`은 끝 슬래시를, 나머지는 양끝 슬래시를 제거 후 연결한다.
 *
 * ## 슬래시 정규화 예시
 * ```
 * protocol = 'http://'
 * host     = 'localhost:8080'
 * basePath = '/api'
 * requestPath = '/users/1'
 * → 'http://localhost:8080/api/users/1'
 * ```
 *
 * @param {NormalizedUrlConfig} normalized   - `normalizeUrlConfig()`의 반환값
 * @param {string}              [requestPath=''] - 엔드포인트 경로 (예: `'/api/users/1'`)
 * @returns {string} 조합된 최종 요청 URL
 * @throws {Error} `host`가 비어있고 `requestPath`도 없어서 URL을 확정할 수 없는 경우
 *
 * @example <caption>일반적인 조합</caption>
 * const cfg = { protocol: 'http://', host: 'localhost:8080', basePath: '/api' };
 * buildURL(cfg, '/users/1'); // → 'http://localhost:8080/api/users/1'
 *
 * @example <caption>requestPath가 full URL인 경우</caption>
 * buildURL(cfg, 'https://other.server.com/resource');
 * // → 'https://other.server.com/resource'  (normalized 무시)
 *
 * @example <caption>requestPath 없이 basePath만 사용</caption>
 * buildURL({ protocol: 'https://', host: 'api.example.com', basePath: '/users' }, '');
 * // → 'https://api.example.com/users'
 *
 * @example <caption>슬래시 중복 제거</caption>
 * buildURL({ protocol: 'http://', host: 'localhost:8080', basePath: '/api/' }, '/users/');
 * // → 'http://localhost:8080/api/users'
 */
export function buildURL(normalized: NormalizedUrlConfig, requestPath?: string): string;
/**
 * `ApiHandler` 생성자 및 `normalizeUrlConfig()`에 전달하는 URL 입력 설정 객체.
 *
 * `host`와 `baseURL`은 **택일(mutually exclusive)**이다.
 * 동시에 입력하면 자동 충돌 해소를 시도하고, 불가능하면 `Error`를 throw한다.
 */
export type UrlConfig = {
    /**
     * 사용할 프로토콜 키. 대소문자 무관.
     * 허용값: `'HTTP'` | `'HTTPS'` | `'FILE'` | `'SSH'`
     * 미입력 시 `env` / `debug` 플래그로 자동 결정된다.
     */
    protocol?: string | undefined;
    /**
     * 프로토콜을 제외한 호스트 문자열.
     * 예: `'api.example.com'`, `'localhost:8080'`
     * `baseURL`과 택일.
     */
    host?: string | undefined;
    /**
     * 모든 요청에 공통으로 붙는 경로 접두사. (Context Path + 추가 경로)
     * 예: `'/app/api'`, `'/v1'`
     * `host` 방식 사용 시 별도 지정.
     * `baseURL` 방식 사용 시 `baseURL` 파싱으로 자동 추출.
     */
    basePath?: string | undefined;
    /**
     * `host + basePath`를 하나의 문자열로 합친 통합 URL 설정.
     * 프로토콜 접두사(`http://` 등)가 포함된 경우 자동으로 제거된다.
     * 예: `'localhost:8080/api'`, `'https://api.example.com/v1'`
     * `host`와 택일.
     */
    baseURL?: string | undefined;
    /**
     * 실행 환경 식별자. 프로토콜 자동 결정에 사용된다.
     * 허용값: `'development'` | `'production'`
     */
    env?: string | undefined;
    /**
     * `true`이면 개발 환경으로 간주하여 HTTP를 기본 프로토콜로 사용한다.
     * `env`가 명시된 경우 `debug`보다 `env`가 우선한다.
     */
    debug?: boolean | undefined;
};
/**
 * `normalizeUrlConfig()`의 반환값. 모든 URL 조합 함수의 공통 입력 타입.
 *
 * `protocol`은 이미 확정된 문자열(`'http://'` 등)이며,
 * `host`와 `basePath`는 슬래시가 정규화된 상태다.
 */
export type NormalizedUrlConfig = {
    /**
     * - 확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`)
     */
    protocol: string;
    /**
     * - 프로토콜 제외 호스트 (예: `'api.example.com'`, `'localhost:8080'`)
     */
    host: string;
    /**
     * - 슬래시 정규화된 공통 경로 접두사 (예: `'/app/api'`, `''`)
     */
    basePath: string;
};
/**
 * `resolveProtocol()`의 입력 옵션 객체.
 */
export type ResolveProtocolOptions = {
    /**
     * - `UrlConfig.protocol`과 동일. 대소문자 무관.
     */
    protocol?: string | undefined;
    /**
     * - `UrlConfig.env`와 동일.
     */
    env?: string | undefined;
    /**
     * - `UrlConfig.debug`와 동일.
     */
    debug?: boolean | undefined;
};
/**
 * `ApiHandler._fetch()` / `DomainState.save()` 실패 시 throw되는 구조화된 HTTP 에러.
 */
export type HttpError = {
    /**
     * - HTTP 상태 코드 (예: `404`, `500`)
     */
    status: number;
    /**
     * - HTTP 상태 텍스트 (예: `'Not Found'`)
     */
    statusText: string;
    /**
     * - 응답 본문 텍스트 (서버가 내려준 에러 메시지 포함)
     */
    body: string;
};
