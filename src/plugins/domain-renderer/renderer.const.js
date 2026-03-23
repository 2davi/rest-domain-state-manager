/**
 * DomainRenderer 플러그인 내부 상수 모음
 *
 * `renderTo()` config의 `type` 식별자,
 * 폼 이벤트 추적 전략 분류,
 * 텍스트 계열 input type 집합을 정의한다.
 *
 * ## 사용처
 *
 * | 상수                | 사용 모듈                          | 용도                                    |
 * |--------------------|-----------------------------------|-----------------------------------------|
 * | `RENDERER_TYPE`    | `DomainRenderer.js`               | `renderTo()` config의 `type` 검증       |
 * | `RENDERER_TYPE`    | `DomainRenderer.js` switch 분기   | 타입별 렌더러 위임                        |
 * | `TRACK_EVENT`      | `FormBinder.js` (참고용)          | 이벤트 전략 분류 명시                     |
 * | `TEXT_LIKE_TYPES`  | `FormBinder.js`                   | text 계열 input 판별                     |
 *
 * @module plugins/domain-renderer/renderer.const
 * @see {@link module:plugins/domain-renderer/DomainRenderer DomainRenderer}
 * @see {@link module:plugins/form-binder/FormBinder FormBinder}
 */

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `RENDERER_TYPE` 상수 객체의 값 유니온 타입.
 * `renderTo()` config의 `type` 필드에 허용되는 문자열 리터럴 타입이다.
 *
 * @typedef {'select'|'radio'|'checkbox'|'button'} RendererTypeValue
 */

/**
 * `TRACK_EVENT` 상수 객체의 값 유니온 타입.
 *
 * @typedef {'blur'|'change'} TrackEventValue
 */

// ════════════════════════════════════════════════════════════════════════════════
// 공개 상수
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `renderTo()`가 지원하는 DOM 요소 타입 식별자 상수.
 *
 * `DomainRenderer.install()` 내부에서 다음 두 가지 목적으로 사용된다.
 * 1. `config.type` 유효성 검증 (`Object.values(RENDERER_TYPE).includes(type)`)
 * 2. `switch` 분기로 타입별 렌더러 함수(`renderSelect`, `renderRadioCheckbox`, `renderButton`) 위임
 *
 * @readonly
 * @enum {RendererTypeValue}
 *
 * @example <caption>유효성 검증</caption>
 * if (!Object.values(RENDERER_TYPE).includes(config.type)) {
 *     throw new Error(`지원하지 않는 type: ${config.type}`);
 * }
 *
 * @example <caption>switch 분기</caption>
 * switch (config.type) {
 *     case RENDERER_TYPE.SELECT:   return renderSelect(...);
 *     case RENDERER_TYPE.RADIO:
 *     case RENDERER_TYPE.CHECKBOX: return renderRadioCheckbox(...);
 *     case RENDERER_TYPE.BUTTON:   return renderButton(...);
 * }
 */
export const RENDERER_TYPE = Object.freeze(
    /** @type {const} */ ({
        /** `<select>` 드롭다운 렌더러를 사용한다. */
        SELECT: 'select',
        /** `<input type="radio">` 그룹 렌더러를 사용한다. */
        RADIO: 'radio',
        /** `<input type="checkbox">` 그룹 렌더러를 사용한다. */
        CHECKBOX: 'checkbox',
        /** `<button>` 그룹 렌더러를 사용한다. */
        BUTTON: 'button',
    })
);

/**
 * 폼 요소의 값 변경을 추적할 때 사용하는 DOM 이벤트 전략 분류 상수.
 *
 * `FormBinder.js`의 `_bindFormEvents()` 함수에서
 * 요소 타입에 따라 어떤 이벤트로 Proxy를 갱신할지 결정하는 데 참조된다.
 *
 * ## 전략 분류 이유
 *
 * - **TEXT 계열** (`input[type=text]`, `textarea` 등):
 *   타이핑 중(`input` 이벤트)마다 Proxy를 갱신하면 V8 JIT 최적화에 부정적인 영향을 준다.
 *   `blur` (포커스를 잃는 시점)에 한 번만 갱신하는 것이 성능상 유리하다.
 *
 * - **SELECT 계열** (`select`, `radio`, `checkbox`):
 *   사용자가 선택하는 즉시 값이 확정되므로 `change` 이벤트로 즉시 반영한다.
 *
 * @readonly
 * @enum {TrackEventValue}
 *
 * @example
 * const event = TEXT_LIKE_TYPES.has(el.type) ? TRACK_EVENT.TEXT : TRACK_EVENT.SELECT;
 * el.addEventListener(event, handler);
 */
export const TRACK_EVENT = Object.freeze(
    /** @type {const} */ ({
        /**
         * 텍스트 계열 input 추적 이벤트.
         * `input[type=text|email|password|...]`, `textarea` 에 적용된다.
         * `blur` — 포커스를 잃는 시점에 1회 기록.
         */
        TEXT: 'blur',
        /**
         * select 계열 요소 추적 이벤트.
         * `select`, `input[type=radio|checkbox]` 에 적용된다.
         * `change` — 선택이 확정되는 즉시 기록.
         */
        SELECT: 'change',
    })
);

/**
 * `TRACK_EVENT.TEXT` 전략(`blur` 이벤트)을 적용할 텍스트 계열 input type 집합.
 *
 * `FormBinder.js`의 `_bindFormEvents()`에서
 * `input` 이벤트 리스너 내부에 `e.target.type`이 이 집합에 포함되는지 확인하여
 * text 계열은 `focusout`으로, 그 외는 `input`으로 갱신 전략을 분리한다.
 *
 * `'textarea'`는 `el.tagName.toLowerCase()`가 `'textarea'`이므로 `el.type`이 다를 수 있으나,
 * `FormBinder.js` 구현에서 `['text', 'password', 'email', 'textarea'].includes(e.target.type)`
 * 패턴으로 직접 비교하므로 여기에도 포함되어 있다.
 *
 * @readonly
 * @type {ReadonlySet<string>}
 *
 * @example
 * if (TEXT_LIKE_TYPES.has(el.type)) {
 *     el.addEventListener('blur', handler);   // 포커스 이탈 시 1회
 * } else {
 *     el.addEventListener('change', handler); // 선택 즉시
 * }
 */
export const TEXT_LIKE_TYPES = Object.freeze(
    new Set([
        'text',
        'email',
        'password',
        'number',
        'tel',
        'url',
        'search',
        'date',
        'time',
        'textarea',
    ])
);
