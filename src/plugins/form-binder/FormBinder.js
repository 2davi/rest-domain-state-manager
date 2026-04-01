/**
 * FormBinder — HTML 폼 자동 바인딩 플러그인
 *
 * `DomainState` 코어 엔진에서 브라우저 DOM 의존성을 분리하여
 * 플러그인 형태로 제공하는 폼 바인딩 모듈이다.
 *
 * ## 설치
 * ```js
 * import { DomainState, FormBinder } from './rest-domain-state-manager.js';
 * DomainState.use(FormBinder); // 앱 초기화 시 1회
 * ```
 *
 * ## 설치 후 활성화되는 기능
 *
 * ### 1. 정적 팩토리 — `DomainState.fromForm(formOrId, handler, opts?)`
 * HTML Form 요소의 현재 값으로 기본 골격을 생성하고,
 * `blur` / `change` 이벤트를 자동으로 Proxy에 바인딩한다. (`isNew: true`)
 *
 * ### 2. 인스턴스 메서드 — `domainState.bindForm(formOrId)`
 * 이미 생성된 `DomainState`의 현재 데이터를 폼에 역방향 동기화하고,
 * 이후 폼 입력이 Proxy를 통해 자동으로 추적되도록 이벤트를 바인딩한다.
 *
 * ## Form 이벤트 추적 전략
 *
 * | 요소 타입                                                 | 추적 이벤트 | 이유                                       |
 * |----------------------------------------------------------|-------------|-------------------------------------------|
 * | `input[type=text\|password\|email\|textarea]`            | `focusout`  | 타이핑 중 불필요한 Proxy set 트랩 방지     |
 * | `select`, `input[type=radio\|checkbox]`, 그 외           | `input`     | 선택 즉시 값이 확정되어 즉시 반영           |
 *
 * ## `input[name]` 경로 표기법
 * `name` 속성에 점(`.`) 표기를 사용하면 중첩 객체 구조로 매핑된다.
 * ```html
 * <input name="address.city" />  <!-- proxy.address.city 에 바인딩 -->
 * ```
 *
 * ## 코어와의 분리 원칙
 * 이 플러그인은 브라우저 DOM(`HTMLFormElement`, `document.getElementById`)에 의존한다.
 * 코어 엔진(`api-proxy.js`, `DomainState.js`)은 DOM을 직접 참조하지 않으므로
 * Node.js 등 비(非)브라우저 환경에서도 코어를 독립적으로 사용할 수 있다.
 *
 * @module plugins/form-binder/FormBinder
 * @see {@link module:domain/DomainState DomainState}
 * @see {@link module:core/api-proxy createProxy}
 */

