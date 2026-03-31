/**
 * 에러 및 경고 메시지 상수
 *
 * 라이브러리 전체에서 발생하는 모든 Error/Warning 메시지를 중앙 관리한다.
 * 메시지 함수는 컨텍스트 값을 인자로 받아 최종 문자열을 반환한다.
 *
 * @module constants/error.messages
 */

/** @type {string} 라이브러리 접두사 */
const PREFIX = '[DSM]';

/**
 * ERR : throw되는 Error 메시지 상수
 * 함수형 항목은 컨텍스트 값을 받아 완성된 메시지 문자열을 반환한다.
 *
 * @readonly
 * @namespace
 */
export const ERR = Object.freeze({
    // ── URL ────────────────────────────────────────────────────────────────
    /** @param {string} host @param {string} baseURL */
    URL_CONFLICT: (host, baseURL) =>
        `${PREFIX} host("${host}")와 baseURL("${baseURL}")이 충돌합니다. 둘 중 하나만 사용하세요.`,

    URL_MISSING: `${PREFIX} URL을 특정할 수 없습니다. save(path) 또는 baseURL/host를 설정하세요.`,

    /** @param {string} val - 프로토콜 파라미터 */
    PROTOCOL_INVALID: (val) =>
        `${PREFIX} 유효하지 않은 protocol 값: "${val}". HTTP | HTTPS | FILE | SSH 중 하나를 사용하세요.`,

    // ── DomainState 팩토리 ─────────────────────────────────────────────────
    /** @param {string} method - DomainState의 메서드 명 */
    HANDLER_MISSING: (method) =>
        `${PREFIX} DomainState.${method}(): ApiHandler가 주입되지 않았습니다. ` +
        'fromJSON / fromForm / fromVO의 두 번째 인자로 api를 전달하세요.',

    FROM_VO_TYPE: `${PREFIX} DomainState.fromVO(): DomainVO 인스턴스를 전달해야 합니다.`,

    FROM_FORM_TYPE: `${PREFIX} DomainState.fromForm(): HTMLFormElement 또는 form id 문자열을 전달해야 합니다.`,

    /** @param {string} id - Form요소의 id 속성 문자열 */
    FORM_NOT_FOUND: (id) =>
        `${PREFIX} DomainState.fromForm(): id="${id}"인 form 요소를 찾을 수 없습니다.`,

    // ── DomainState 동기화 ─────────────────────────────────────────────────
    /** @param {number} status - HTTP 상태 코드 */
    SAVE_ROLLBACK: (status) =>
        `${PREFIX} save() HTTP ${status} 오류 — 서버 동기화 실패. 도메인 상태를 save() 호출 이전으로 롤백합니다.`,

    // ── DomainVO 정합성 ────────────────────────────────────────────────────
    /** @param {string} key - DomainVO의 필드명 */
    VO_SCHEMA_MISSING_KEY: (key) =>
        `${PREFIX} DomainVO 정합성 오류: 응답 데이터에 VO 스키마의 "${key}" 필드가 없습니다.`,

    /** @param {string} key - DomainVO의 필드명 */
    VO_SCHEMA_EXTRA_KEY: (key) =>
        `${PREFIX} DomainVO 정합성 경고: 응답 데이터에 VO 스키마에 없는 "${key}" 필드가 포함되어 있습니다.`,

    // ── 플러그인 ───────────────────────────────────────────────────────────
    PLUGIN_NO_INSTALL: `${PREFIX} DomainState.use(): 플러그인은 install(DomainState) 메서드를 가져야 합니다.`,

    // ── ApiHandler CSRF ────────────────────────────────────────────────────
    /** @param {string} method - 토큰 없이 시도된 HTTP 메서드 */
    CSRF_TOKEN_MISSING: (method) =>
        `${PREFIX} ApiHandler._fetch(): ${method} 요청에 CSRF 토큰이 필요하지만 ` +
        '토큰을 찾을 수 없습니다. api.init({ csrfSelector })를 호출하여 토큰을 초기화하세요.',

    /** @param {string} selector - 토큰 파싱 방법 선택자  */
    CSRF_INIT_NO_TOKEN: (selector) =>
        `${PREFIX} ApiHandler.init(): csrfSelector="${selector}"로 meta 태그를 찾았으나 ` +
        'content 속성이 비어있습니다. 서버가 토큰을 HTML에 올바르게 삽입했는지 확인하세요.',

    // ── DomainPipeline 보상 트랜잭션 ───────────────────────────────────────────
    PIPELINE_ROLLBACK_WARN:
        `${PREFIX} DomainPipeline: 파이프라인 실패로 보상 트랜잭션을 실행합니다. ` +
        '성공한 DomainState 인스턴스를 save() 이전 상태로 복원합니다. ' +
        '서버에 이미 커밋된 데이터는 소비자가 직접 처리해야 합니다.',

    // ── DomainPipeline ─────────────────────────────────────────────────────
    /**  */
    PIPELINE_NOT_CONFIGURED:
        `${PREFIX} DomainState.all(): pipelineFactory가 주입되지 않았습니다. ` +
        'index.js 진입점을 통해 라이브러리를 import하거나, DomainState.configure({ pipelineFactory })를 직접 호출하세요.',

    /** @param {string} key - DomainPipeline 체인에서 사용한 Key 값 */
    PIPELINE_INVALID_KEY: (key) =>
        `${PREFIX} DomainPipeline.after(): "${key}"는 등록되지 않은 리소스 키입니다. ` +
        'DomainState.all()에 전달한 키를 확인하세요.',

    /** @param {string} key - DomainPipeline 체인에서 사용한 Key 값 */
    PIPELINE_HANDLER_TYPE: (key) =>
        `${PREFIX} DomainPipeline.after("${key}"): 핸들러는 함수여야 합니다.`,

    // ── Renderer (플러그인) ────────────────────────────────────────────────
    /** @param {string} id - Form 요소를 렌더링할 컨테이너의 id 속성 문자열 */
    RENDERER_CONTAINER_NOT_FOUND: (id) =>
        `${PREFIX} renderTo(): id="${id}"인 컨테이너 요소를 찾을 수 없습니다.`,

    /** @param {string} type - 렌더링할 Form 요소의 분류값 */
    RENDERER_TYPE_UNKNOWN: (type) =>
        `${PREFIX} renderTo(): 지원하지 않는 type="${type}"입니다. select | radio | checkbox | button 중 하나를 사용하세요.`,

    RENDERER_VALUE_FIELD_MISSING: `${PREFIX} renderTo(): valueField는 필수 옵션입니다.`,

    RENDERER_LABEL_FIELD_MISSING: `${PREFIX} renderTo(): labelField는 필수 옵션입니다.`,

    /** @param {string} key - Array Data의 필드명 */
    RENDERER_DATA_NOT_ARRAY: (key) =>
        `${PREFIX} renderTo(): DomainState.data가 배열이 아닙니다. ` +
        `renderTo()는 배열 형태의 DomainState에서만 사용할 수 있습니다. (key: "${key}")`,
});

