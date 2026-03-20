/**
 * REST API ↔ DomainState 직렬화/역직렬화 매퍼
 *
 * `DomainState` 내부 전용 레이어.
 * **외부 개발자는 이 모듈을 직접 import하지 않는다.**
 *
 * ## 역할
 *
 * | 함수           | 방향                             | 호출 시점                         |
 * |---------------|----------------------------------|----------------------------------|
 * | `toDomain()`  | JSON 문자열 → Proxy 래퍼 객체    | `ApiHandler.get()` 응답 수신 후   |
 * | `toPayload()` | 원본 객체 → JSON 문자열          | `DomainState.save()` POST / PUT  |
 * | `toPatch()`   | 변경 이력 → RFC 6902 Patch 배열  | `DomainState.save()` PATCH       |
 *
 * ## 의존성
 * - `createProxy()` — `toDomain()` 내부에서 JSON.parse 결과를 Proxy로 래핑
 * - `OP` — RFC 6902 연산 상수 (`'add'` | `'replace'` | `'remove'`)
 *
 * @module core/api-mapper
 * @see {@link module:core/api-proxy createProxy}
 * @see {@link https://www.rfc-editor.org/rfc/rfc6902 RFC 6902 — JSON Patch}
 */

import { createProxy } from './api-proxy.js';
import { OP }          from '../constants/op.const.js';


// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `toPatch()`가 반환하는 RFC 6902 JSON Patch 단일 연산 항목.
 *
 * `'remove'` 연산은 RFC 6902 §4.2에 따라 `value` 필드를 포함하지 않는다.
 *
 * @typedef {object} JsonPatchOperation
 * @property {'add'|'replace'|'remove'} op    - RFC 6902 연산 종류
 * @property {string}                   path  - JSON Pointer 스타일 경로 (예: `'/name'`, `'/items/0'`)
 * @property {*}                        [value] - 새 값. `op === 'remove'` 시 존재하지 않음.
 */

/**
 * `createProxy()`의 반환값. `toDomain()`이 그대로 반환하는 도개교 세트.
 * 상세 정의는 `api-proxy.js`의 `ProxyWrapper`를 참조한다.
 *
 * @typedef {import('./api-proxy.js').ProxyWrapper} ProxyWrapper
 */

/**
 * `createProxy()`의 `changeLog`에 쌓이는 단일 변경 항목.
 * 상세 정의는 `api-proxy.js`의 `ChangeLogEntry`를 참조한다.
 *
 * @typedef {import('./api-proxy.js').ChangeLogEntry} ChangeLogEntry
 */

/**
 * `DomainState._broadcast()`에서 `broadcastUpdate()`로 전달하는 콜백.
 * `toDomain()` / `createProxy()` 에 주입되어 Proxy 변경 시마다 실행된다.
 *
 * @typedef {import('./api-proxy.js').OnMutateCallback} OnMutateCallback
 */


// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * REST API GET 응답 JSON 문자열을 Proxy 래퍼 객체(도개교 세트)로 역직렬화한다.
 *
 * 내부 처리 흐름:
 * ```
 * jsonText (string)
 *   ↓ JSON.parse()
 * 순수 JS 객체 (object)
 *   ↓ createProxy(parsedObject, onMutate)
 * ProxyWrapper { proxy, getChangeLog, getTarget, clearChangeLog }
 * ```
 *
 * `onMutate` 콜백은 `DomainState.fromJSON()` / `fromVO()`에서 클로저 패턴으로 주입된다.
 * Proxy 변경이 발생할 때마다 콜백이 실행되어 디버그 채널에 상태를 실시간 전파한다.
 *
 * @param {string}               jsonText           - `response.text()`로 읽은 GET 응답 JSON 문자열
 * @param {OnMutateCallback|null} [onMutate=null]   - Proxy 변경 시 호출되는 콜백. 기본값 `null`.
 * @returns {ProxyWrapper} Proxy 래퍼 도개교 세트 (`proxy`, `getChangeLog`, `getTarget`, `clearChangeLog`)
 * @throws {SyntaxError} `jsonText`가 유효하지 않은 JSON 문자열일 때
 *
 * @example <caption>ApiHandler.get() 내부에서의 사용 흐름</caption>
 * // ApiHandler.get() → this._fetch() → response.text() → DomainState.fromJSON(text, ...)
 * // DomainState.fromJSON() 내부:
 * const wrapper = toDomain(jsonText, () => {
 *     if (state?._debug) state._broadcast();
 * });
 * // wrapper.proxy → DomainState.data 로 노출됨
 *
 * @example <caption>직접 사용 (내부 전용이나 참고용)</caption>
 * const wrapper = toDomain('{"name":"Davi","age":30}');
 * wrapper.proxy.name = 'Lee'; // changeLog: [{ op: 'replace', path: '/name', ... }]
 * console.log(wrapper.getChangeLog());
 */
