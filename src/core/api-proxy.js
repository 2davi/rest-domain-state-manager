/**
 * @fileoverview Proxy 기반 도메인 객체 변경 추적 엔진
 *
 * createProxy()는 domainObject를 감싸는 Proxy를 생성하고,
 * set / get / deleteProperty 트랩으로 모든 변경을 자동 기록한다.
 *
 * 반환값 { proxy, getChangeLog, getTarget, clearChangeLog }는
 * DomainState가 "도개교"로 보관한다.
 *
 * changeLog 항목 형태 (RFC 6902 기반):
 *   { op, path, oldValue?, newValue? }
 *
 * @module core/api-proxy
 */

import { shouldBypassDeepProxy, isPlainObject, isArray } from '../common/js-object-util.js';
import { OP }                                             from '../constants/op.const.js';
import { LOG, formatMessage }                             from '../constants/log.messages.js';


/**
 * createProxy() : domainObject를 감싸는 Proxy와 변경 추적 도개교 세트를 생성한다.
 *
 * @param {object} domainObject - Proxy로 감쌀 순수 JS 객체
 * @returns {{
 *   proxy:          object,
 *   getChangeLog:   () => Array<{op: string, path: string, oldValue?: *, newValue?: *}>,
 *   getTarget:      () => object,
 *   clearChangeLog: () => void,
 * }}
 */
export function createProxy(domainObject) {

    // 이 인스턴스 전용 변경 이력 — 클로저로 외부 접근 차단
    const changeLog = [];

    // ── 변경 이력 기록 ──────────────────────────────────────────────────────
    /**
     * @param {string} op
     * @param {string} path
     * @param {*}      oldValue
     * @param {*}      newValue
     */
    function record(op, path, oldValue, newValue) {
        const entry = { op, path };
        if (op !== OP.REMOVE) entry.newValue = newValue;
        if (op !== OP.ADD)    entry.oldValue = oldValue;
        changeLog.push(entry);
        console.debug(formatMessage(LOG.proxy[op], { path, oldValue, newValue }));
    }

    // ── 트랩 핸들러 팩토리 — basePath를 누적해 중첩 경로를 추적 ─────────────
    /**
     * @param {string} basePath - 현재 depth의 경로 prefix
     * @returns {ProxyHandler}
     */
    function makeHandler(basePath) {
        return {

            /**
             * set 트랩: 프로퍼티 추가(add) 또는 교체(replace)
             * Proxy 명세: strict mode에서 false 반환 시 TypeError 발생 → 반드시 boolean 반환
             */
            set(target, prop, value, receiver) {
                const path   = `${basePath}/${String(prop)}`;
                const hasOwn = Object.prototype.hasOwnProperty.call(target, prop);
                const oldVal = hasOwn ? target[prop] : undefined;
                const op     = hasOwn ? OP.REPLACE : OP.ADD;

                const ok = Reflect.set(target, prop, value, receiver);
                if (ok) record(op, path, oldVal, value);
                return ok;
            },

            /**
             * get 트랩: 중첩 객체에 재귀적으로 Proxy를 씌워 deep tracking 활성화
             * Symbol, toJSON, then, valueOf는 bypass — JSON.stringify/Promise 체인 보존
             */
            get(target, prop, receiver) {
                if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver);

                const value = Reflect.get(target, prop, receiver);

                if (isPlainObject(value) || isArray(value)) {
                    const childPath = `${basePath}/${String(prop)}`;
                    console.debug(formatMessage(LOG.proxy.deepProxy, { path: childPath }));
                    return new Proxy(value, makeHandler(childPath));
                }

                return value;
            },

            /**
             * deleteProperty 트랩: 프로퍼티 삭제(remove)
             * 존재하지 않는 키 삭제는 Proxy 명세에 따라 조용히 true 반환
             */
            deleteProperty(target, prop) {
                if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;

                const path   = `${basePath}/${String(prop)}`;
                const oldVal = target[prop];
                const ok     = Reflect.deleteProperty(target, prop);
                if (ok) record(OP.REMOVE, path, oldVal, undefined);
                return ok;
            },
        };
    }

    return {
        /** 변경 추적이 활성화된 Proxy 객체 */
        proxy: new Proxy(domainObject, makeHandler('')),

        /** 현재 변경 이력의 얕은 복사본 반환 (외부 변조 방지) */
        getChangeLog: () => [...changeLog],

        /** 변경이 반영된 원본 객체 반환 */
        getTarget: () => domainObject,

        /** 동기화 성공 후 변경 이력 초기화 */
        clearChangeLog: () => void (changeLog.length = 0),
    };
}
