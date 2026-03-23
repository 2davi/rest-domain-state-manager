/**
 * button 그룹 렌더러
 *
 * `DomainState` 배열 데이터를 받아 각 항목마다 `<button>` 요소를 생성하고
 * 컨테이너에 추가한다.
 *
 * ## 생성되는 DOM 구조
 * ```html
 * <!-- 각 데이터 항목 하나당 -->
 * <button
 *   type="button"
 *   data-value="{item[valueField]}"
 *   class="{config.class}"
 *   style="{config.css}"
 * >
 *   {item[labelField]}
 * </button>
 * ```
 *
 * ## `data-value` 속성
 * `valueField`에 해당하는 데이터 값이 `button[data-value]` 속성으로 주입된다.
 * 클릭 이벤트 핸들러에서 `e.target.dataset.value`로 값을 읽는다.
 *
 * ## `type="button"` 고정
 * 모든 `<button>` 요소에 `type="button"`을 강제한다.
 * `<form>` 안에 렌더링될 경우 기본값 `type="submit"`으로 인한 폼 제출을 방지한다.
 *
 * @module plugins/domain-renderer/renderers/button.renderer
 * @see {@link module:plugins/domain-renderer/DomainRenderer DomainRenderer}
 */
/**
 * `renderButton()`의 설정 옵션 객체.
 *
 * @typedef {object} ButtonConfig
 *
 * @property {'button'}                         type
 *   렌더러 타입 식별자. `DomainRenderer`에서 위임 판별에 사용.
 *
 * @property {string}                           valueField
 *   각 항목에서 `button[data-value]` 속성 값으로 사용할 데이터 필드명.
 *   클릭 핸들러에서 `e.target.dataset.value`로 읽는다.
 *
 * @property {string}                           labelField
 *   각 항목에서 버튼 텍스트(`textContent`)로 사용할 데이터 필드명.
 *
 * @property {string}                           [class='']
 *   각 `<button>` 요소에 적용할 `className`.
 *   Bootstrap 예: `'btn btn-sm btn-outline-primary'`
 *
 * @property {Partial<CSSStyleDeclaration>}     [css={}]
 *   각 `<button>` 요소에 적용할 inline style 객체 (camelCase 키).
 *   예: `{ margin: '2px', borderRadius: '20px' }`
 *
 * @property {Record<string, EventListener>}    [events={}]
 *   각 `<button>` 요소에 바인딩할 이벤트 핸들러 맵.
 *   키: 이벤트명 (예: `'click'`, `'mouseenter'`), 값: 핸들러 함수.
 *   값이 함수가 아닌 항목은 자동으로 무시된다.
 */
/**
 * `renderButton()` 내부에서 처리하는 단일 항목 데이터 형태.
 *
 * @typedef {Record<string, *>} ButtonItem
 */
/**
 * `<button>` 그룹을 컨테이너 요소에 렌더링한다.
 *
 * `DomainRenderer.install()` 내부에서 `renderTo()` 구현이
 * `type: 'button'`을 만났을 때 위임하여 호출한다.
 * 외부에서 직접 호출하는 것도 가능하다.
 *
 * ## 동작 흐름
 * 1. `dataArray`의 각 항목을 `Array.prototype.map()`으로 순회한다.
 * 2. 각 항목에 대해:
 *    a. `<button>` 생성 및 `type="button"` 고정
 *    b. `data-value` 속성에 `item[valueField]` 주입
 *    c. `textContent`에 `item[labelField]` 주입
 *    d. `className` / inline style / 이벤트 핸들러 적용
 *    e. `container`에 `appendChild`
 * 3. 생성된 `<button>` 요소 배열 반환
 *
 * `valueField` / `labelField`에 해당하는 값이 없으면 빈 문자열(`''`)을 대신 사용한다.
 *
 * @param {HTMLElement}    container - 렌더링 결과를 삽입할 컨테이너 DOM 요소.
 *                                     `DomainRenderer.renderTo()`가 이미 빈 상태로 전달한다.
 * @param {ButtonItem[]}   dataArray - `DomainState._getTarget()`의 배열 데이터.
 *                                     각 항목은 `valueField` / `labelField` 키를 포함해야 한다.
 * @param {ButtonConfig}   config    - 렌더링 설정 옵션
 * @returns {HTMLButtonElement[]} 생성된 `<button>` 요소 배열. 인덱스는 `dataArray`와 일치한다.
 *
 * @example <caption>Bootstrap 아웃라인 버튼 그룹</caption>
 * import { renderButton } from './button.renderer.js';
 *
 * renderButton(container, rolesData, {
 *     type:       'button',
 *     valueField: 'roleId',
 *     labelField: 'roleName',
 *     class:      'btn btn-sm btn-outline-secondary',
 *     events: {
 *         click: (e) => {
 *             console.log('선택된 roleId:', e.target.dataset.value);
 *         },
 *     },
 * });
 *
 * @example <caption>그라디언트 pill 버튼 (순수 CSS)</caption>
 * renderButton(container, statusData, {
 *     type:       'button',
 *     valueField: 'code',
 *     labelField: 'label',
 *     css: {
 *         padding:      '6px 16px',
 *         border:       'none',
 *         borderRadius: '20px',
 *         background:   'linear-gradient(135deg, #007acc, #00b4d8)',
 *         color:        '#fff',
 *         cursor:       'pointer',
 *     },
 *     events: {
 *         click:      (e) => console.log(e.target.dataset.value),
 *         mouseenter: (e) => e.target.style.opacity = '0.85',
 *         mouseleave: (e) => e.target.style.opacity = '1',
 *     },
 * });
 *
 * @example <caption>data-value 읽기 패턴</caption>
 * renderButton(container, actionsData, {
 *     type:       'button',
 *     valueField: 'actionId',
 *     labelField: 'actionName',
 *     events: {
 *         click: (e) => {
 *             // data-value에는 item[valueField] 값이 문자열로 저장되어 있다
 *             const actionId = e.target.dataset.value;
 *             performAction(actionId);
 *         },
 *     },
 * });
 */
export function renderButton(container: HTMLElement, dataArray: ButtonItem[], config: ButtonConfig): HTMLButtonElement[];
/**
 * `renderButton()`의 설정 옵션 객체.
 */
export type ButtonConfig = {
    /**
     *   렌더러 타입 식별자. `DomainRenderer`에서 위임 판별에 사용.
     */
    type: "button";
    /**
     *   각 항목에서 `button[data-value]` 속성 값으로 사용할 데이터 필드명.
     *   클릭 핸들러에서 `e.target.dataset.value`로 읽는다.
     */
    valueField: string;
    /**
     *   각 항목에서 버튼 텍스트(`textContent`)로 사용할 데이터 필드명.
     */
    labelField: string;
    /**
     * 각 `<button>` 요소에 적용할 `className`.
     * Bootstrap 예: `'btn btn-sm btn-outline-primary'`
     */
    class?: string | undefined;
    /**
     * 각 `<button>` 요소에 적용할 inline style 객체 (camelCase 키).
     * 예: `{ margin: '2px', borderRadius: '20px' }`
     */
    css?: Partial<CSSStyleDeclaration> | undefined;
    /**
     * 각 `<button>` 요소에 바인딩할 이벤트 핸들러 맵.
     * 키: 이벤트명 (예: `'click'`, `'mouseenter'`), 값: 핸들러 함수.
     * 값이 함수가 아닌 항목은 자동으로 무시된다.
     */
    events?: Record<string, EventListener> | undefined;
};
/**
 * `renderButton()` 내부에서 처리하는 단일 항목 데이터 형태.
 */
export type ButtonItem = Record<string, any>;
