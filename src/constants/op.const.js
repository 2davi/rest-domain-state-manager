/**
 * RFC 6902 JSON Patch 연산(op) 상수
 *
 * Proxy 트랩의 변경 이력 기록 및 toPatch() 직렬화에서 공통으로 사용한다.
 *
 * @module constants/op.const
 * @see https://www.rfc-editor.org/rfc/rfc6902
 */

/**
 * OP : JSON Patch 연산 유형 상수
 * @readonly
 * @enum {string}
 */
export const OP = Object.freeze({
    /** 프로퍼티 신규 추가 */
    ADD:     'add',
    /** 기존 프로퍼티 값 교체 */
    REPLACE: 'replace',
    /** 프로퍼티 삭제 */
    REMOVE:  'remove',
});
