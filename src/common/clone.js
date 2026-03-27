/**
 * 깊은 복사(Deep Clone) 유틸리티
 *
 * `structuredClone()`을 1순위로 사용하고, 미지원 환경에서는
 * 커스텀 재귀 함수(`_cloneDeep`)로 폴백하는 Progressive Enhancement 패턴을 따른다.
 *
 * ## 사용 범위
 * `DomainVO.toSkeleton()`의 `static fields` 기본값 deep copy에 사용된다.
 * 기존 `JSON.parse(JSON.stringify())` 방식의 타입 파괴 문제를 해결한다.
 *
 * ## `_cloneDeep` 폴백 지원 타입
 * VO 레이어의 실제 사용 범위에 맞게 구현하였다.
 * `Map`·`Set`은 현 코드베이스의 VO 기본값에서 사용되지 않으므로 폴백에서 제외한다.
 * (폴백 미지원 시 `{}` 또는 `[]`로 대체됨)
 * `structuredClone` 경로는 `Map`·`Set`을 완벽히 처리한다.
 *
 * @module common/clone
 */

/**
 * 객체를 깊게 복사하는 내부 재귀 함수. `structuredClone` 미지원 환경에서 사용된다.
 *
 * ## 처리 규칙
 * - `null` → 즉시 반환 (`typeof null === 'object'` 함정 방어)
 * - 원시값 (`string`, `number`, `boolean`, `undefined`, `symbol`, `bigint`) → 즉시 반환
 * - `Date` → `new Date(obj.getTime())` — 밀리초 정밀도 보존
 * - `RegExp` → `new RegExp(obj.source, obj.flags)` — 플래그 완전 보존
 * - 배열 → 각 요소를 재귀 복사한 새 배열
 * - 일반 plain 객체 → `Object.keys()` 순회 재귀
 *
 * @param {*} obj - 복사할 값
 * @returns {*} 깊은 복사된 값
 */
function _cloneDeep(obj) {
    // null 함정 방어: typeof null === 'object' 이므로 반드시 먼저 검사한다
    if (obj === null) return null;

    // 원시값 탈출: string, number, boolean, undefined, symbol, bigint
    if (typeof obj !== 'object') return obj;

    // Date: new Date(obj.getTime())으로 복사하면 밀리초 정밀도가 보장된다
    if (obj instanceof Date) return new Date(/** @type {Date} */ (obj).getTime());

    // RegExp: source와 flags를 그대로 보존한다
    if (obj instanceof RegExp) {
        return new RegExp(/** @type {RegExp} */ (obj).source, /** @type {RegExp} */ (obj).flags);
    }

    // 배열: 각 요소를 재귀 복사
    if (Array.isArray(obj)) return obj.map(_cloneDeep);

    // 일반 plain 객체: own enumerable key 순회 재귀
    /** @type {Record<string, unknown>} */
    const cloned = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = _cloneDeep(/** @type {any} */ (obj)[key]);
    }
    return cloned;
}

/**
 * 값을 깊게 복사한다.
 *
 * `structuredClone()`이 지원되는 환경(Chrome 98+, Firefox 94+, Safari 15.4+, Node.js 17+)에서는
 * V8 C++ 네이티브 직렬화 파이프라인을 사용한다.
 * 미지원 환경(구형 Android WebView, 일부 공공기관 내부망 키오스크 등)에서는
 * `_cloneDeep()`으로 폴백하여 점진적 향상(Progressive Enhancement)을 제공한다.
 *
 * ## `structuredClone` vs `JSON.parse(JSON.stringify())` 비교
 *
 * | 타입                | `JSON.parse` 방식          | `safeClone`                |
 * |---------------------|----------------------------|----------------------------|
 * | `Date`              | ISO 문자열로 손실           | ✅ `Date` 객체로 보존       |
 * | `undefined` 프로퍼티 | 키 자체 소멸               | ✅ 그대로 보존              |
 * | `RegExp`            | 빈 `{}` 객체로 손실         | ✅ `RegExp`으로 보존        |
 * | `Map`, `Set`        | 빈 `{}`/`[]`로 파괴         | ✅ 완전 보존 (SC 경로)      |
 * | 순환 참조           | 런타임 에러                 | ✅ 올바르게 처리 (SC 경로)  |
 *
 * ## `_cloneDeep` 폴백의 한계
 * `Map`·`Set`은 현 VO 레이어에서 `default` 값으로 사용되지 않으므로
 * 폴백에서 특수 처리를 생략하였다. 레거시 환경에서 `Map`·`Set` 기본값이 필요하다면
 * `structuredClone` 폴리필(`@ungap/structured-clone` 등) 도입을 검토하라.
 *
 * @param {*} value - 복사할 값
 * @returns {*} 깊은 복사된 값
 *
 * @example <caption>Date 보존 확인</caption>
 * const obj = { createdAt: new Date('2026-01-01') };
 * const copy = safeClone(obj);
 * console.log(copy.createdAt instanceof Date); // true (JSON 방식은 string으로 변환됨)
 * copy.createdAt.setFullYear(2025);
 * console.log(obj.createdAt.getFullYear());    // 2026 — 원본 불변
 *
 * @example <caption>DomainVO.toSkeleton() 내부 사용</caption>
 * // 인스턴스마다 독립적인 address 참조를 갖도록 보장
 * const skeleton = new UserVO().toSkeleton();
 * skeleton.address.city = 'Busan';
 * console.log(new UserVO().toSkeleton().address.city); // '' — 오염 없음
 */
export function safeClone(value) {
    if (typeof structuredClone !== 'undefined') {
        return structuredClone(value);
    }
    return _cloneDeep(value);
}