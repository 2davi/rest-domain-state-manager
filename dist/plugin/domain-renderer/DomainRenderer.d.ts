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
/**
 * `DomainState`에 `renderTo()` DOM 렌더링 기능을 주입하는 플러그인 객체.
 *
 * `DomainState.use(DomainRenderer)` 한 번으로 설치한다.
 * 설치 후 모든 `DomainState` 인스턴스에서 `renderTo()`를 호출할 수 있다.
 *
 * @type {{ install: (DomainStateClass: typeof import('../../model/DomainState.js').DomainState) => void }}
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
export const DomainRenderer: {
    install: (DomainStateClass: typeof import("../../model/DomainState.js").DomainState) => void;
};
/**
 * `renderTo()` 두 번째 인자에 전달하는 렌더링 설정 객체의 유니온 타입.
 *
 * `type` 필드 값에 따라 적용되는 설정 옵션이 달라진다.
 * 각 타입별 전체 옵션은 해당 렌더러 모듈의 `@typedef`를 참조한다.
 */
export type RenderConfig = import("./renderers/select.renderer.js").SelectConfig | import("./renderers/radio-checkbox.renderer.js").RadioCheckboxConfig | import("./renderers/button.renderer.js").ButtonConfig;
/**
 * `renderTo()`의 반환값 타입.
 *
 * - `type: 'select'`    → `HTMLSelectElement`
 * - `type: 'radio'`     → `HTMLInputElement[]`
 * - `type: 'checkbox'`  → `HTMLInputElement[]`
 * - `type: 'button'`    → `HTMLButtonElement[]`
 */
export type RenderResult = HTMLSelectElement | HTMLInputElement[] | HTMLButtonElement[];
/**
 * `DomainRenderer` 플러그인이 `DomainState.prototype`에 주입하는 `renderTo()` 메서드 시그니처.
 * 타입 참조 전용.
 */
export type RenderToMethod = (container: string | HTMLElement, config: RenderConfig) => RenderResult;
