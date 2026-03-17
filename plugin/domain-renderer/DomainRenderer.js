/**
 * @fileoverview DomainRenderer — DOM 렌더링 플러그인
 *
 * DomainState.use(DomainRenderer) 한 번으로 모든 인스턴스에
 * renderTo() 메서드를 주입한다.
 *
 * 지원 타입: select | radio | checkbox | button
 *
 * @example
 * // 1. 플러그인 등록 (앱 초기화 시 1회)
 * import { DomainRenderer } from './plugin/domain-renderer/DomainRenderer.js';
 * DomainState.use(DomainRenderer);
 *
 * // 2. 배열 DomainState에서 renderTo() 호출
 * const roles = await api.get('/api/roles');
 *
 * roles.renderTo('#roleSelect', {
 *   type:        'select',
 *   valueField:  'roleId',
 *   labelField:  'roleName',
 *   class:       'form-select',
 *   placeholder: '역할 선택',
 *   events: {
 *     change: (e) => console.log('selected:', e.target.value)
 *   }
 * });
 *
 * @module plugin/domain-renderer/DomainRenderer
 */

import { renderSelect }        from './renderers/select.renderer.js';
import { renderRadioCheckbox } from './renderers/radio-checkbox.renderer.js';
import { renderButton }        from './renderers/button.renderer.js';
import { RENDERER_TYPE }       from './renderer.const.js';
import { ERR }                 from '../../src/constants/error.messages.js';


/**
 * @typedef {import('./renderers/select.renderer.js').SelectConfig
 *         | import('./renderers/radio-checkbox.renderer.js').RadioCheckboxConfig
 *         | import('./renderers/button.renderer.js').ButtonConfig} RenderConfig
 */

export const DomainRenderer = {

    /**
     * DomainState.use(DomainRenderer) 호출 시 실행되는 설치 함수.
     * DomainState.prototype에 renderTo()를 주입한다.
     *
     * @param {typeof import('../../model/DomainState.js').DomainState} DomainState
     */
    install(DomainState) {

        /**
         * DomainState의 배열 데이터를 DOM 요소로 렌더링한다.
         *
         * 컨테이너는 기존 자식 요소를 모두 비운 뒤 새로 그린다.
         * 따라서 같은 컨테이너에 여러 번 호출하면 덮어쓰기가 된다.
         *
         * @this {import('../../model/DomainState.js').DomainState}
         * @param {string|HTMLElement} container  - 컨테이너 id 문자열 또는 DOM 요소
         * @param {RenderConfig}       config
         * @returns {HTMLElement|HTMLElement[]} 생성된 요소 또는 요소 배열
         * @throws {Error} 컨테이너 미발견 / type 불명 / valueField·labelField 누락
         * @throws {Error} DomainState.data가 배열이 아닐 때
         *
         * @example <caption>select</caption>
         * roles.renderTo('#roleContainer', {
         *   type:        'select',
         *   valueField:  'roleId',
         *   labelField:  'roleName',
         *   class:       'form-select',
         *   css:         { width: '200px' },
         *   placeholder: '역할을 선택하세요',
         *   events:      { change: onRoleChange },
         * });
         *
         * @example <caption>radio — name 자동 설정 (valueField 사용)</caption>
         * statuses.renderTo('#statusGroup', {
         *   type:           'radio',
         *   valueField:     'statusCode',  // input[name="statusCode"] 자동 설정
         *   labelField:     'statusName',
         *   containerClass: 'form-check form-check-inline',
         *   class:          'form-check-input',
         *   labelClass:     'form-check-label',
         * });
         *
         * @example <caption>button — data-value 읽기</caption>
         * actions.renderTo('#actionBtns', {
         *   type:       'button',
         *   valueField: 'actionId',
         *   labelField: 'actionName',
         *   class:      'btn btn-sm btn-outline-primary',
         *   css:        { margin: '2px' },
         *   events: {
         *     click: (e) => console.log('actionId:', e.target.dataset.value)
         *   },
         * });
         */
        DomainState.prototype.renderTo = function renderTo(container, config) {

            // ── 1. 컨테이너 resolve ────────────────────────────────────────────
            const el = (container instanceof HTMLElement)
                ? container
                : document.getElementById(
                    typeof container === 'string' ? container.replace(/^#/, '') : container
                );

            if (!el) throw new Error(ERR.RENDERER_CONTAINER_NOT_FOUND(container));

            // ── 2. config 필수값 검증 ────────────────────────────────────────
            const { type, valueField, labelField } = config;

            if (!Object.values(RENDERER_TYPE).includes(type)) {
                throw new Error(ERR.RENDERER_TYPE_UNKNOWN(type));
            }
            if (!valueField) throw new Error(ERR.RENDERER_VALUE_FIELD_MISSING);
            if (!labelField) throw new Error(ERR.RENDERER_LABEL_FIELD_MISSING);

            // ── 3. 데이터 배열 추출 ──────────────────────────────────────────
            // DomainState.data는 Proxy. 원본 데이터를 getTarget()으로 읽는다.
            const rawData = this._getTarget();
            if (!Array.isArray(rawData)) {
                throw new Error(ERR.RENDERER_DATA_NOT_ARRAY(this._label));
            }

            // ── 4. 컨테이너 초기화 (덮어쓰기) ───────────────────────────────
            el.innerHTML = '';

            // ── 5. 타입별 렌더러 위임 ────────────────────────────────────────
            switch (type) {
                case RENDERER_TYPE.SELECT:
                    return renderSelect(el, rawData, config);

                case RENDERER_TYPE.RADIO:
                case RENDERER_TYPE.CHECKBOX:
                    return renderRadioCheckbox(el, rawData, config);

                case RENDERER_TYPE.BUTTON:
                    return renderButton(el, rawData, config);
            }
        };
    },
};
