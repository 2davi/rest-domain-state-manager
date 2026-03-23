/**
 * radio / checkbox 그룹 렌더러
 *
 * `DomainState` 배열 데이터를 받아 각 항목마다
 * `<div.container> <input> <label>` 구조를 생성하여 컨테이너에 추가한다.
 *
 * ## 생성되는 DOM 구조
 * ```html
 * <!-- 각 데이터 항목 하나당 -->
 * <div class="{containerClass}" style="{containerCss}">
 *   <input
 *     type="{type}"
 *     id="{prefix}_{inputName}_{idx}"
 *     name="{inputName}"
 *     value="{item[valueField]}"
 *     class="{inputClass}"
 *     style="{inputCss}"
 *   />
 *   <label
 *     for="{prefix}_{inputName}_{idx}"
 *     class="{labelClass}"
 *     style="{labelCss}"
 *   >
 *     {item[labelField]}
 *   </label>
 * </div>
 * ```
 *
 * ## `input[id]` 고유성 보장 전략
 * 같은 페이지에 radio / checkbox 그룹이 여러 개 렌더링되면
 * `id` 충돌로 `label[for]` 클릭이 잘못된 input을 가리킬 수 있다.
 * 이를 방지하기 위해 `prefix`를 그룹별로 한 번만 생성한다.
 *
 * - `container.id` 있음 → `container.id`를 prefix로 사용
 * - `container.id` 없음 → `dsm_{Date.now()}_{random}`으로 런타임에 유일한 값 생성
 *
 * prefix는 `forEach` 바깥에서 한 번만 생성하여 같은 그룹 내 모든 항목이 동일한 prefix를 공유한다.
 *
 * ## `name` 속성 결정 규칙
 * - `config.name` 명시 → 해당 값 사용
 * - `config.name` 미명시 → `valueField` 값 사용 (MyBatis ResultMap 필드명 자동 일치)
 *
 * @module plugins/domain-renderer/renderers/radio-checkbox.renderer
 * @see {@link module:plugins/domain-renderer/DomainRenderer DomainRenderer}
 */

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * radio / checkbox 렌더러의 설정 옵션 객체.
 *
 * @typedef {object} RadioCheckboxConfig
 *
 * @property {'radio'|'checkbox'}           type
 *   렌더링할 `input` 요소의 타입.
 *
 * @property {string}                       valueField
 *   각 항목에서 `input[value]` 속성 값으로 사용할 데이터 필드명.
 *   `config.name` 미입력 시 `input[name]`의 기본값으로도 사용된다.
 *
 * @property {string}                       labelField
 *   각 항목에서 `label` 텍스트로 사용할 데이터 필드명.
 *
 * @property {string}                       [name]
 *   `input[name]` 속성값을 명시적으로 지정할 때 사용한다.
 *   미입력 시 `valueField` 값이 자동으로 사용된다.
 *   MyBatis form submit 시 필드명과 자동으로 일치시키려면 미입력으로 두는 것이 권장된다.
 *
 * @property {string}                       [class='']
 *   각 `input` 요소에 적용할 `className`.
 *   Bootstrap의 경우 `'form-check-input'`.
 *
 * @property {Partial<CSSStyleDeclaration>} [css={}]
 *   각 `input` 요소에 적용할 inline style 객체 (camelCase 키).
 *
 * @property {Record<string, EventListener>} [events={}]
 *   각 `input` 요소에 바인딩할 이벤트 핸들러 맵.
 *   키: 이벤트명 (예: `'change'`), 값: 핸들러 함수.
 *   radio / checkbox는 `change` 이벤트 사용을 권장한다.
 *
 * @property {string}                       [containerClass='']
 *   각 항목을 감싸는 wrapper `div`에 적용할 `className`.
 *   Bootstrap의 경우 `'form-check'` 또는 `'form-check form-check-inline'`.
 *
 * @property {Partial<CSSStyleDeclaration>} [containerCss={}]
 *   각 항목 wrapper `div`에 적용할 inline style 객체 (camelCase 키).
 *
 * @property {string}                       [labelClass='']
 *   각 `label` 요소에 적용할 `className`.
 *   Bootstrap의 경우 `'form-check-label'`.
 *
 * @property {Partial<CSSStyleDeclaration>} [labelCss={}]
 *   각 `label` 요소에 적용할 inline style 객체 (camelCase 키).
 */

