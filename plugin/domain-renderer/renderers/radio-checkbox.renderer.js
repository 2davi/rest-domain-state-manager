/**
 * @fileoverview radio / checkbox 그룹 렌더러
 *
 * DomainState 배열 데이터를 받아 각 항목마다
 * <div.container> <input> <label> 구조를 생성한다.
 *
 * name 속성 결정 규칙:
 *   config.name 명시 → 해당 값 사용
 *   미명시            → valueField 값 사용 (MyBatis 필드명 자동 일치)
 *
 * @module plugin/domain-renderer/renderers/radio-checkbox.renderer
 */

/**
 * @typedef {object} RadioCheckboxConfig
 * @property {'radio'|'checkbox'} type
 * @property {string}  valueField       - input[value]의 출처 필드명 (input[name]의 기본값)
 * @property {string}  labelField       - label 텍스트의 출처 필드명
 * @property {string}  [name]           - input[name] 명시 오버라이드 (미입력 시 valueField 사용)
 * @property {string}  [class]          - input 요소 class
 * @property {object}  [css]            - input 요소 inline style
 * @property {object}  [events]         - { change: handler, ... }
 * @property {string}  [containerClass] - 각 항목 컨테이너 div의 class
 * @property {object}  [containerCss]   - 각 항목 컨테이너 div의 inline style
 * @property {string}  [labelClass]     - label 요소 class
 * @property {object}  [labelCss]       - label 요소 inline style
 */

/**
 * radio 또는 checkbox 그룹을 컨테이너에 렌더링한다.
 *
 * 각 항목 구조:
 *   <div class="{containerClass}">
 *     <input type="{type}" id="{name}_{idx}" name="{name}" value="{valueField}" />
 *     <label for="{name}_{idx}">{labelField}</label>
 *   </div>
 *
 * @param {HTMLElement}    container
 * @param {Array<object>}  dataArray
 * @param {RadioCheckboxConfig} config
 * @returns {HTMLElement[]} 생성된 input 요소 배열
 */
export function renderRadioCheckbox(container, dataArray, config) {
    const {
        type,
        valueField,
        labelField,
        name:           inputName    = valueField,  // 미명시 시 valueField를 name으로 사용
        class:          inputCls     = '',
        css:            inputCss     = {},
        events:         evtMap       = {},
        containerClass: conCls       = '',
        containerCss:   conCss       = {},
        labelClass:     lblCls       = '',
        labelCss:       lblCss       = {},
    } = config;

    const inputs = [];

    dataArray.forEach((item, idx) => {
        const itemValue = item[valueField] ?? '';
        const itemLabel = item[labelField] ?? '';
        const prefix  = container.id || `dsm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const inputId = `${prefix}_${inputName}_${idx}`;

        // 컨테이너
        const wrapper     = document.createElement('div');
        if (conCls) wrapper.className = conCls;
        _applyCSS(wrapper, conCss);

        // input
        const input     = document.createElement('input');
        input.type      = type;
        input.id        = inputId;
        input.name      = inputName;
        input.value     = itemValue;
        if (inputCls) input.className = inputCls;
        _applyCSS(input, inputCss);
        _bindEvents(input, evtMap);

        // label
        const label     = document.createElement('label');
        label.htmlFor   = inputId;
        label.textContent = itemLabel;
        if (lblCls) label.className = lblCls;
        _applyCSS(label, lblCss);

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
        inputs.push(input);
    });

    return inputs;
}


// ── 내부 유틸 ──────────────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} el
 * @param {object} cssObj
 */
function _applyCSS(el, cssObj) {
    for (const [prop, val] of Object.entries(cssObj)) {
        el.style[prop] = val;
    }
}

/**
 * @param {HTMLElement}            el
 * @param {Record<string, function>} evtMap
 */
function _bindEvents(el, evtMap) {
    for (const [eventName, handler] of Object.entries(evtMap)) {
        if (typeof handler === 'function') el.addEventListener(eventName, handler);
    }
}
