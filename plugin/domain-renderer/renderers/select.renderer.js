/**
 * select 드롭다운 렌더러
 *
 * `DomainState` 배열 데이터를 받아 `<select>` 요소와
 * 그 안의 `<option>` 요소들을 생성하여 컨테이너에 추가한다.
 *
 * ## 생성되는 DOM 구조
 * ```html
 * <select name="{valueField}" class="{config.class}" style="{config.css}">
 *   <!-- placeholder가 있는 경우 -->
 *   <option value="" disabled selected hidden>{placeholder}</option>
 *   <!-- 데이터 항목마다 -->
 *   <option value="{item[valueField]}">{item[labelField]}</option>
 *   <option value="{item[valueField]}">{item[labelField]}</option>
 *   ...
 * </select>
 * ```
 *
 * ## `select[name]` — MyBatis 자동 매핑
 * 생성된 `<select>` 요소의 `name` 속성은 `valueField` 값으로 자동 설정된다.
 * MyBatis ResultMap의 필드명과 일치시켜 form submit 시 별도 매핑 없이 자동으로 처리된다.
 *
 * ## `placeholder` 옵션
 * `placeholder`를 지정하면 첫 번째 `<option>`으로 추가되며
 * `disabled selected hidden` 속성이 적용되어 선택 안내 역할만 한다.
 * 선택 후에는 드롭다운에 나타나지 않는다.
 *
 * @module plugin/domain-renderer/renderers/select.renderer
 * @see {@link module:plugin/domain-renderer/DomainRenderer DomainRenderer}
 */


// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `renderSelect()`의 설정 옵션 객체.
 *
 * @typedef {object} SelectConfig
 *
 * @property {'select'}                          type
 *   렌더러 타입 식별자. `DomainRenderer`에서 위임 판별에 사용.
 *
 * @property {string}                            valueField
 *   각 항목에서 `option[value]` 속성 값으로 사용할 데이터 필드명.
 *   `select[name]`의 기본값으로도 사용되어 MyBatis form submit 자동 매핑이 가능하다.
 *
 * @property {string}                            labelField
 *   각 항목에서 `option` 표시 텍스트(`textContent`)로 사용할 데이터 필드명.
 *
 * @property {string}                            [class='']
 *   `<select>` 요소에 적용할 `className`.
 *   Bootstrap 예: `'form-select'`, `'form-select-sm'`
 *
 * @property {Partial<CSSStyleDeclaration>}      [css={}]
 *   `<select>` 요소에 적용할 inline style 객체 (camelCase 키).
 *   예: `{ width: '200px', backgroundColor: '#1e1e1e' }`
 *
 * @property {Record<string, EventListener>}     [events={}]
 *   `<select>` 요소에 바인딩할 이벤트 핸들러 맵.
 *   키: 이벤트명 (예: `'change'`), 값: 핸들러 함수.
 *   값이 함수가 아닌 항목은 자동으로 무시된다.
 *
 * @property {string}                            [placeholder]
 *   첫 번째 비활성(`disabled selected hidden`) `<option>`의 텍스트.
 *   미입력 시 placeholder option 자체가 생성되지 않는다.
 *   예: `'역할을 선택하세요'`
 *
 * @property {boolean}                           [multiple=false]
 *   `true`이면 `<select multiple>` 다중 선택을 활성화한다.
 */

/**
 * `renderSelect()` 내부에서 처리하는 단일 항목 데이터 형태.
 *
 * @typedef {Record<string, *>} SelectItem
 */


// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `<select>` 드롭다운 요소를 생성하고 컨테이너에 추가한다.
 *
 * `DomainRenderer.install()` 내부에서 `renderTo()` 구현이
 * `type: 'select'`를 만났을 때 위임하여 호출한다.
 * 외부에서 직접 호출하는 것도 가능하다.
 *
 * ## 동작 흐름
 * 1. `<select>` 요소 생성 및 `name` / `multiple` / `className` / inline style 적용.
 * 2. `placeholder`가 있으면 첫 번째 `<option>`으로 추가 (`disabled selected hidden`).
 * 3. `dataArray`를 순회하며 각 항목에 대해 `<option>` 생성 및 추가.
 * 4. 이벤트 핸들러 바인딩.
 * 5. `container`에 `<select>` 추가 후 반환.
 *
 * `valueField` / `labelField`에 해당하는 값이 없으면 빈 문자열(`''`)을 대신 사용한다.
 *
 * @param {HTMLElement}   container - 렌더링 결과를 삽입할 컨테이너 DOM 요소.
 *                                    `DomainRenderer.renderTo()`가 이미 빈 상태로 전달한다.
 * @param {SelectItem[]}  dataArray - `DomainState._getTarget()`의 배열 데이터.
 *                                    각 항목은 `valueField` / `labelField` 키를 포함해야 한다.
 * @param {SelectConfig}  config    - 렌더링 설정 옵션
 * @returns {HTMLSelectElement} 생성되어 컨테이너에 추가된 `<select>` 요소
 *
 * @example <caption>Bootstrap select (기본)</caption>
 * import { renderSelect } from './select.renderer.js';
 *
 * renderSelect(container, rolesData, {
 *     type:        'select',
 *     valueField:  'roleId',
 *     labelField:  'roleName',
 *     class:       'form-select',
 *     placeholder: '역할을 선택하세요',
 *     events: {
 *         change: (e) => console.log('선택된 값:', e.target.value),
 *     },
 * });
 *
 * @example <caption>Bootstrap small select</caption>
 * renderSelect(container, statusData, {
 *     type:       'select',
 *     valueField: 'code',
 *     labelField: 'label',
 *     class:      'form-select form-select-sm',
 * });
 *
 * @example <caption>다중 선택 (multiple)</caption>
 * renderSelect(container, permissionsData, {
 *     type:       'select',
 *     valueField: 'permCode',
 *     labelField: 'permName',
 *     class:      'form-select',
 *     multiple:   true,
 * });
 *
 * @example <caption>다크 테마 커스텀 스타일</caption>
 * renderSelect(container, rolesData, {
 *     type:        'select',
 *     valueField:  'roleId',
 *     labelField:  'roleName',
 *     css: {
 *         width:           '100%',
 *         backgroundColor: '#1e1e1e',
 *         color:           '#9cdcfe',
 *         border:          '1px solid #007acc',
 *         borderRadius:    '4px',
 *         padding:         '6px 8px',
 *     },
 *     placeholder: '역할 선택',
 * });
 */
export function renderSelect(container, dataArray, config) {
    const {
        valueField,
        labelField,
        class:       cls       = '',
        css:         cssObj    = {},
        events:      evtMap    = {},
        placeholder,
        multiple    = false,
    } = config;

    const select    = document.createElement('select');
    select.name     = valueField;  // MyBatis form submit 자동 매핑 기준
    select.multiple = multiple;

    if (cls) select.className = cls;
    _applyCSS(select, cssObj);

    // placeholder option: 안내 텍스트 역할만 하며 선택 후에는 드롭다운에 나타나지 않는다
    if (placeholder) {
        const ph       = document.createElement('option');
        ph.value       = '';
        ph.textContent = placeholder;
        ph.disabled    = true;
        ph.selected    = true;
        ph.hidden      = true;
        select.appendChild(ph);
    }

    // 데이터 항목 → <option> 생성
    for (const item of dataArray) {
        const opt       = document.createElement('option');
        opt.value       = String(item[valueField] ?? '');
        opt.textContent = String(item[labelField] ?? '');
        select.appendChild(opt);
    }

    _bindEvents(select, evtMap);
    container.appendChild(select);
    return select;
}


// ════════════════════════════════════════════════════════════════════════════════
// 내부 유틸리티
// ════════════════════════════════════════════════════════════════════════════════

/**
 * CSS 스타일 객체(camelCase 키)를 DOM 요소의 inline style에 적용한다.
 *
 * `cssObj`가 빈 객체이면 아무 동작도 하지 않는다.
 * `Object.entries()`로 순회하므로 프로토타입 체인의 속성은 적용하지 않는다.
 *
 * @param {HTMLElement}                  el     - 스타일을 적용할 DOM 요소
 * @param {Partial<CSSStyleDeclaration>} cssObj - camelCase 키의 스타일 객체
 * @returns {void}
 */
function _applyCSS(el, cssObj) {
    Object.assign(el.style, cssObj);
}

/**
 * 이벤트 핸들러 맵을 DOM 요소에 바인딩한다.
 *
 * 값이 함수가 아닌 항목은 무시한다.
 *
 * @param {HTMLElement}                   el     - 이벤트를 등록할 DOM 요소
 * @param {Record<string, EventListener>} evtMap - 이벤트명 → 핸들러 함수 맵
 * @returns {void}
 */
function _bindEvents(el, evtMap) {
    for (const [eventName, handler] of Object.entries(evtMap)) {
        if (typeof handler === 'function') el.addEventListener(eventName, handler);
    }
}
