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

    URL_MISSING:
        `${PREFIX} URL을 특정할 수 없습니다. save(path) 또는 baseURL/host를 설정하세요.`,

    /** @param {string} val */
    PROTOCOL_INVALID: (val) =>
        `${PREFIX} 유효하지 않은 protocol 값: "${val}". HTTP | HTTPS | FILE | SSH 중 하나를 사용하세요.`,

    // ── DomainState 팩토리 ─────────────────────────────────────────────────
    /** @param {string} method */
    HANDLER_MISSING: (method) =>
        `${PREFIX} DomainState.${method}(): ApiHandler가 주입되지 않았습니다. ` +
        'fromJSON / fromForm / fromVO의 두 번째 인자로 api를 전달하세요.',

    FROM_VO_TYPE:
        `${PREFIX} DomainState.fromVO(): DomainVO 인스턴스를 전달해야 합니다.`,

    FROM_FORM_TYPE:
        `${PREFIX} DomainState.fromForm(): HTMLFormElement 또는 form id 문자열을 전달해야 합니다.`,

    /** @param {string} id */
    FORM_NOT_FOUND: (id) =>
        `${PREFIX} DomainState.fromForm(): id="${id}"인 form 요소를 찾을 수 없습니다.`,

    // ── DomainVO 정합성 ────────────────────────────────────────────────────
    /** @param {string} key */
    VO_SCHEMA_MISSING_KEY: (key) =>
        `${PREFIX} DomainVO 정합성 오류: 응답 데이터에 VO 스키마의 "${key}" 필드가 없습니다.`,

    /** @param {string} key */
    VO_SCHEMA_EXTRA_KEY: (key) =>
        `${PREFIX} DomainVO 정합성 경고: 응답 데이터에 VO 스키마에 없는 "${key}" 필드가 포함되어 있습니다.`,

    // ── 플러그인 ───────────────────────────────────────────────────────────
    PLUGIN_NO_INSTALL:
        `${PREFIX} DomainState.use(): 플러그인은 install(DomainState) 메서드를 가져야 합니다.`,

    // ── DomainPipeline ─────────────────────────────────────────────────────
    /** @param {string} key */
    PIPELINE_INVALID_KEY: (key) =>
        `${PREFIX} DomainPipeline.after(): "${key}"는 등록되지 않은 리소스 키입니다. ` +
        'DomainState.all()에 전달한 키를 확인하세요.',

    /** @param {string} key */
    PIPELINE_HANDLER_TYPE: (key) =>
        `${PREFIX} DomainPipeline.after("${key}"): 핸들러는 함수여야 합니다.`,

    // ── Renderer (플러그인) ────────────────────────────────────────────────
    /** @param {string} id */
    RENDERER_CONTAINER_NOT_FOUND: (id) =>
        `${PREFIX} renderTo(): id="${id}"인 컨테이너 요소를 찾을 수 없습니다.`,

    /** @param {string} type */
    RENDERER_TYPE_UNKNOWN: (type) =>
        `${PREFIX} renderTo(): 지원하지 않는 type="${type}"입니다. select | radio | checkbox | button 중 하나를 사용하세요.`,

    RENDERER_VALUE_FIELD_MISSING:
        `${PREFIX} renderTo(): valueField는 필수 옵션입니다.`,

    RENDERER_LABEL_FIELD_MISSING:
        `${PREFIX} renderTo(): labelField는 필수 옵션입니다.`,

    /** @param {string} key */
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
