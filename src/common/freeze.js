// src/common/freeze.js

/**
 * 불변성 강제 유틸리티
 *
 * Shadow State의 스냅샷 객체를 개발 환경에서 동결(freeze)하여
 * 소비자가 스냅샷을 직접 변이시키려 할 때 즉시 에러를 발생시킨다.
 *
 * ## 프로덕션 전략
 * `process.env.NODE_ENV !== 'production'` 조건 분기로 개발 환경에서만
 * 재귀 순회를 수행한다. 프로덕션에서는 no-op이며, 소비자 번들러의
 * Tree-shaking으로 해당 코드 블록이 번들에서 완전히 제거된다.
 *
 * @module common/freeze
 */

/**
 * 객체와 모든 중첩 객체를 재귀적으로 동결한다.
 *
 * `WeakSet`으로 순환 참조를 방어한다. 이미 방문한 객체는 재순회하지 않는다.
 * `null`과 Primitive 값은 즉시 반환한다.
 *
 * @template T
 * @param {T}            obj       - 동결할 값
 * @param {WeakSet<object>} [seen] - 순환 참조 방어용 방문 집합 (재귀 호출 시 전달)
 * @returns {T} 동결된 값 (원본 참조 반환)
 */
export function deepFreeze(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return obj;  // 순환 참조 방어

    seen.add(obj);
    Object.freeze(obj);

    for (const key of Object.keys(obj)) {
        deepFreeze(/** @type {any} */ (obj)[key], seen);
    }

    return obj;
}

/**
 * 개발 환경에서만 `deepFreeze`를 적용한다. 프로덕션에서는 no-op.
 *
 * Shadow State 스냅샷 생성 시 사용한다.
 * `process.env.NODE_ENV` 치환은 소비자 번들러가 담당한다.
 * 프로덕션 빌드 시 `if (false) { ... }` 분기가 Tree-shaking으로 제거된다.
 *
 * ## 환경 탐지 가드
 * `typeof process !== 'undefined'` 검사로 `process`가 없는 브라우저
 * 순수 ESM 환경(번들러 define 미적용)에서의 ReferenceError를 방어한다.
 *
 * @template T
 * @param {T} obj - 조건부 동결할 값
 * @returns {T} 개발 환경이면 동결된 값, 프로덕션이면 원본 그대로
 */
export function maybeDeepFreeze(obj) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        return deepFreeze(obj);
    }
    return obj;
}