/**
 * @fileoverview REST API ↔ DomainState 직렬화/역직렬화 매퍼
 *
 * DomainState 내부에서만 사용하는 레이어.
 * 외부 개발자는 직접 import하지 않는다.
 *
 * @module core/api-mapper
 */

import { createProxy } from './api-proxy.js';
import { OP }          from '../constants/op.const.js';


/**
 * toDoamin() : REST API 응답 JSON 문자열을 Proxy 래퍼 객체로 역직렬화한다.
 *
 * @param {string} jsonText - response.text() 결과
 * @returns {{ proxy, getChangeLog, getTarget, clearChangeLog }}
 * @throws {SyntaxError} 유효하지 않은 JSON일 때
 */
export function toDomain(jsonText, onMutate = null) {
    return createProxy(JSON.parse(jsonText), onMutate);
}

/**
 * toPayload() : 원본 객체를 POST / PUT 전송용 JSON 문자열로 직렬화한다.
 *
 * @param {() => object} getTargetFn - createProxy() 반환값의 getTarget
 * @returns {string}
 */
export function toPayload(getTargetFn) {
    return JSON.stringify(getTargetFn());
}

/**
 * toPatch() : 변경 이력을 RFC 6902 JSON Patch 배열로 변환한다.
 *
 * remove 연산은 value를 포함하지 않는다 (RFC 6902 §4.2).
 *
 * @param {() => Array} getChangeLogFn - createProxy() 반환값의 getChangeLog
 * @returns {Array<{op: string, path: string, value?: *}>}
 * @see https://www.rfc-editor.org/rfc/rfc6902
 */
export function toPatch(getChangeLogFn) {
    return getChangeLogFn().map(({ op, path, newValue }) => {
        const patch = { op, path };
        if (op !== OP.REMOVE) patch.value = newValue;
        return patch;
    });
}
