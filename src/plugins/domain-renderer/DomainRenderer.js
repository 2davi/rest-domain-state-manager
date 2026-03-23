/**
 * DomainRenderer — DOM 렌더링 플러그인
 *
 * `DomainState.use(DomainRenderer)` 한 번으로 모든 `DomainState` 인스턴스에
 * `renderTo()` 메서드를 주입하는 플러그인이다.
 *
 * ## 설치
 * ```js
 * import { DomainState, DomainRenderer } from './rest-domain-state-manager.js';
 * DomainState.use(DomainRenderer); // 앱 초기화 시 1회
 * ```
 *
 * ## 지원 렌더링 타입
 *
 * | `type`       | 렌더러 모듈                    | 생성 요소                          |
 * |-------------|-------------------------------|-----------------------------------|
 * | `'select'`  | `select.renderer.js`          | `<select>` + `<option>` 목록      |
 * | `'radio'`   | `radio-checkbox.renderer.js`  | `<input type="radio">` 그룹       |
 * | `'checkbox'`| `radio-checkbox.renderer.js`  | `<input type="checkbox">` 그룹    |
 * | `'button'`  | `button.renderer.js`          | `<button>` 그룹                   |
 *
 * ## 렌더링 조건
 * `renderTo()`는 `DomainState`가 **배열 데이터**를 보유하고 있을 때만 정상 동작한다.
 * 목록 API(`GET /api/roles`)의 응답으로 생성된 `DomainState`가 그 예다.
 *
 * ## 덮어쓰기 동작
 * `renderTo()`를 같은 컨테이너에 여러 번 호출하면
 * 기존 자식 요소를 모두 제거(`innerHTML = ''`)하고 새로 렌더링한다.
 *
 * @module plugins/domain-renderer/DomainRenderer
 * @see {@link module:plugins/domain-renderer/renderers/select.renderer renderSelect}
 * @see {@link module:plugins/domain-renderer/renderers/radio-checkbox.renderer renderRadioCheckbox}
 * @see {@link module:plugins/domain-renderer/renderers/button.renderer renderButton}
 * @see {@link module:plugins/domain-renderer/renderer.const RENDERER_TYPE}
 */

import { renderSelect } from './renderers/select.renderer.js';
import { renderRadioCheckbox } from './renderers/radio-checkbox.renderer.js';
import { renderButton } from './renderers/button.renderer.js';
import { RENDERER_TYPE } from './renderer.const.js';
import { ERR } from '../../constants/error.messages.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `renderTo()` 두 번째 인자에 전달하는 렌더링 설정 객체의 유니온 타입.
 *
 * `type` 필드 값에 따라 적용되는 설정 옵션이 달라진다.
 * 각 타입별 전체 옵션은 해당 렌더러 모듈의 `@typedef`를 참조한다.
 *
 * @typedef {import('./renderers/select.renderer.js').SelectConfig
 *         | import('./renderers/radio-checkbox.renderer.js').RadioCheckboxConfig
 *         | import('./renderers/button.renderer.js').ButtonConfig} RenderConfig
 */

/**
 * `renderTo()`의 반환값 타입.
 *
 * - `type: 'select'`    → `HTMLSelectElement`
 * - `type: 'radio'`     → `HTMLInputElement[]`
 * - `type: 'checkbox'`  → `HTMLInputElement[]`
 * - `type: 'button'`    → `HTMLButtonElement[]`
 *
 * @typedef {HTMLSelectElement | HTMLInputElement[] | HTMLButtonElement[]} RenderResult
 */

