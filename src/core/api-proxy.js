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

    //2026-03-17, 배열 변이 메서드가 실행되는 동안 자잘한 set 트랩을 무시하기 위한 플래그
    let isMuting = false;

    //2026-03-17, 하이재킹할 배열 원본 메서드 목록
    const ARRAY_MUTATIONS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];

    // ── 변경 이력 기록 ──────────────────────────────────────────────────────
    /**
     * @param {string} op
     * @param {string} path
     * @param {*}      oldValue
     * @param {*}      newValue
     */
    function record(op, path, oldValue, newValue) {
        if(isMuting) return; //2026-03-17, 뮤트 상태에서는 개별 기록을 생략한다.

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
                //2026-03-17, 검증 - 값이 완전히 동일하면 (No-op) 무시한다.
                if(target[prop] === value) return true;

                const path   = `${basePath}/${String(prop)}`;
                const hasOwn = Object.prototype.hasOwnProperty.call(target, prop);
                const oldVal = hasOwn ? target[prop] : undefined;
                const op     = hasOwn ? OP.REPLACE : OP.ADD;

                //2026-03-13, 검증 - 배열의 length 변경은 무시
                if(Array.isArray(target) && prop === 'length') {
                    return Reflect.set(target, prop, value, receiver);
                }

                const ok = Reflect.set(target, prop, value, receiver);
                if (ok) record(op, path, oldVal, value);
                return ok;
            },

            /**
             * get 트랩: 중첩 객체에 재귀적으로 Proxy를 씌워 deep tracking 활성화
             * Symbol, toJSON, then, valueOf는 bypass — JSON.stringify/Promise 체인 보존
             * 2026-03-17, 추가 - 배열 메서드 하이재킹하여, 변경 이력 최적화
             */
            get(target, prop, receiver) {
                if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver);

                //2026-03-17, 배열 메서드 하이재킹
                if(Array.isArray(target) && ARRAY_MUTATIONS.includes(prop)) {
                    return (...args) => {
                        const oldArray = [...target]; // 변경 전 배열의 상태 얕은 복사

                        isMuting = true;              // 내부 인덱스 변경에 따른 set 트랩은 무시
                        const result = Array.prototype[prop].apply(target, args); //원본 메서드 실행
                        isMuting = false;             // 인덱스 변경 완료와 함께 뮤트 상태 종료

                        // 메서드 실행이 끝난 후, 배열 전체가 교체된 것으로 단일 로그를 남김
                        // (배열의 부분 패이보다 전체 교체가 백엔드 파싱 및 정합성 유지에 유리함)
                        record(OP.REPLACE, basePath, oldArray, [...target]);

                        return result;
                    }
                }


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
