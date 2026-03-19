/**
 * ERR : throw되는 Error 메시지 상수
 * 함수형 항목은 컨텍스트 값을 받아 완성된 메시지 문자열을 반환한다.
 *
 * @readonly
 * @namespace
 */
export const ERR: Readonly<{
    /** @param {string} host @param {string} baseURL */
    URL_CONFLICT: (host: string, baseURL: string) => string;
    URL_MISSING: "[DSM] URL을 특정할 수 없습니다. save(path) 또는 baseURL/host를 설정하세요.";
    /** @param {string} val */
    PROTOCOL_INVALID: (val: string) => string;
    /** @param {string} method */
    HANDLER_MISSING: (method: string) => string;
    FROM_VO_TYPE: "[DSM] DomainState.fromVO(): DomainVO 인스턴스를 전달해야 합니다.";
    FROM_FORM_TYPE: "[DSM] DomainState.fromForm(): HTMLFormElement 또는 form id 문자열을 전달해야 합니다.";
    /** @param {string} id */
    FORM_NOT_FOUND: (id: string) => string;
    /** @param {string} key */
    VO_SCHEMA_MISSING_KEY: (key: string) => string;
    /** @param {string} key */
    VO_SCHEMA_EXTRA_KEY: (key: string) => string;
    PLUGIN_NO_INSTALL: "[DSM] DomainState.use(): 플러그인은 install(DomainState) 메서드를 가져야 합니다.";
    /** @param {string} key */
    PIPELINE_INVALID_KEY: (key: string) => string;
    /** @param {string} key */
    PIPELINE_HANDLER_TYPE: (key: string) => string;
    /** @param {string} id */
    RENDERER_CONTAINER_NOT_FOUND: (id: string) => string;
    /** @param {string} type */
    RENDERER_TYPE_UNKNOWN: (type: string) => string;
    RENDERER_VALUE_FIELD_MISSING: "[DSM] renderTo(): valueField는 필수 옵션입니다.";
    RENDERER_LABEL_FIELD_MISSING: "[DSM] renderTo(): labelField는 필수 옵션입니다.";
    /** @param {string} key */
    RENDERER_DATA_NOT_ARRAY: (key: string) => string;
}>;
/**
 * WARN : console.warn으로 출력되는 경고 메시지 상수
 * @readonly
 * @namespace
 */
export const WARN: Readonly<{
    /** @param {string} host @param {string} baseURL */
    URL_HOST_IGNORED: (host: string, baseURL: string) => string;
    /** @param {string} baseURL @param {string} resolved */
    URL_BASE_PATH_FIXED: (baseURL: string, resolved: string) => string;
}>;