/**
 * `renderRadioCheckbox()`가 내부에서 처리하는 단일 항목 데이터 형태.
 *
 * @typedef {Record<string, *>} RadioCheckboxItem
 */

// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * radio 또는 checkbox 그룹을 컨테이너 요소에 렌더링한다.
 *
 * 이 함수는 `DomainRenderer.install()` 내부에서 `renderTo()` 구현이
 * `type: 'radio'` 또는 `type: 'checkbox'`를 만났을 때 위임하여 호출한다.
 * 외부에서 직접 호출하는 것도 가능하다.
 *
 * ## 동작 흐름
 * 1. `prefix`를 `forEach` 바깥에서 한 번 결정 (id 고유성 보장).
 * 2. `dataArray` 각 항목을 순회하며:
 *    a. wrapper `<div>` 생성 및 스타일/클래스 적용
 *    b. `<input>` 생성 및 `type` / `id` / `name` / `value` / 스타일/클래스/이벤트 적용
 *    c. `<label>` 생성 및 `for` / 텍스트 / 스타일/클래스 적용
 *    d. wrapper → input, label 순서로 자식 추가 후 container에 삽입
 * 3. 생성된 `input` 요소 배열 반환
 *
 * @param {HTMLElement}          container - 렌더링 결과를 삽입할 컨테이너 DOM 요소.
 *                                           `DomainRenderer.renderTo()`가 이미 빈 상태로 전달한다.
 * @param {RadioCheckboxItem[]}  dataArray - `DomainState._getTarget()`의 배열 데이터.
 *                                           각 항목은 `valueField` / `labelField` 키를 포함해야 한다.
 * @param {RadioCheckboxConfig}  config    - 렌더링 설정 옵션
 * @returns {HTMLInputElement[]} 생성된 `<input>` 요소 배열. 인덱스는 `dataArray`와 일치한다.
 *
 * @example <caption>Bootstrap radio 그룹</caption>
 * import { renderRadioCheckbox } from './radio-checkbox.renderer.js';
 *
 * renderRadioCheckbox(container, rolesData, {
 *     type:           'radio',
 *     valueField:     'roleId',
 *     labelField:     'roleName',
 *     containerClass: 'form-check',
 *     class:          'form-check-input',
 *     labelClass:     'form-check-label',
 *     events: {
 *         change: (e) => console.log('선택된 역할:', e.target.value),
 *     },
 * });
 *
 * @example <caption>Bootstrap checkbox 인라인</caption>
 * renderRadioCheckbox(container, permissionsData, {
 *     type:           'checkbox',
 *     valueField:     'permCode',
 *     labelField:     'permName',
 *     containerClass: 'form-check form-check-inline',
 *     class:          'form-check-input',
 *     labelClass:     'form-check-label',
 * });
 *
 * @example <caption>순수 CSS 커스텀 스타일 (pill 형태)</caption>
 * renderRadioCheckbox(container, statusData, {
 *     type:       'radio',
 *     valueField: 'code',
 *     labelField: 'label',
 *     // input은 시각적으로 숨김
 *     css: { position: 'absolute', clip: 'rect(0,0,0,0)', width: '1px', height: '1px' },
 *     // label을 pill 버튼처럼 꾸밈
 *     labelCss: {
 *         display: 'inline-block', padding: '4px 12px',
 *         border: '1px solid #adb5bd', borderRadius: '20px', cursor: 'pointer',
 *     },
 *     events: {
 *         change: (e) => {
 *             // 체크 상태에 따라 label 스타일 전환
 *             const label = e.target.nextElementSibling;
 *             label.style.background = e.target.checked ? '#007acc' : '#fff';
 *         },
 *     },
 * });
 */
