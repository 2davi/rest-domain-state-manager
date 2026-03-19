/**
 * Proxy 기반 도메인 객체 변경 추적 엔진
 *
 * `createProxy()`는 순수 JS 객체를 ES6 `Proxy`로 감싸
 * `set` / `get` / `deleteProperty` 트랩으로 모든 필드 변경을 자동으로 기록한다.
 *
 * ## 주요 설계 원칙
 *
 * ### 1. Lazy Proxying & WeakMap 캐싱 (refactor/core-engine, 2026-03-18)
 * 중첩 객체에 접근할 때마다 새 `Proxy`를 생성하면 V8 GC에 막대한 부하를 준다.
 * `proxyCache(WeakMap)`을 사용해 동일한 원본 객체에 대한 `Proxy`를 캐싱하고,
 * 원본 객체가 GC 대상이 될 때 `Proxy`도 함께 수거된다.
 *
 * ### 2. Reflect API 전면 적용 (refactor/core-engine, 2026-03-18)
 * 트랩 내부의 모든 속성 접근을 `target[prop]` 직접 접근 대신
 * `Reflect.get / Reflect.set / Reflect.deleteProperty`로 처리하여
 * 프로토타입 체인과 `this` 바인딩이 복잡한 객체에서의 컨텍스트 소실을 방지한다.
 *
 * ### 3. 배열 변이 메서드 Delta 최적화 (refactor/array-patch-optimization, 2026-03-18)
 * `ON_MUTATIONS`(`shift`, `unshift`, `splice`, `sort`, `reverse`) 호출 시
 * set 트랩을 뮤트(mute)하고 변경된 인덱스 범위만 수학적으로 계산하여
 * 정확한 RFC 6902 JSON Patch 연산(`ADD` / `REMOVE` / `REPLACE`)으로 기록한다.
 *
 * ## 반환값 — "도개교(Drawbridge)" 세트
 * `{ proxy, getChangeLog, getTarget, clearChangeLog }` 네 클로저를
 * `DomainState`가 보관하며, 외부에는 `proxy`만 공개된다.
 *
 * ## changeLog 항목 구조 (RFC 6902 기반)
 * ```
 * { op: 'add'|'replace'|'remove', path: '/field/0', oldValue?, newValue? }
 * ```
 *
 * @module core/api-proxy
 * @see {@link https://www.rfc-editor.org/rfc/rfc6902 RFC 6902 — JSON Patch}
 * @see {@link https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Proxy MDN — Proxy}
 */

import { shouldBypassDeepProxy, isPlainObject, isArray } from '../common/js-object-util.js';
import { OP }                                             from '../constants/op.const.js';
import { LOG, formatMessage }                             from '../constants/log.messages.js';


// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * RFC 6902 JSON Patch 연산 하나를 나타내는 변경 이력 항목.
 *
 * - `op: 'add'`    : 기존에 없던 경로에 값이 추가됨. `oldValue` 없음.
 * - `op: 'replace'`: 기존 경로의 값이 교체됨. `oldValue` / `newValue` 모두 있음.
 * - `op: 'remove'` : 기존 경로의 값이 삭제됨. `newValue` 없음.
 *
 * @typedef {object} ChangeLogEntry
 * @property {'add'|'replace'|'remove'} op        - RFC 6902 연산 종류
 * @property {string}                   path      - JSON Pointer 스타일 경로 (예: `/address/city`, `/items/0`)
 * @property {*}                        [newValue] - 새 값. `op: 'remove'` 시 존재하지 않음.
 * @property {*}                        [oldValue] - 이전 값. `op: 'add'` 시 존재하지 않음.
 */

/**
 * `createProxy()`의 반환값. DomainState가 "도개교"로 보관하는 클로저 세트.
 *
 * 외부 개발자에게 공개되는 것은 `proxy` 뿐이며,
 * 나머지 세 함수는 `DomainState` 내부에서만 호출된다.
 *
 * @typedef {object} ProxyWrapper
 * @property {object}                        proxy          - 변경 추적이 활성화된 Proxy 객체. 유일한 외부 진입점.
 * @property {() => ChangeLogEntry[]}        getChangeLog   - 현재 변경 이력의 얕은 복사본을 반환한다. 외부 변조 방지.
 * @property {() => object}                  getTarget      - 변경이 누적된 원본 객체를 반환한다.
 * @property {() => void}                    clearChangeLog - 동기화 성공 후 변경 이력 전체를 초기화한다.
 */

