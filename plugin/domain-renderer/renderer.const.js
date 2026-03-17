/**
 * @fileoverview DomainRenderer 플러그인 내부 상수
 *
 * renderTo() config의 type 식별자와
 * form 이벤트 추적 전략 분류에 사용된다.
 *
 * @module plugin/domain-renderer/renderer.const
 */

/**
 * RENDERER_TYPE : renderTo()가 지원하는 DOM 요소 타입 상수
 * @readonly
 * @enum {string}
 */
export const RENDERER_TYPE = Object.freeze({
    SELECT:   'select',
    RADIO:    'radio',
    CHECKBOX: 'checkbox',
    BUTTON:   'button',
});

/**
 * TRACK_EVENT : form 이벤트 추적 전략 분류
 *
 * TEXT  계열: input[type='text|email|password|...'], textarea
 *             → 타이핑 도중 불필요한 Proxy set을 피하기 위해 blur 이벤트로 추적
 *
 * SELECT 계열: select, radio, checkbox
 *             → 선택 즉시 값이 확정되므로 change 이벤트로 즉시 추적
 *
 * @readonly
 * @enum {string}
 */
export const TRACK_EVENT = Object.freeze({
    TEXT:   'blur',
    SELECT: 'change',
});

/**
 * TEXT_LIKE_TYPES : TEXT 계열 input type 목록 (TRACK_EVENT.TEXT 전략 적용 대상)
 * @readonly
 * @type {ReadonlySet<string>}
 */
export const TEXT_LIKE_TYPES = Object.freeze(
    new Set(['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'textarea'])
);
