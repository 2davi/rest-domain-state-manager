/**
 * formatMessage() : 로그 메시지 템플릿의 {placeholder}를 실제 값으로 치환한다.
 *
 * - 객체/배열 값은 JSON.stringify()로 변환
 * - undefined/null은 문자열로 변환
 * - 치환 키가 없으면 {key} 원문 유지
 *
 * @param {string} template - LOG 내 템플릿 문자열
 * @param {Record<string, *>} values - {키: 값} 치환 쌍
 * @returns {string} 치환 완료된 메시지 문자열
 *
 * @example
 * formatMessage(LOG.proxy[OP.REPLACE], { path: '/name', oldValue: 'A', newValue: 'B' });
 * // → '[DSM][Proxy][replace] path: /name | oldValue: A → B'
 */
export function formatMessage(template: string, values?: Record<string, any>): string;
/**
 * LOG : 내부 동작 로그 메시지 템플릿 상수
 * @readonly
 * @namespace
 */
export const LOG: Readonly<{
    proxy: Readonly<{
        /** Proxy set 트랩 — add / replace / remove 공통 */
        add: "[DSM][Proxy][add]     path: {path} | newValue: {newValue}";
        replace: "[DSM][Proxy][replace] path: {path} | oldValue: {oldValue} → {newValue}";
        remove: "[DSM][Proxy][remove]  path: {path} | oldValue: {oldValue}";
        /** get 트랩 — deep proxy 진입 */
        deepProxy: "[DSM][Proxy][get]     deep proxy 진입 | path: {path}";
    }>;
    url: Readonly<{
        resolved: "[DSM][URL] 최종 URL → {url}";
        hostIgnored: "[DSM][URL] host 무시, baseURL 우선 → {url}";
        basePathFixed: "[DSM][URL] baseURL → basePath 해석 | basePath: {basePath}";
    }>;
    pipeline: Readonly<{
        fetchStart: "[DSM][Pipeline] 병렬 fetch 시작 | keys: {keys}";
        fetchDone: "[DSM][Pipeline] 병렬 fetch 완료";
        afterStart: "[DSM][Pipeline] after 핸들러 실행 | key: {key}";
        afterDone: "[DSM][Pipeline] after 핸들러 완료 | key: {key}";
        afterError: "[DSM][Pipeline] after 핸들러 실패 | key: {key} | error: {error}";
    }>;
}>;
