/**
 * 점(dot) 분해된 키 배열로 중첩 객체에 값을 설정한다.
 *
 * @param {object}   target
 * @param {string[]} keys
 * @param {*}        value
 */
export function _setNestedValue(target: object, keys: string[], value: any): void;
/**
 * TYPEOF : typeof 연산자 반환값 상수
 */
export type TYPEOF = string;
/**
 * JavaScript 타입/프로토타입 유틸리티
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
export const TYPEOF: Readonly<{
    UNDEFINED: "undefined";
    OBJECT: "object";
    BOOLEAN: "boolean";
    NUMBER: "number";
    BIGINT: "bigint";
    STRING: "string";
    SYMBOL: "symbol";
    FUNCTION: "function";
}>;
/**
 * TOSTRING_TAG : Object.prototype.toString() 태그 상수
 */
export type TOSTRING_TAG = string;
/**
 * TOSTRING_TAG : Object.prototype.toString() 태그 상수
 * @readonly
 * @enum {string}
 */
export const TOSTRING_TAG: Readonly<{
    OBJECT: "[object Object]";
    ARRAY: "[object Array]";
    DATE: "[object Date]";
    REGEXP: "[object RegExp]";
    MAP: "[object Map]";
    SET: "[object Set]";
    PROMISE: "[object Promise]";
    FUNCTION: "[object Function]";
    NULL: "[object Null]";
    UNDEFINED: "[object Undefined]";
    NUMBER: "[object Number]";
    STRING: "[object String]";
    BOOLEAN: "[object Boolean]";
}>;
export function getToStringTag(value: any): string;
export function isPrimitive(value: any): boolean;
export function isReference(value: any): boolean;
export function isArray(value: any): boolean;
export function isPlainObject(value: any): boolean;
export function isThenable(value: any): boolean;
export function shouldBypassDeepProxy(prop: string | symbol): boolean;