/**
 * Proxy의 `set` / `deleteProperty` 트랩이 변경을 기록할 때마다 호출되는 콜백.
 * `DomainState._broadcast()`를 통해 디버그 채널에 실시간으로 상태를 전파하는 데 사용된다.
 *
 * @callback OnMutateCallback
 * @returns {void}
 */

/**
 * `ON_MUTATIONS` 래퍼 함수 내부에서 `Array.prototype[method]`를 호출한 결과 타입.
 * 메서드마다 반환 타입이 다르기 때문에 `unknown`으로 정의한다.
 *
 * @typedef {unknown} ArrayMutationResult
 */




// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 순수 JS 객체를 Proxy로 감싸 변경 추적 엔진을 생성하고 "도개교" 세트를 반환한다.
 *
 * ## 동작 흐름
 *
 * ```
 * createProxy(obj)
 *   ├─ changeLog[]      클로저 — 변경 이력 저장소
 *   ├─ proxyCache       WeakMap — 중첩 Proxy 캐시 (Lazy Proxying)
 *   ├─ isMuting         boolean — 배열 변이 중 set 트랩 무시 플래그
 *   ├─ record()         변경 이력 기록 내부 함수
 *   ├─ makeHandler()    트랩 핸들러 팩토리 (basePath 누적)
 *   └─ return ProxyWrapper
 *        ├─ proxy         new Proxy(obj, makeHandler(''))
 *        ├─ getChangeLog  () => [...changeLog]
 *        ├─ getTarget     () => obj
 *        └─ clearChangeLog () => void (changeLog.length = 0)
 * ```
 *
 * ## WeakMap 캐싱 전략
 * `get` 트랩에서 중첩 객체/배열을 반환할 때, 이미 Proxy로 감싼 적 있으면
 * `proxyCache`에서 즉시 반환한다. 원본 객체가 사라지면 `WeakMap` 특성상
 * 연관된 Proxy도 GC 대상이 되어 메모리 누수가 발생하지 않는다.
 *
 * ## 배열 변이 추적 전략
 * `ON_MUTATIONS`(`shift`, `unshift`, `splice`, `sort`, `reverse`) 메서드는
 * 래퍼 함수로 가로채어 `isMuting = true`로 set 트랩을 일시 비활성화한 뒤
 * 원본 메서드를 실행하고, 이후 변경된 범위만 정밀하게 `record()`한다.
 * `push`/`pop`은 set 트랩의 자연스러운 동작으로 충분하므로 래핑하지 않는다.
 *
 * @param {object}               domainObject - Proxy로 감쌀 순수 JS 객체 또는 배열
 * @param {OnMutateCallback|null} [onMutate]  - 변경 기록 직후 호출되는 콜백. 기본값 `null`.
 * @returns {ProxyWrapper} 도개교 세트 — proxy, getChangeLog, getTarget, clearChangeLog
 *
 * @example <caption>기본 사용</caption>
 * const { proxy, getChangeLog, clearChangeLog } = createProxy({ name: 'Davi', age: 0 });
 * proxy.name = 'Lee';        // op: 'replace', path: '/name'
 * proxy.phone = '010-0000';  // op: 'add',     path: '/phone'
 * delete proxy.age;          // op: 'remove',  path: '/age'
 * console.log(getChangeLog()); // [{ op, path, ... }, ...]
 *
 * @example <caption>onMutate 콜백으로 디버그 채널 연동</caption>
 * let state = null;
 * const wrapper = createProxy(skeleton, () => {
 *     if (state?._debug) state._broadcast();
 * });
 * state = new DomainState(wrapper, { ... });
 *
 * @example <caption>중첩 객체 추적</caption>
 * const { proxy } = createProxy({ address: { city: 'Seoul', zip: '' } });
 * proxy.address.city = 'Busan'; // op: 'replace', path: '/address/city'
 *
 * @example <caption>배열 변이 추적</caption>
 * const { proxy, getChangeLog } = createProxy({ items: ['A', 'B', 'C'] });
 * proxy.items.splice(1, 1, 'X', 'Y');
 * // changeLog: [REMOVE /items/1, ADD /items/1, ADD /items/2]
 */
