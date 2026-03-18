/**
 * @fileoverview JavaScript 타입/프로토타입 유틸리티
 *
 * typeof, instanceof, Object.prototype.toString() 결과를
 * 상수와 헬퍼 함수로 추상화하여 라이브러리 전체에서 일관되게 사용한다.
 *
 * @module common/js-object-util
 * @see https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Operators/typeof
 */

/**
 * TYPEOF : typeof 연산자 반환값 상수
 * @readonly
 * @enum {string}
 */
export const TYPEOF = Object.freeze({
    UNDEFINED: 'undefined',
    OBJECT:    'object',
    BOOLEAN:   'boolean',
    NUMBER:    'number',
    BIGINT:    'bigint',
    STRING:    'string',
    SYMBOL:    'symbol',
    FUNCTION:  'function',
});

/**
 * TOSTRING_TAG : Object.prototype.toString() 태그 상수
 * @readonly
 * @enum {string}
 */
export const TOSTRING_TAG = Object.freeze({
    OBJECT:    '[object Object]',
    ARRAY:     '[object Array]',
    DATE:      '[object Date]',
    REGEXP:    '[object RegExp]',
    MAP:       '[object Map]',
    SET:       '[object Set]',
    PROMISE:   '[object Promise]',
    FUNCTION:  '[object Function]',
    NULL:      '[object Null]',
    UNDEFINED: '[object Undefined]',
    NUMBER:    '[object Number]',
    STRING:    '[object String]',
    BOOLEAN:   '[object Boolean]',
});

/**
 * getToStringTag() : 값의 Object.prototype.toString() 태그를 반환한다.
 * @param {*} value
 * @returns {string}
 */
export const getToStringTag = (value) => Object.prototype.toString.call(value);

/**
 * isPrimitive() : 값이 원시 타입(primitive)인지 확인한다.
 * null 포함.
 * @param {*} value
 * @returns {boolean}
 */
export const isPrimitive = (value) => {
    if (value === null) return true;
    const t = typeof value;
    return t !== TYPEOF.OBJECT && t !== TYPEOF.FUNCTION;
};

/**
 * isReference() : 값이 null이 아닌 참조 타입(object | function)인지 확인한다.
 * @param {*} value
 * @returns {boolean}
 */
export const isReference = (value) =>
    value !== null && (typeof value === TYPEOF.OBJECT || typeof value === TYPEOF.FUNCTION);

/**
 * isArray() : 값이 배열인지 확인한다.
 * @param {*} value
 * @returns {boolean}
 */
export const isArray = (value) => Array.isArray(value);

/**
 * isPlainObject() : 값이 plain object({})인지 확인한다.
 * null, Array, Date, Map, Set, Promise 등을 제외한다.
 * @param {*} value
 * @returns {boolean}
 */
export const isPlainObject = (value) => {
    if (value === null || typeof value !== TYPEOF.OBJECT) return false;
    if (getToStringTag(value) !== TOSTRING_TAG.OBJECT)   return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

/**
 * isThenable() : 값이 thenable(Promise-like)인지 확인한다.
 * @param {*} value
 * @returns {boolean}
 */
export const isThenable = (value) =>
    value !== null &&
    (typeof value === TYPEOF.OBJECT || typeof value === TYPEOF.FUNCTION) &&
    typeof value.then === TYPEOF.FUNCTION;

/**
 * shouldBypassDeepProxy() : Proxy get 트랩에서 deep proxy 진입을 건너뛰어야 하는 프로퍼티인지 판별한다.
 *
 * 건너뛰는 경우:
 *   - 모든 Symbol 프로퍼티
 *   - toJSON  : JSON.stringify 동작 보존
 *   - then    : Promise/thenable 체인 보존
 *   - valueOf : 암묵적 타입 변환 보존
 *
 * @param {string | symbol} prop - get 트랩에 전달된 프로퍼티 키
 * @returns {boolean} true이면 Reflect.get 결과를 그대로 반환해야 함
 * @see https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive
 */
export const shouldBypassDeepProxy = (prop) => {
    if (typeof prop === TYPEOF.SYMBOL)  return true;
    if (prop === 'toJSON')              return true;
    if (prop === 'then')                return true;
    if (prop === 'valueOf')             return true;
    return false;
};


/**
 * 점(dot) 분해된 키 배열로 중첩 객체에 값을 설정한다.
 *
 * @param {object}   target
 * @param {string[]} keys
 * @param {*}        value
 */
export function _setNestedValue(target, keys, value) {
    let cursor = target;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cursor[keys[i]] == null || typeof cursor[keys[i]] !== 'object') {
            cursor[keys[i]] = {};
        }
        cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
}