/**
 * @fileoverview button 그룹 렌더러
 *
 * DomainState 배열 데이터를 받아 각 항목마다 <button> 요소를 생성한다.
 *
 * valueField → button[data-value] 속성으로 주입
 * labelField → button 텍스트로 사용
 *
 * 이벤트 핸들러에서 event.target.dataset.value로 선택된 항목 값을 읽는다.
 *
 * @module plugin/domain-renderer/renderers/button.renderer
 */

/**
 * @typedef {object} ButtonConfig
 * @property {'button'}  type
 * @property {string}    valueField  - button[data-value]에 들어갈 데이터 필드명
 * @property {string}    labelField  - button 텍스트에 들어갈 데이터 필드명
 * @property {string}    [class]     - button 요소 class
 * @property {object}    [css]       - button 요소 inline style
 * @property {object}    [events]    - { click: handler, ... }
 */

/**
 * button 그룹을 컨테이너에 렌더링한다.
 *
 * @example
 * // 이벤트 핸들러에서 data-value 읽기
 * events: {
 *   click: (e) => {
 *     const roleId = e.target.dataset.value;
 *     console.log('선택된 roleId:', roleId);
 *   }
 * }
 *
 * @param {HTMLElement}    container
 * @param {Array<object>}  dataArray
 * @param {ButtonConfig}   config
 * @returns {HTMLButtonElement[]} 생성된 button 요소 배열
 */
export function renderButton(container, dataArray, config) {
    const {
        valueField,
        labelField,
        class:  cls    = '',
        css:    cssObj = {},
        events: evtMap = {},
    } = config;

    return dataArray.map(item => {
        const btn             = document.createElement('button');
        btn.type              = 'button';               // form submit 방지
        btn.dataset.value     = item[valueField] ?? '';
        btn.textContent       = item[labelField] ?? '';

        if (cls) btn.className = cls;

        for (const [prop, val] of Object.entries(cssObj)) {
            btn.style[prop] = val;
        }
        for (const [eventName, handler] of Object.entries(evtMap)) {
            if (typeof handler === 'function') btn.addEventListener(eventName, handler);
        }

        container.appendChild(btn);
        return btn;
    });
}
