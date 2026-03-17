/**
 * @fileoverview select 드롭다운 렌더러
 *
 * DomainState 배열 데이터를 받아 <select>...</select>를 생성하거나
 * 기존 <select> 요소에 <option>을 채운다.
 *
 * 생성된 select의 input[name]은 valueField 값을 사용한다.
 * MyBatis ResultMap의 필드명과 일치시켜 form submit 시 자동 매핑이 가능하다.
 *
 * @module plugin/domain-renderer/renderers/select.renderer
 */

/**
 * @typedef {object} SelectConfig
 * @property {'select'}  type
 * @property {string}    valueField       - option[value]에 들어갈 데이터 필드명 (= input[name])
 * @property {string}    labelField       - option 표시 텍스트에 들어갈 데이터 필드명
 * @property {string}    [class]          - select 요소 class
 * @property {object}    [css]            - select 요소 inline style
 * @property {object}    [events]         - { change: handler, ... } 이벤트 바인딩
 * @property {string}    [placeholder]    - 첫 번째 비활성 option 텍스트 (미입력 시 미생성)
 * @property {boolean}   [multiple=false] - 다중 선택 여부
 */

/**
 * <select> 요소를 생성하고 컨테이너에 추가한다.
 *
 * @param {HTMLElement}    container  - renderTo()가 찾은 컨테이너 요소
 * @param {Array<object>}  dataArray  - DomainState의 배열 데이터
 * @param {SelectConfig}   config
 * @returns {HTMLSelectElement}
 */
export function renderSelect(container, dataArray, config) {
    const {
        valueField,
        labelField,
        class:     cls       = '',
        css:       cssObj    = {},
        events:    evtMap    = {},
        placeholder,
        multiple   = false,
    } = config;

    const select      = document.createElement('select');
    select.name       = valueField;   // MyBatis form binding 기준
    select.multiple   = multiple;

    if (cls)  select.className = cls;
    _applyCSS(select, cssObj);

    // placeholder option (value='', disabled, selected, hidden)
    if (placeholder) {
        const ph        = document.createElement('option');
        ph.value        = '';
        ph.textContent  = placeholder;
        ph.disabled     = true;
        ph.selected     = true;
        ph.hidden       = true;
        select.appendChild(ph);
    }

    // 데이터 → option 생성
    for (const item of dataArray) {
        const opt       = document.createElement('option');
        opt.value       = item[valueField] ?? '';
        opt.textContent = item[labelField] ?? '';
        select.appendChild(opt);
    }

    // 이벤트 바인딩
    _bindEvents(select, evtMap);

    container.appendChild(select);
    return select;
}


// ── 내부 유틸 ──────────────────────────────────────────────────────────────────

/**
 * 스타일 객체(camelCase)를 요소의 inline style에 적용한다.
 * @param {HTMLElement} el
 * @param {object}      cssObj
 */
function _applyCSS(el, cssObj) {
    for (const [prop, val] of Object.entries(cssObj)) {
        el.style[prop] = val;
    }
}

/**
 * 이벤트 맵을 요소에 바인딩한다.
 * @param {HTMLElement}            el
 * @param {Record<string, function>} evtMap
 */
function _bindEvents(el, evtMap) {
    for (const [eventName, handler] of Object.entries(evtMap)) {
        if (typeof handler === 'function') el.addEventListener(eventName, handler);
    }
}