/**
 * WARN : console.warn으로 출력되는 경고 메시지 상수
 * @readonly
 * @namespace
 */
export const WARN = Object.freeze({
    // ── URL 충돌 해소 ──────────────────────────────────────────────────────
    /** @param {string} host @param {string} baseURL */
    URL_HOST_IGNORED: (host, baseURL) =>
        `${PREFIX}[경고] host("${host}")를 무시하고 baseURL("${baseURL}")을 우선 사용합니다.`,

    /** @param {string} baseURL @param {string} resolved */
    URL_BASE_PATH_FIXED: (baseURL, resolved) =>
        `${PREFIX}[경고] baseURL("${baseURL}")의 시작이 host와 같아 ` +
        `basePath("${resolved}")로 해석했습니다. 의도대로 동작했다면 다음부터는 basePath를 사용하세요.`,
});

/**
 * DEPRECATED: devWarn으로 출력되는 deprecated 경고 상수
 * 
 * @readonly
 * @namespace
 */
export const DEPRECATED = Object.freeze({
    // ── Deprecated ─────────────────────────────────────────────────────────
    /** @param {string} version @param {string | null} alternative */
    DEPRECATED_TEMPLATE: (version, alternative) =>
        `${PREFIX} ${version}에서 deprecated됩니다. ${alternative}를 사용하세요.`,
    
    /** */
    FORM_BINDER_V1:
        `${PREFIX} FormBinder는 v1.0.0에서 deprecated됩니다.`,

    /** */
    DOMAIN_RENDERER_V1:
        `${PREFIX} DomainRenderer는 v1.0.0에서 deprecated됩니다.`,
});