/**
 * `DomainRenderer` 플러그인이 `DomainState.prototype`에 주입하는 `renderTo()` 메서드 시그니처.
 * 타입 참조 전용.
 *
 * @callback RenderToMethod
 * @param {string | HTMLElement} container
 *   렌더링 결과를 삽입할 컨테이너. CSS 셀렉터 형식 문자열(`'#id'` 또는 `'id'`) 또는 `HTMLElement`.
 * @param {RenderConfig} config - 렌더링 설정 옵션
 * @returns {RenderResult} 생성된 DOM 요소 또는 요소 배열
 * @throws {Error} 컨테이너를 찾을 수 없는 경우
 * @throws {Error} `config.type`이 지원하지 않는 값인 경우
 * @throws {Error} `config.valueField` 또는 `config.labelField`가 누락된 경우
 * @throws {Error} `DomainState`의 데이터가 배열이 아닌 경우
 */

// ════════════════════════════════════════════════════════════════════════════════
// 플러그인 객체
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainState`에 `renderTo()` DOM 렌더링 기능을 주입하는 플러그인 객체.
 *
 * `DomainState.use(DomainRenderer)` 한 번으로 설치한다.
 * 설치 후 모든 `DomainState` 인스턴스에서 `renderTo()`를 호출할 수 있다.
 *
 * @type {{ install: (DomainStateClass: typeof import('../../domain/DomainState.js').DomainState) => void }}
 *
 * @example <caption>기본 설치 및 사용</caption>
 * import { DomainState, DomainRenderer } from './rest-domain-state-manager.js';
 * DomainState.use(DomainRenderer);
 *
 * const roles = await api.get('/api/roles');
 *
 * roles.renderTo('#roleSelect', {
 *     type:        'select',
 *     valueField:  'roleId',
 *     labelField:  'roleName',
 *     class:       'form-select',
 *     placeholder: '역할 선택',
 * });
 *
 * @example <caption>체이닝 설치</caption>
 * DomainState.use(DomainRenderer).use(FormBinder);
 */
export const DomainRenderer = {
    /**
     * `DomainState` 클래스에 `renderTo()` 메서드를 주입한다.
     * `DomainState.use(DomainRenderer)` 호출 시 자동으로 실행된다.
     *
     * `DomainState.prototype.renderTo`에 함수를 직접 할당하여
     * 모든 인스턴스에서 메서드를 사용할 수 있도록 한다.
     *
     * @param {typeof import('../../domain/DomainState.js').DomainState} DomainStateClass
     *   `DomainState` 클래스 생성자. `prototype`을 통해 메서드를 확장한다.
     * @returns {void}
     */
    install(DomainStateClass) {
        /**
         * `DomainState`의 배열 데이터를 DOM 요소로 렌더링한다.
         *
         * `DomainState.use(DomainRenderer)` 설치 후 모든 인스턴스에서 사용 가능하다.
         * 같은 컨테이너에 여러 번 호출하면 기존 자식 요소를 모두 제거하고 덮어쓴다.
         *
         * ## 처리 순서
         * 1. **컨테이너 resolve** — `string`이면 `document.getElementById()`로, `HTMLElement`면 그대로 사용.
         *    `#` 접두사 자동 제거. 찾지 못하면 `Error` throw.
         * 2. **config 검증** — `type` / `valueField` / `labelField` 필수값 검사.
         * 3. **데이터 추출** — `this._getTarget()`으로 원본 배열을 읽음.
         *    Proxy가 아닌 원본 객체를 사용하는 이유: 렌더러가 순수 데이터만 필요하기 때문.
         * 4. **배열 검증** — `rawData`가 배열이 아니면 `Error` throw.
         * 5. **컨테이너 초기화** — `el.innerHTML = ''` 으로 기존 자식 요소 제거.
         * 6. **타입별 렌더러 위임** — `RENDERER_TYPE` switch 분기로 해당 렌더러 호출.
         *
         * @this {import('../../domain/DomainState.js').DomainState}
         * @param {string | HTMLElement} container
         *   렌더링 결과를 삽입할 컨테이너.
         *   - `string`: `'#roleSelect'` 또는 `'roleSelect'` 형식의 element ID.
         *   - `HTMLElement`: DOM 요소 직접 참조.
         * @param {RenderConfig} config - 렌더링 설정 옵션
         * @returns {RenderResult} 생성된 DOM 요소 또는 요소 배열
         * @throws {Error} `container`에 해당하는 DOM 요소를 찾을 수 없는 경우
         * @throws {Error} `config.type`이 `RENDERER_TYPE`에 없는 값인 경우
         * @throws {Error} `config.valueField`가 누락된 경우
         * @throws {Error} `config.labelField`가 누락된 경우
         * @throws {Error} `DomainState`의 데이터(`_getTarget()`)가 배열이 아닌 경우
         *
         * @example <caption>select</caption>
         * const roles = await api.get('/api/roles');
         * roles.renderTo('#roleSelect', {
         *     type:        'select',
         *     valueField:  'roleId',
         *     labelField:  'roleName',
         *     class:       'form-select',
         *     placeholder: '역할을 선택하세요',
         *     events:      { change: (e) => console.log(e.target.value) },
         * });
         *
         * @example <caption>radio — name 기본값 = valueField (MyBatis 자동 매핑)</caption>
         * statuses.renderTo('#statusGroup', {
         *     type:           'radio',
         *     valueField:     'statusCode',  // input[name="statusCode"] 자동 설정
         *     labelField:     'statusName',
         *     containerClass: 'form-check form-check-inline',
         *     class:          'form-check-input',
         *     labelClass:     'form-check-label',
         * });
         *
         * @example <caption>checkbox</caption>
         * permissions.renderTo('#permCheck', {
         *     type:           'checkbox',
         *     valueField:     'permCode',
         *     labelField:     'permName',
         *     containerClass: 'form-check',
         *     class:          'form-check-input',
         *     labelClass:     'form-check-label',
         * });
         *
         * @example <caption>button — data-value로 값 읽기</caption>
         * actions.renderTo('#actionBtns', {
         *     type:       'button',
         *     valueField: 'actionId',
         *     labelField: 'actionName',
         *     class:      'btn btn-sm btn-outline-primary',
         *     events: {
         *         click: (e) => console.log('actionId:', e.target.dataset.value),
         *     },
         * });
         *
         * @example <caption>HTMLElement 직접 전달</caption>
         * const el = document.querySelector('.role-container');
         * roles.renderTo(el, { type: 'select', valueField: 'roleId', labelField: 'roleName' });
         */
        /** @type {any} */ (DomainStateClass).prototype.renderTo = function renderTo(
            /** @type {string | HTMLElement} */ container,
            /** @type {RenderConfig} */ config
        ) {
            // ── 1. 컨테이너 resolve ──────────────────────────────────────────
            // '#roleSelect' → 'roleSelect' 로 '#' 접두사를 제거한 뒤 getElementById 호출
            const el =
                container instanceof HTMLElement
                    ? container
                    : document.getElementById(/** @type {string} */ (container).replace(/^#/, ''));

            // ts 컴파일 에러를 피하기 위해 String(container)로 대충 퉁치고 넘김
            // if container instanceof HTMLElement -> "[object HTMLDivElement]를 찾을 수 없습니다"
            if (!el) throw new Error(ERR.RENDERER_CONTAINER_NOT_FOUND(String(container)));

            // ── 2. config 필수값 검증 ────────────────────────────────────────
            const { type, valueField, labelField } = config;

            if (!Object.values(RENDERER_TYPE).includes(type)) {
                throw new Error(ERR.RENDERER_TYPE_UNKNOWN(type));
            }
            if (!valueField) throw new Error(ERR.RENDERER_VALUE_FIELD_MISSING);
            if (!labelField) throw new Error(ERR.RENDERER_LABEL_FIELD_MISSING);

            // ── 3. 데이터 배열 추출 ──────────────────────────────────────────
            // DomainState.data는 Proxy이므로 렌더러에 원본 데이터를 넘기기 위해 getTarget() 사용
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