export function renderRadioCheckbox(container, dataArray, config) {
    const {
        type,
        valueField,
        labelField,
        name: inputName = valueField, // 미명시 시 valueField를 name으로 사용 (MyBatis 자동 매핑)
        class: inputCls = '',
        css: inputCss = {},
        events: evtMap = {},
        containerClass: conCls = '',
        containerCss: conCss = {},
        labelClass: lblCls = '',
        labelCss: lblCss = {},
    } = config;

    /** @type {HTMLInputElement[]} */
    const inputs = [];

    // prefix를 forEach 바깥에서 한 번만 생성한다.
    // 같은 그룹 내 모든 항목이 동일한 prefix를 공유해야 id 충돌이 발생하지 않는다.
    // container.id가 없으면 Date.now() + random으로 유일한 값을 생성한다.
    const prefix = container.id || `dsm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    dataArray.forEach((item, idx) => {
        const itemValue = item[valueField] ?? '';
        const itemLabel = item[labelField] ?? '';

        // 같은 그룹 내 항목끼리는 prefix와 inputName이 동일하고 idx만 달라
        // 다른 그룹(radio vs checkbox 등)은 container.id 또는 prefix로 구분
        const inputId = `${prefix}_${inputName}_${idx}`;

        // ── wrapper div ──────────────────────────────────────────────────────
        const wrapper = document.createElement('div');
        if (conCls) wrapper.className = conCls;
        _applyCSS(wrapper, conCss);

        // ── input ─────────────────────────────────────────────────────────────
        const input = document.createElement('input');
        input.type = type;
        input.id = inputId;
        input.name = inputName;
        input.value = itemValue;
        if (inputCls) input.className = inputCls;
        _applyCSS(input, inputCss);
        _bindEvents(input, evtMap);

        // ── label ─────────────────────────────────────────────────────────────
        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = itemLabel;
        if (lblCls) label.className = lblCls;
        _applyCSS(label, lblCss);

        // ── DOM 조립 ──────────────────────────────────────────────────────────
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
        inputs.push(input);
    });

    return inputs;
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
 * @param {HTMLElement}                     el     - 스타일을 적용할 DOM 요소
 * @param {Partial<CSSStyleDeclaration>}    cssObj - camelCase 키의 스타일 객체 (예: `{ borderRadius: '4px' }`)
 * @returns {void}
 */
function _applyCSS(el, cssObj) {
    // Object.assign은 대상 객체의 타입에 맞춰 소스 객체를 병합해줌.
    // 타입스크립트도 CSSStyleDeclaration에 Partial<CSSStyleDeclaration>을 넣는 건 허용해준다!
    Object.assign(el.style, cssObj);
}

/**
 * 이벤트 핸들러 맵을 DOM 요소에 바인딩한다.
 *
 * 값이 함수가 아닌 항목은 무시한다.
 * 동일한 이벤트명에 여러 핸들러를 등록하려면 `evtMap`의 값으로 함수 하나를 사용하고
 * 그 안에서 여러 동작을 처리한다.
 *
 * @param {HTMLElement}                    el     - 이벤트를 등록할 DOM 요소
 * @param {Record<string, EventListener>}  evtMap - 이벤트명 → 핸들러 함수 맵
 * @returns {void}
 *
 * @example
 * _bindEvents(input, {
 *     change: (e) => console.log(e.target.value),
 *     focus:  (e) => e.target.style.outline = '2px solid #007acc',
 * });
 */
function _bindEvents(el, evtMap) {
    for (const [eventName, handler] of Object.entries(evtMap)) {
        if (typeof handler === 'function') el.addEventListener(eventName, handler);
    }
}