export function toDomain(jsonText, onMutate = null) {
    return createProxy(JSON.parse(jsonText), onMutate);
}

/**
 * 원본 객체를 POST / PUT 전송용 JSON 문자열로 직렬화한다.
 *
 * `getTargetFn`을 호출하여 Proxy가 아닌 **원본 객체**를 가져온 뒤
 * `JSON.stringify()`로 직렬화한다. Proxy 자체를 직렬화하면 정상 동작하지 않는다.
 *
 * ## 호출 시점
 * - `DomainState.save()` 에서 `isNew === true`                 → POST
 * - `DomainState.save()` 에서 `dirtyFields.size === 0`         → PUT (변경 없는 의도적 재저장)
 * - `DomainState.save()` 에서 `dirtyRatio >= DIRTY_THRESHOLD`  → PUT (변경 비율 70% 이상)
 *
 * @param {() => object} getTargetFn
 *   `createProxy()`의 반환값에서 꺼낸 `getTarget` 함수.
 *   호출 시 변경이 누적된 원본 객체를 반환한다.
 * @returns {string} `Content-Type: application/json` 요청 body로 사용 가능한 JSON 문자열
 *
 * @example <caption>DomainState.save() POST 분기에서의 호출</caption>
 * // DomainState 내부:
 * await this._handler._fetch(url, {
 *     method: 'POST',
 *     body:   toPayload(this._getTarget),
 * });
 *
 * @example <caption>직렬화 결과</caption>
 * const { getTarget } = createProxy({ name: 'Davi', address: { city: 'Seoul' } });
 * toPayload(getTarget); // → '{"name":"Davi","address":{"city":"Seoul"}}'
 */
export function toPayload(getTargetFn) {
    return JSON.stringify(getTargetFn());
}

/**
 * `changeLog` 배열을 RFC 6902 JSON Patch 연산 배열로 변환한다.
 *
 * `getChangeLogFn()`을 호출하여 내부 변경 이력을 읽고,
 * 각 항목의 `newValue`를 RFC 6902 `value` 필드로 매핑한다.
 *
 * ## RFC 6902 §4.2 — remove 연산
 * `'remove'` 연산 항목은 `value` 필드를 포함하지 **않는다**.
 * 내부 `changeLog`의 `newValue`는 `'remove'`일 때 존재하지 않지만,
 * 명시적으로 `if (op !== OP.REMOVE)` 조건으로 필드 포함 여부를 제어한다.
 *
 * ## 내부 포맷 → RFC 6902 변환 규칙
 *
 * | changeLog `op` | RFC 6902 `op` | `value` 필드      |
 * |---------------|--------------|-------------------|
 * | `'add'`       | `'add'`      | `newValue` 사용   |
 * | `'replace'`   | `'replace'`  | `newValue` 사용   |
 * | `'remove'`    | `'remove'`   | 포함하지 않음     |
 *
 * ## 호출 시점
 * - `DomainState.save()` 에서 `changeLog.length > 0` → PATCH
 *
 * @param {() => ChangeLogEntry[]} getChangeLogFn
 *   `createProxy()`의 반환값에서 꺼낸 `getChangeLog` 함수.
 *   호출 시 현재 변경 이력의 얕은 복사본을 반환한다.
 * @returns {JsonPatchOperation[]} RFC 6902 JSON Patch 연산 배열
 *   `Content-Type: application/json-patch+json` 요청 body로 사용 가능.
 * @see {@link https://www.rfc-editor.org/rfc/rfc6902 RFC 6902 — JavaScript Object Notation (JSON) Patch}
 *
 * @example <caption>DomainState.save() PATCH 분기에서의 호출</caption>
 * // DomainState 내부:
 * await this._handler._fetch(url, {
 *     method: 'PATCH',
 *     body:   JSON.stringify(toPatch(this._getChangeLog)),
 * });
 *
 * @example <caption>변환 결과</caption>
 * // changeLog:
 * // [
 * //   { op: 'replace', path: '/name',    newValue: 'Davi', oldValue: 'Lee' },
 * //   { op: 'add',     path: '/phone',   newValue: '010-0000-0000' },
 * //   { op: 'remove',  path: '/address', oldValue: { city: 'Seoul' } },
 * // ]
 * toPatch(getChangeLog);
 * // → [
 * //   { op: 'replace', path: '/name',  value: 'Davi' },
 * //   { op: 'add',     path: '/phone', value: '010-0000-0000' },
 * //   { op: 'remove',  path: '/address' },   // value 없음
 * // ]
 */
export function toPatch(getChangeLogFn) {
    return getChangeLogFn().map(({ op, path, newValue }) => {
        /** @type {JsonPatchOperation} */
        const patch = { op, path };
        if (op !== OP.REMOVE) patch.value = newValue;
        return patch;
    });
}