import { _setNestedValue } from '../../common/js-object-util.js';
import { createProxy } from '../../core/api-proxy.js';
import { DEPRECATED } from '../../constants/error.messages.js';
import { devWarn } from '../../common/logger.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════════════
// 플러그인 객체
// ════════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated v1.4.0 — UIComposer로 대체되었습니다.
 * `DomainState.use(UIComposer)`를 사용하고 UILayout.columns로 바인딩을 선언하세요.
 * v2.x에서 제거 예정. 기존 코드는 v2.x 전까지 정상 동작합니다.
 * 
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
export const FormBinder = {
    /**
     * @deprecated v1.4.0 — UIComposer로 대체되었습니다.
     * `DomainState.use(UIComposer)`를 사용하고 UILayout.columns로 바인딩을 선언하세요.
     * v2.x에서 제거 예정. 기존 코드는 v2.x 전까지 정상 동작합니다.
     * 
     * `DomainState` 클래스에 폼 바인딩 기능을 주입한다.
     * `DomainState.use(FormBinder)` 호출 시 자동으로 실행된다.
     * 
     * ## 주입 대상
     * 1. `DomainStateClass.fromForm` — 정적 팩토리 메서드
     * 2. `DomainStateClass.prototype.bindForm` — 인스턴스 메서드
     *
     * @param {typeof import('../../domain/DomainState.js').DomainState} DomainStateClass
     *   `DomainState` 클래스 생성자. 정적 멤버와 prototype을 동적으로 확장한다.
     * @returns {void}
     */
    install(DomainStateClass) {
        devWarn(DEPRECATED.DEPRECATED_TEMPLATE('v1.0.0', 'UIComposer'));
        // ── 1. 정적 팩토리 주입: DomainState.fromForm ─────────────────────────
        /**
         * HTML Form 요소를 기반으로 `DomainState`를 생성한다. (`isNew: true`)
         *
         * `_formToSkeleton()`으로 폼의 현재 값을 읽어 기본 골격 객체를 만들고,
         * `createProxy()`로 Proxy를 생성한 뒤 `_bindFormEvents()`로 이벤트를 연결한다.
         *
         * `onMutate` 콜백을 통해 Proxy 변경이 발생할 때마다 디버그 채널에 broadcast한다.
         * (`debug: true` 시에만 실질적으로 전파된다)
         *
         * @type {FromFormFactory}
         *
         * @example
         * DomainState.use(FormBinder);
         * const state = DomainState.fromForm('userForm', api, { debug: true, label: 'User' });
         * // 사용자가 폼을 입력하면 state.data가 자동으로 갱신된다
         * await state.save('/api/users'); // → POST
         */
        /** @type {any} */ (DomainStateClass).fromForm = function (
            /** @type {string | HTMLFormElement} */ formOrId,
            /** @type {import('../../network/api-handler.js').ApiHandler} */ handler,
            options = /** @type {FromFormOptions} */ ({})
        ) {
            const formEl = _resolveForm(formOrId);
            if (!formEl) throw new Error('[DSM] 유효한 HTMLFormElement가 아닙니다.');

            /** @type {any} */
            let state = null;
            const skeleton = _formToSkeleton(formEl);
            const wrapper = createProxy(skeleton, () => {
                state?._scheduleFlush();
            });

            state = new DomainStateClass(wrapper, {
                handler,
                urlConfig: options.urlConfig,
                isNew: true,
                debug: options.debug,
                label: options.label ?? formEl.id ?? 'form_state',
            });

            _bindFormEvents(formEl, wrapper.getTarget(), wrapper.proxy);
            return state;
        };

        // ── 2. 인스턴스 메서드 주입: domainState.bindForm ─────────────────────
        /**
         * 현재 `DomainState`의 데이터를 지정한 폼에 역방향 동기화하고,
         * 이후 폼 입력 변경이 Proxy를 통해 자동 추적되도록 이벤트를 바인딩한다.
         *
         * GET으로 가져온 기존 데이터를 편집 폼에 연결할 때 사용한다.
         * `fromForm()`이 신규 생성이라면, `bindForm()`은 기존 데이터의 편집 연결이다.
         *
         * 유효한 `HTMLFormElement`를 찾지 못하면 조용히 `this`를 반환하며 동작하지 않는다.
         *
         * @type {BindFormMethod}
         *
         * @example
         * DomainState.use(FormBinder);
         * const user = await api.get('/api/users/1');
         * user.bindForm('userForm'); // 폼에 name, address.city 등 자동 채움
         * // 이후 폼 변경 → user.data 자동 갱신 → user.save() 시 PATCH 전송
         */
        /** @type {any} */ (DomainStateClass.prototype).bindForm = function (
            /** @type {string | HTMLFormElement} */ formOrId
        ) {
            const formEl = _resolveForm(formOrId);
            if (!formEl) return this;

            // 현재 Proxy 상태를 폼에 동기화하고, 이벤트 리스너를 붙인다.
            _syncToForm(formEl, this._getTarget());
            _bindFormEvents(formEl, this._getTarget(), this.data);
            return this;
        };
    },
};

// ════════════════════════════════════════════════════════════════════════════════
// 내부 DOM 유틸리티
// (코어에서 분리되어 오직 이 플러그인 안에서만 사용된다)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `formOrId`로부터 `HTMLFormElement`를 resolve한다.
 *
 * - `string` → `document.getElementById(formOrId)` 반환
 * - `HTMLFormElement` → 그대로 반환
 * - 그 외 → `null` 반환
 *
 * @param {string | HTMLFormElement | unknown} formOrId - form `id` 문자열 또는 DOM 요소
 * @returns {HTMLFormElement | null} 찾은 Form 요소 또는 `null`
 */
function _resolveForm(formOrId) {
    if (typeof formOrId === 'string')
        return /** @type {HTMLFormElement | null} */ (document.getElementById(formOrId));
    if (formOrId instanceof HTMLFormElement) return formOrId;
    return null;
}

/**
 * `HTMLFormElement`의 현재 값을 읽어 중첩 객체 골격을 생성한다.
 *
 * `input[name]`의 점(`.`) 표기를 `_setNestedValue()`로 분해하여 계층 구조로 만든다.
 * `checkbox`는 `el.checked` 값을 사용하고, 그 외는 `el.value`를 사용한다.
 * `name` 속성이 없는 요소는 무시한다.
 *
 * @param {HTMLFormElement} formEl - 골격을 생성할 Form 요소
 * @returns {object} 폼 값으로 구성된 순수 JS 객체 (중첩 구조 포함)
 *
 * @example
 * // HTML: <input name="user.name" value="Davi" /> <input name="user.age" value="30" />
 * _formToSkeleton(form); // → { user: { name: 'Davi', age: '30' } }
 */
