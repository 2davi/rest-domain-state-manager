/**
 * RFC 6902 JSON Patch 연산 하나를 나타내는 변경 이력 항목.
 *
 * - `op: 'add'`    : 기존에 없던 경로에 값이 추가됨. `oldValue` 없음.
 * - `op: 'replace'`: 기존 경로의 값이 교체됨. `oldValue` / `newValue` 모두 있음.
 * - `op: 'remove'` : 기존 경로의 값이 삭제됨. `newValue` 없음.
 *
 * @typedef {object} ChangeLogEntry
 * @property {'add'|'replace'|'remove'} op         - RFC 6902 연산 종류
 * @property {string}                   path       - JSON Pointer 스타일 경로 (예: `/address/city`, `/items/0`)
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
 * @property {() => Set<string>}             getDirtyFields   - 변경된 최상위 키 집합의 복사본을 반환한다.
 * @property {() => void}                    clearDirtyFields - 변경된 최상위 키 집합을 초기화한다.
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
export function createProxy(domainObject: object, onMutate?: OnMutateCallback | null): ProxyWrapper;
/**
 * RFC 6902 JSON Patch 연산 하나를 나타내는 변경 이력 항목.
 *
 * - `op: 'add'`    : 기존에 없던 경로에 값이 추가됨. `oldValue` 없음.
 * - `op: 'replace'`: 기존 경로의 값이 교체됨. `oldValue` / `newValue` 모두 있음.
 * - `op: 'remove'` : 기존 경로의 값이 삭제됨. `newValue` 없음.
 */
export type ChangeLogEntry = {
    /**
     * - RFC 6902 연산 종류
     */
    op: "add" | "replace" | "remove";
    /**
     * - JSON Pointer 스타일 경로 (예: `/address/city`, `/items/0`)
     */
    path: string;
    /**
     * - 새 값. `op: 'remove'` 시 존재하지 않음.
     */
    newValue?: any;
    /**
     * - 이전 값. `op: 'add'` 시 존재하지 않음.
     */
    oldValue?: any;
};
/**
 * `createProxy()`의 반환값. DomainState가 "도개교"로 보관하는 클로저 세트.
 *
 * 외부 개발자에게 공개되는 것은 `proxy` 뿐이며,
 * 나머지 세 함수는 `DomainState` 내부에서만 호출된다.
 */
export type ProxyWrapper = {
    /**
     * - 변경 추적이 활성화된 Proxy 객체. 유일한 외부 진입점.
     */
    proxy: object;
    /**
     * - 현재 변경 이력의 얕은 복사본을 반환한다. 외부 변조 방지.
     */
    getChangeLog: () => ChangeLogEntry[];
    /**
     * - 변경이 누적된 원본 객체를 반환한다.
     */
    getTarget: () => object;
    /**
     * - 동기화 성공 후 변경 이력 전체를 초기화한다.
     */
    clearChangeLog: () => void;
    /**
     * - 변경된 최상위 키 집합의 복사본을 반환한다.
     */
    getDirtyFields: () => Set<string>;
    /**
     * - 변경된 최상위 키 집합을 초기화한다.
     */
    clearDirtyFields: () => void;
};
/**
 * Proxy의 `set` / `deleteProperty` 트랩이 변경을 기록할 때마다 호출되는 콜백.
 * `DomainState._broadcast()`를 통해 디버그 채널에 실시간으로 상태를 전파하는 데 사용된다.
 */
export type OnMutateCallback = () => void;
/**
 * `ON_MUTATIONS` 래퍼 함수 내부에서 `Array.prototype[method]`를 호출한 결과 타입.
 * 메서드마다 반환 타입이 다르기 때문에 `unknown`으로 정의한다.
 */
export type ArrayMutationResult = unknown;
