/**
 * @fileoverview Proxy 기반 도메인 객체 변경 추적 엔진
 *
 * createProxy()는 domainObject를 감싸는 Proxy를 생성하고,
 * set / get / deleteProperty 트랩으로 모든 변경을 자동 기록한다.
 *
 * [refactor/core-engine (2026-03-18)]
 * 1. WewkMap을 이용한 Lazy Proxying 캐싱으로 V8 GC 부하 완화
 * 2. 트랩 내부의 모든 속성 접근을 Reflect API로 전면 교체하여 컨텍스트 소실 원천 차단
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

    // [refactor/core-engine(2026-03-18)] WeakMap Cache 도입
    // 중첩 객체에 접근할 때마다(get 트랩의 deeper proxy) Proxy를 무한정 생성하던 기존 로직을 개선.
    // 원본 객체를 키(Key)로 삼아 Proxy를 캐싱해두면, 객체가 사라질 때 Proxy도 같이 GC의 대상이 된다.
    const proxyCache = new WeakMap();

    //2026-03-17, 배열 변이 메서드가 실행되는 동안 자잘한 set 트랩을 무시하기 위한 플래그와, 하이재킹할 배열 원본 메서드 목록
    let isMuting = false;

    //[refactor/array-patch-optimization(2026-03-18)] 배열 변이 최적화를 위한 메서드 구분
    // const ARRAY_MUTATIONS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
    const O1_MUTATIONS = ['push', 'pop'];
    const ON_MUTATIONS = ['shift', 'unshift', 'splice', 'sort', 'reverse'];

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
                //[refactor/core-engine(2026-03-18)] target[prop] 쌩접근 방지 -> Reflect.get으로 우아하게
                const currentValue = Reflect.get(target, prop, receiver);

                //2026-03-17, 검증 - 값이 완전히 동일하면 (No-op) 무시한다.
                if(currentValue === value) return true;

                const path     = `${basePath}/${String(prop)}`;
                const hasOwn   = Object.prototype.hasOwnProperty.call(target, prop);
                const oldValue = hasOwn ? currentValue : undefined;
                const op       = hasOwn ? OP.REPLACE : OP.ADD;

                //2026-03-13, 검증 - 배열의 length 변경은 무시
                if(Array.isArray(target) && prop === 'length') {
                    return Reflect.set(target, prop, value, receiver);
                }

                const ok = Reflect.set(target, prop, value, receiver);
                if (ok) record(op, path, oldValue, value);
                return ok;
            },

            /**
             * get 트랩: 중첩 객체에 재귀적으로 Proxy를 씌워 deep tracking 활성화
             * Symbol, toJSON, then, valueOf는 bypass — JSON.stringify/Promise 체인 보존
             * 2026-03-17, 추가 - 배열 메서드 하이재킹하여, 변경 이력 최적화
             */
            get(target, prop, receiver) {
                if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver);

                //[refactor/array-patch-optimization(2026-03-18)] 배열 메서드에 따른 하이재킹 분기
                //[refactor/array-patch-optimization(2026-03-18)] O(1)Group: 가로채지 않는다.
                if(Array.isArray(target) && O1_MUTATIONS.includes(prop)) {
                    /* nothing */
                }


                
                //[refactor/array-patch-optimization(2026-03-18)] O(N)Group: 래퍼 함수를 반환한다.
                if(Array.isArray(target) && ON_MUTATIONS.includes(prop)) {
                    return (...args) => {
                        // 원본 배열 상태 저장 (삭제한 값 수정용)
                        const oldArray = [...target];

                        // V8 렌더링 폭주를 막기 위한 Proxy set 트랩 뮤트
                        isMuting = true;
                        const result = Array.prototype[prop].apply(target, args);
                        isMuting = false;

                        //[refactor/array-patch-optimization(2026-03-18)] 호출된 메서드에 따라 정확한 Delta 로그만 남기도록 분기
                        switch(prop) {
                            case 'shift':
                                record(OP.REMOVE, `${basePath}/0`, oldArray[0], undefined);
                                break;
                            case 'unshift':
                                args.forEach((el, idx) => {
                                    record(OP.ADD, `${basePath}/${idx}`, undefined, el);
                                });
                                break;
                            case 'splice':
                                // args[0]: 시작 인덱스, args[1]: 삭제할 개수, args[2~]: 추가할 아이템들
                                // 시작 인덱스 보정: 음수일 경우 배열 끝에서부터 계산
                                const startIdx = args[0] < 0
                                      ? Math.max(oldArray.length + args[0], 0)
                                      : Math.min(args[0], oldArray.length);

                                // 1. 삭제(REMOVE) 처리
                                // result 배열에는 삭제된 요소들이 담겨 있다.
                                // JSON Patch에서 요소를 삭제하면 배열의 인덱스가 줄어드므로,
                                // 동일한 시작 인덱스 `startIdx`를 향해 연속으로 REMOVE를 날려주면 된다.
                                result.forEach( deletedItem => {
                                    record(OP.REMOVE, `${basePath}/${startIdx}`, deletedItem, undefined);
                                });
                                // 2. 추가(ADD) 처리
                                // args의 3번째 인자부터가 새로 추가할 아이템들이다.
                                const addedItems = args.slice(2);
                                addedItems.forEach((addedItems, idx) => {
                                    record(OP.ADD, `${basePath}/${startIdx + idx}`, undefined, addedItem);
                                });
                                break;
                            case 'sort':
                            case 'reverse':
                                record(OP.REPLACE, basePath, oldArray, [...target]);
                                break;
                            
                        }


                        // 메서드 실행이 끝난 후, 배열 전체가 교체된 것으로 단일 로그를 남김
                        // (배열의 부분 패이보다 전체 교체가 백엔드 파싱 및 정합성 유지에 유리함)
                        //record(OP.REPLACE, basePath, oldArray, [...target]);

                        return result;
                    }
                }


                const value = Reflect.get(target, prop, receiver);

                if (isPlainObject(value) || isArray(value)) {
                    //[refactor/core-engine(2026-03-18)] Lazy Proxying & WeakMap 캐싱 적용
                    if(proxyCache.has(value)) {
                        return proxyCache.get(value); // 이미 Proxy로 씌워둔 놈은 그대로 반환
                    }

                    const childPath = `${basePath}/${String(prop)}`;
                    console.debug(formatMessage(LOG.proxy.deepProxy, { path: childPath }));

                    //[refactor/core-engine(2026-03-18)] 새로 만든 Proxy 놈은 캐시에 등록
                    const childProxy = new Proxy(value, makeHandler(childPath));
                    proxyCache.set(value, childProxy);
                    return childProxy;
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
                //[refactor/core-engine(2026-03-18)] 삭제 과정에서 값을 읽을 때도 Reflect API로 교체
                const oldVal = Reflect.get(target, prop);
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