function _formToSkeleton(formEl) {
    const obj = {}; // HTMLFormControlsCollection을 일반 배열로 변환하면서 any[]로 캐스팅
    const elements = /** @type {any[]} */ (Array.from(formEl.elements));
    for (const el of elements) {
        if (!el.name) continue;
        const val = el.type === 'checkbox' ? el.checked : el.value;
        _setNestedValue(obj, el.name.split('.'), val);
    }
    return obj;
}

/**
 * `DomainState`의 현재 데이터를 `HTMLFormElement` 요소들에 역방향으로 동기화한다.
 *
 * `bindForm()` 호출 시 기존 데이터를 폼 초기값으로 채우는 데 사용된다.
 * 점(`.`) 표기 `name`은 중첩 경로로 파싱하여 값을 찾는다.
 *
 * - `checkbox` / `radio` : `el.checked = (el.value === String(val))`
 * - 그 외 (`text`, `select` 등) : `el.value = val`
 *
 * 중첩 경로를 순회하다가 `null` / `undefined`를 만나면 해당 요소의 동기화를 건너뛴다.
 *
 * @param {HTMLFormElement} formEl    - 값을 채울 Form 요소
 * @param {object}          targetObj - `DomainState._getTarget()`이 반환한 원본 객체
 * @returns {void}
 */
function _syncToForm(formEl, targetObj) {
    const elements = /** @type {any[]} */ (Array.from(formEl.elements));
    for (const el of elements) {
        if (!el.name) continue;
        const keys = el.name.split('.');
        let val = targetObj;
        for (const k of keys) {
            if (val == null) break;
            // 객체 인덱스 접근을 위해 any로 캐스팅
            val = /** @type {any} */ (val)[k];
        }
        if (val !== undefined && val !== null) {
            if (el.type === 'checkbox' || el.type === 'radio')
                el.checked = el.value === String(val);
            else el.value = val;
        }
    }
}

/**
 * `HTMLFormElement`에 입력 이벤트 리스너를 바인딩한다.
 * 폼 입력이 발생하면 `proxyObj`(Proxy)를 통해 변경을 기록한다.
 *
 * ## 이벤트 전략
 *
 * - **`input` 이벤트**: `select`, `checkbox`, `radio` 및 그 외 요소에 즉시 반영.
 *   `text` / `password` / `email` / `textarea` 계열은 타이핑 중 과도한 Proxy 호출을
 *   방지하기 위해 이 이벤트에서 건너뛴다.
 *
 * - **`focusout` 이벤트**: `text` / `password` / `email` / `textarea` 계열의 변경을
 *   포커스를 잃는 순간에 한 번만 기록한다. 타이핑 완료 시점이기 때문이다.
 *
 * ## proxyObj를 조작하는 이유
 * `targetObj`(원본)를 직접 수정하면 `changeLog`에 기록되지 않는다.
 * `proxyObj`(Proxy)를 수정해야 set 트랩이 동작하여 변경 이력이 남는다.
 *
 * @param {HTMLFormElement} formEl    - 이벤트를 등록할 Form 요소
 * @param {object}          targetObj - 원본 객체 (현재 사용하지 않으나 향후 확장 대비)
 * @param {object}          proxyObj  - 변경 이력 기록을 위한 Proxy 객체 (`DomainState.data`)
 * @returns {void}
 */
function _bindFormEvents(formEl, targetObj, proxyObj) {
    formEl.addEventListener('input', (e) => {
        // e.target을 any로 캐스팅해서 DOM 속성(name, type, value)에 자유롭게 접근!
        const target = /** @type {any} */ (e.target);
        if (!target.name) return;
        // input[type=text] 등은 blur 시점에 동기화 (타이핑 중 잦은 프록시 호출 방지)
        if (['text', 'password', 'email', 'textarea'].includes(target.type)) return;

        const val = target.type === 'checkbox' ? target.checked : target.value;
        _setNestedValue(proxyObj, target.name.split('.'), val); // targetObj가 아닌 proxyObj를 조작해 이력 기록
    });

    formEl.addEventListener('focusout', (e) => {
        const target = /** @type {any} */ (e.target);
        if (!target.name) return;
        if (['text', 'password', 'email', 'textarea'].includes(target.type)) {
            _setNestedValue(proxyObj, target.name.split('.'), target.value);
        }
    });
}
