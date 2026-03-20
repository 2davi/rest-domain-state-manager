/**
 * `DomainState.fromForm()` (플러그인 주입 후 사용 가능) 의 `options` 파라미터.
 *
 * @typedef {object} FromFormOptions
 * @property {import('../../domain/DomainState.js').NormalizedUrlConfig|null} [urlConfig]
 *   URL 설정 오버라이드. 미입력 시 `handler.getUrlConfig()` 폴백.
 * @property {boolean} [debug=false]
 *   디버그 모드 활성화. `true`이면 Proxy 변경 시마다 디버그 채널에 broadcast.
 * @property {string}  [label]
 *   디버그 팝업 표시 이름. 미입력 시 `formEl.id` → 없으면 `'form_state'`.
 */
/**
 * `FormBinder` 플러그인이 `DomainState.use()`를 통해 주입하는 정적 팩토리 함수 시그니처.
 * 타입 참조 전용 — 실제 구현은 `FormBinder.install()` 내부에 있다.
 *
 * @callback FromFormFactory
 * @param {string | HTMLFormElement} formOrId - HTML Form 요소의 `id` 문자열 또는 `HTMLFormElement` 직접 참조
 * @param {import('../../network/api-handler.js').ApiHandler} handler  - `ApiHandler` 인스턴스
 * @param {FromFormOptions}          [options] - 추가 옵션
 * @returns {import('../../domain/DomainState.js').DomainState} `isNew: true`인 새 `DomainState` 인스턴스
 * @throws {Error} `formOrId`로 유효한 `HTMLFormElement`를 찾을 수 없는 경우
 */
/**
 * `FormBinder` 플러그인이 `DomainState.prototype`에 주입하는 인스턴스 메서드 시그니처.
 * 타입 참조 전용 — 실제 구현은 `FormBinder.install()` 내부에 있다.
 *
 * @callback BindFormMethod
 * @param {string | HTMLFormElement} formOrId - HTML Form 요소의 `id` 문자열 또는 `HTMLFormElement` 직접 참조
 * @returns {import('../../domain/DomainState.js').DomainState} 메서드 체이닝용 `this` 반환
 */
/**
 * `DomainState`에 HTML 폼 바인딩 기능을 주입하는 플러그인 객체.
 *
 * `DomainState.use(FormBinder)` 한 번으로 설치한다.
 * 설치 후 `DomainState.fromForm()` 정적 팩토리와
 * `domainState.bindForm()` 인스턴스 메서드가 활성화된다.
 *
 * @type {{ install: (DomainStateClass: typeof import('../../domain/DomainState.js').DomainState) => void }}
 *
 * @example
 * import { DomainState, FormBinder } from './rest-domain-state-manager.js';
 * DomainState.use(FormBinder);
 *
 * // fromForm — 신규 데이터 생성 (isNew: true → POST)
 * const formState = DomainState.fromForm('userForm', api, { debug: true });
 * await formState.save('/api/users');
 *
 * // bindForm — 기존 데이터를 폼에 역동기화 후 추적 연결
 * const user = await api.get('/api/users/1');
 * user.bindForm('userForm'); // 폼에 현재 data를 채우고 이후 변경을 추적
 */
export const FormBinder: {
    install: (DomainStateClass: typeof import("../../domain/DomainState.js").DomainState) => void;
};
/**
 * `DomainState.fromForm()` (플러그인 주입 후 사용 가능) 의 `options` 파라미터.
 */
export type FromFormOptions = {
    /**
     * URL 설정 오버라이드. 미입력 시 `handler.getUrlConfig()` 폴백.
     */
    urlConfig?: import("../../domain/DomainState.js").NormalizedUrlConfig | null | undefined;
    /**
     * 디버그 모드 활성화. `true`이면 Proxy 변경 시마다 디버그 채널에 broadcast.
     */
    debug?: boolean | undefined;
    /**
     * 디버그 팝업 표시 이름. 미입력 시 `formEl.id` → 없으면 `'form_state'`.
     */
    label?: string | undefined;
};
/**
 * `FormBinder` 플러그인이 `DomainState.use()`를 통해 주입하는 정적 팩토리 함수 시그니처.
 * 타입 참조 전용 — 실제 구현은 `FormBinder.install()` 내부에 있다.
 */
export type FromFormFactory = (formOrId: string | HTMLFormElement, handler: import("../../network/api-handler.js").ApiHandler, options?: FromFormOptions | undefined) => import("../../domain/DomainState.js").DomainState;
/**
 * `FormBinder` 플러그인이 `DomainState.prototype`에 주입하는 인스턴스 메서드 시그니처.
 * 타입 참조 전용 — 실제 구현은 `FormBinder.install()` 내부에 있다.
 */
export type BindFormMethod = (formOrId: string | HTMLFormElement) => import("../../domain/DomainState.js").DomainState;