export function createProxy(domainObject, onMutate = null) {

    // ── 클로저 — 이 인스턴스 전용 변경 이력. 외부에서는 getChangeLog()로만 접근 ──
    /** @type {ChangeLogEntry[]} */
    const changeLog = [];

    // ── WeakMap 캐시 — 중첩 객체를 Proxy로 재감쌀 때 중복 생성 방지 ──────────
    // 키: 원본 객체(참조), 값: 해당 객체를 감싼 Proxy
    // WeakMap 특성상 키(원본 객체)가 참조되지 않으면 값(Proxy)도 자동 GC 대상
    /** @type {WeakMap<object, object>} */
    const proxyCache = new WeakMap();

    // ── 배열 변이 중 set 트랩 무시 플래그 ─────────────────────────────────────
    // ON_MUTATIONS 래퍼 실행 중 배열 내부 인덱스/length 변경이 set 트랩에 의해
    // 중복 기록되지 않도록 차단한다.
    /** @type {boolean} */
    let isMuting = false;

    // ── O(N) 배열 변이 메서드 목록 ─────────────────────────────────────────────
    // 이 메서드들은 get 트랩에서 가로채어 래퍼 함수로 교체된다.
    // push/pop(O(1))은 set 트랩의 자연스러운 동작으로 정확히 추적되므로 포함하지 않는다.
    /** @type {ReadonlyArray<string>} */
    const ON_MUTATIONS = ['shift', 'unshift', 'splice', 'sort', 'reverse'];


    // ════════════════════════════════════════════════════════════════════════════
    // 내부 함수
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 변경 이력 항목을 `changeLog`에 기록하고 `onMutate` 콜백을 호출한다.
     *
     * `isMuting === true`이면 기록을 건너뛴다.
     * RFC 6902 규칙에 따라:
     * - `op === 'remove'` : `newValue` 미포함
     * - `op === 'add'`    : `oldValue` 미포함
     *
     * @param {'add'|'replace'|'remove'} op       - RFC 6902 연산 종류
     * @param {string}                   path     - JSON Pointer 스타일 경로
     * @param {*}                        oldValue - 변경 이전 값 (`op: 'add'` 시 무시됨)
     * @param {*}                        newValue - 변경 이후 값 (`op: 'remove'` 시 무시됨)
     * @returns {void}
     */
    function record(op, path, oldValue, newValue) {
        if(isMuting) return;

        /** @type {ChangeLogEntry} */
        const entry = { op, path };
        if (op !== OP.REMOVE) entry.newValue = newValue;
        if (op !== OP.ADD)    entry.oldValue = oldValue;
        changeLog.push(entry);
        console.debug(formatMessage(LOG.proxy[op], { path, oldValue, newValue }));

        if(onMutate) onMutate();
    }

    /**
     * 경로(basePath)가 누적된 Proxy 트랩 핸들러 객체를 생성한다.
     *
     * 중첩 객체에 접근할 때마다 `makeHandler(childPath)`를 재귀 호출하여
     * 각 레이어에 올바른 경로 prefix가 전파되도록 한다.
     *
     * ## 트랩 구성
     * - `set`            : 프로퍼티 추가(`add`) 또는 교체(`replace`) 기록
     * - `get`            : 중첩 객체/배열에 deep proxy 적용; `ON_MUTATIONS` 하이재킹
     * - `deleteProperty` : 프로퍼티 삭제(`remove`) 기록
     *
     * @param {string} basePath - 현재 depth의 JSON Pointer 경로 prefix (루트는 `''`)
     * @returns {ProxyHandler<object>} Proxy 생성자에 넘길 핸들러 객체
     */
    function makeHandler(basePath) {
        return {

            /**
             * `set` 트랩 — 프로퍼티 신규 추가(`add`) 또는 값 교체(`replace`)를 기록한다.
             *
             * ## 처리 순서
             * 1. `Reflect.get`으로 현재 값을 읽어 No-op 여부를 판단한다.
             * 2. 완전히 동일한 값이면(`===`) 기록 없이 `true`를 반환한다.
             * 3. 배열의 `length` 변경은 `ON_MUTATIONS` 래퍼가 이미 제어하므로 추적하지 않는다.
             * 4. `Reflect.set`으로 실제 값을 반영한 뒤 `record()`한다.
             *
             * Proxy 명세: strict mode에서 `false`를 반환하면 `TypeError`가 발생하므로
             * 성공 여부와 무관하게 반드시 `boolean`을 반환해야 한다.
             *
             * @param {object}          target   - Proxy가 감싸고 있는 원본 객체
             * @param {string | symbol} prop     - 설정하려는 프로퍼티 키
             * @param {*}               value    - 설정할 새 값
             * @param {object}          receiver - 원본 Proxy 또는 상속 객체
             * @returns {boolean} `Reflect.set`의 성공 여부
             */
            set(target, prop, value, receiver) {
                const currentValue = Reflect.get(target, prop, receiver);

                // No-op: 값이 완전히 동일하면 changeLog에 기록하지 않는다
                if(currentValue === value) return true;

                const path     = `${basePath}/${String(prop)}`;
                const hasOwn   = Object.prototype.hasOwnProperty.call(target, prop);
                const oldValue = hasOwn ? currentValue : undefined;
                const op       = hasOwn ? OP.REPLACE : OP.ADD;

                // 배열의 length 변경은 ON_MUTATIONS 래퍼가 별도로 제어하므로 무시
                if(Array.isArray(target) && prop === 'length') {
                    return Reflect.set(target, prop, value, receiver);
                }

                const ok = Reflect.set(target, prop, value, receiver);
                if (ok) record(op, path, oldValue, value);
                return ok;
            },

            /**
             * `get` 트랩 — deep proxy 적용 및 `ON_MUTATIONS` 배열 메서드 하이재킹.
             *
             * ## 처리 순서
             * 1. `shouldBypassDeepProxy(prop)`이 `true`이면 그대로 반환한다.
             *    (Symbol 프로퍼티, `toJSON`, `then`, `valueOf` — JSON.stringify/Promise 호환성 보존)
             * 2. 배열 대상 `ON_MUTATIONS` 메서드이면 래퍼 함수를 반환한다.
             *    래퍼는 `isMuting`으로 set 트랩을 차단한 뒤 원본 메서드를 실행하고,
             *    메서드별 정확한 Delta 로그를 `record()`에 기록한다.
             * 3. 반환값이 plain object 또는 배열이면:
             *    - `proxyCache`에 캐시된 Proxy가 있으면 그것을 반환한다 (Lazy Proxying).
             *    - 없으면 새 Proxy를 생성해 캐시에 등록한 뒤 반환한다.
             * 4. 나머지(원시값, 함수 등)는 `Reflect.get` 결과를 그대로 반환한다.
             *
             * @param {object}          target   - Proxy가 감싸고 있는 원본 객체
             * @param {string | symbol} prop     - 접근하려는 프로퍼티 키
             * @param {object}          receiver - 원본 Proxy 또는 상속 객체
             * @returns {*} 프로퍼티 값 또는 deep proxy 또는 배열 메서드 래퍼 함수
             */
            get(target, prop, receiver) {
                // bypass: Symbol, toJSON, then, valueOf — 직렬화·Promise 체인 보존
                if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver);

                // ON_MUTATIONS 하이재킹: O(N) 배열 변이 메서드를 래퍼로 교체한다
                if(Array.isArray(target) && ON_MUTATIONS.includes(/** @type {string} */ (prop))) {
                    /**
                     * 배열 변이 메서드 래퍼 함수.
                     *
                     * 1. 실행 전 `oldArray`를 스냅샷으로 저장한다.
                     * 2. `isMuting = true`로 set 트랩을 비활성화한다.
                     * 3. 원본 메서드를 `Array.prototype[prop].apply(target, args)`로 실행한다.
                     * 4. `isMuting = false`로 복원한다.
                     * 5. 메서드별 Delta 로그를 `record()`에 기록한다.
                     *
                     * ### 메서드별 Delta 로그 전략
                     * - `shift`   : 제거된 첫 번째 요소를 `REMOVE /0`으로 기록
                     * - `unshift` : 추가된 각 요소를 선두 인덱스부터 `ADD /idx`로 기록
                     * - `splice`  : 삭제 요소를 `startIdx` 기준 `REMOVE`로, 추가 요소를 `ADD`로 기록
                     * - `sort`, `reverse` : 배열 전체를 `REPLACE basePath`로 기록
                     *
                     * @param {...*} args - 원본 배열 메서드에 전달할 인자
                     * @returns {ArrayMutationResult} 원본 메서드의 반환값
                     */
                    return (...args) => {
                        const oldArray = [...target];

                        isMuting = true;
                        const result = /** @type {any} */ (Array.prototype)[/** @type {any} */ (prop)].apply(target, args);
                        isMuting = false;

                        switch(prop) {
                            case 'shift':
                                // 항상 인덱스 0에서 첫 번째 요소가 제거된다
                                record(OP.REMOVE, `${basePath}/0`, oldArray[0], undefined);
                                break;

                            case 'unshift':
                                // 추가된 요소들은 선두(0번) 인덱스부터 순서대로 삽입된다
                                args.forEach((/** @type {any} */ el, /** @type {number} */ idx) => {
                                    record(OP.ADD, `${basePath}/${idx}`, undefined, el);
                                });
                                break;
                            case 'splice':
                                // args[0]: 시작 인덱스(음수 허용), args[1]: 삭제 개수, args[2~]: 추가 요소
                                const startIdx = args[0] < 0
                                      ? Math.max(oldArray.length + args[0], 0)
                                      : Math.min(args[0], oldArray.length);

                                // 삭제(REMOVE): JSON Patch 관점에서 요소가 제거되면 뒤 인덱스가 앞으로 당겨지므로
                                // 삭제된 모든 요소를 동일한 startIdx를 향해 연속 REMOVE로 기록한다
                                /** @type {any[]} */ (result).forEach((/** @type {any} */ deletedItem) => {
                                    record(OP.REMOVE, `${basePath}/${startIdx}`, deletedItem, undefined);
                                });
                                
                                // 추가(ADD): args[2]부터가 새로 삽입할 요소들이다
                                const addedItems = args.slice(2);
                                addedItems.forEach((/** @type {any} */ addedItem, /** @type {number} */ idx) => {
                                    record(OP.ADD, `${basePath}/${startIdx + idx}`, undefined, addedItem);
                                });
                                break;

                            case 'sort':
                            case 'reverse':
                                // 정렬/역순은 인덱스 단위 추적이 불가능하므로 배열 전체를 단일 REPLACE로 기록
                                record(OP.REPLACE, basePath, oldArray, [...target]);
                                break;   
                        }

                        return result;
                    };
                }


                const value = Reflect.get(target, prop, receiver);

                // plain object 또는 배열: Lazy Proxying & WeakMap 캐싱
                if (isPlainObject(value) || isArray(value)) {
                    if(proxyCache.has(value)) {
                        return proxyCache.get(value);
                    }

                    const childPath = `${basePath}/${String(prop)}`;
                    console.debug(formatMessage(LOG.proxy.deepProxy, { path: childPath }));
                    const childProxy = new Proxy(value, makeHandler(childPath));
                    proxyCache.set(value, childProxy);
                    return childProxy;
                }

                return value;
            },

            /**
             * `deleteProperty` 트랩 — 프로퍼티 삭제(`remove`)를 기록한다.
             *
             * 존재하지 않는 키에 대한 삭제는 Proxy 명세에 따라 조용히 `true`를 반환한다.
             * `Reflect.get`으로 삭제 전 값을 읽어 `oldValue`로 기록한다.
             *
             * @param {object}          target - Proxy가 감싸고 있는 원본 객체
             * @param {string | symbol} prop   - 삭제할 프로퍼티 키
             * @returns {boolean} `Reflect.deleteProperty`의 성공 여부
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

    // ── 도개교(Drawbridge) 세트 반환 ──────────────────────────────────────────
    return {
        /**
         * 변경 추적이 활성화된 Proxy 객체.
         * DomainState 외부에서 도메인 데이터에 접근하는 유일한 공개 진입점.
         * @type {object}
         */
        proxy: new Proxy(domainObject, makeHandler('')),

        /**
         * 현재 변경 이력의 얕은 복사본을 반환한다.
         * 얕은 복사를 반환함으로써 외부에서 `changeLog` 배열을 직접 변조하는 것을 방지한다.
         * @type {() => ChangeLogEntry[]}
         */
        getChangeLog: () => [...changeLog],

        /**
         * 변경이 누적된 원본 객체를 반환한다.
         * `toPayload()` / `toPatch()` 직렬화 시 이 함수를 통해 읽는다.
         * @type {() => object}
         */
        getTarget: () => domainObject,

        /**
         * 변경 이력 배열을 비운다.
         * `DomainState.save()` 성공 직후 호출하여 이력을 초기화한다.
         * `void` 표현식으로 배열의 `length`를 0으로 리셋한다.
         * @type {() => void}
         */
        clearChangeLog: () => void (changeLog.length = 0),
    };
}
