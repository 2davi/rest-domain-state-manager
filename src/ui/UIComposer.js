/**
 * UIComposer — DomainState / DomainCollection UI 바인딩 플러그인
 *
 * `DomainState.use(UIComposer)` 호출로 설치하면
 * `DomainState.prototype`에 `bindSingle()` 메서드가,
 * `DomainCollection.prototype`에 `bind()` 메서드가 추가된다.
 *
 * ## 역할 분리
 *
 * | 레이어             | 책임                                     |
 * |--------------------|------------------------------------------|
 * | `UILayout`         | UI 계약 선언 (templateSelector, columns) |
 * | `CollectionBinder` | DOM 조작 엔진 (clone, fill, listen)      |
 * | `UIComposer`       | 플러그인 진입점 — 두 레이어를 연결       |
 *
 * ## 설계 원칙
 *
 * ### FormBinder / DomainRenderer와의 관계
 * `UIComposer`는 두 플러그인을 **대체**한다.
 * v1.4.x에서 `FormBinder` / `DomainRenderer`에 `@deprecated` JSDoc이 추가된다.
 * 두 플러그인은 v2.x까지 제거하지 않는다.
 *
 * ### prototype 동적 확장 — TS 2339 억제 전략
 * `install(DomainStateClass)` 내부에서 `DomainStateClass.prototype`에 메서드를 추가한다.
 * TypeScript는 install() 이전 DomainState 타입을 알 수 없으므로
 * `@type {any}` cast로 TS 2339를 억제한다. 런타임에는 정상 동작한다.
 * `DomainCollection.prototype.bind` 확장도 동일한 이유로 cast를 사용한다.
 *
 * ## 소비자 API
 *
 * ```js
 * // 1. 플러그인 설치 (앱 진입점에서 1회)
 * DomainState.use(UIComposer);
 *
 * // 2. 단일 폼 바인딩 (DomainState)
 * const { unbind } = userState.bindSingle('#userForm', { layout: UserFormLayout });
 *
 * // 3. 그리드 바인딩 (DomainCollection)
 * const { addEmpty, removeChecked, validate } =
 *     certCollection.bind('#certGrid', {
 *         layout:  CertLayout,
 *         mode:    'edit',
 *         sources: { certTypes: certTypeCollection },
 *     });
 * ```
 *
 * @module ui/UIComposer
 * @see {@link module:ui/UILayout UILayout}
 * @see {@link module:ui/collection/CollectionBinder CollectionBinder}
 * @see {@link module:domain/DomainState DomainState}
 */

import { createCollectionBinder } from './collection/CollectionBinder.js';
import { DomainCollection } from '../domain/DomainCollection.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `bind()` / `bindSingle()` 메서드의 공통 `options` 파라미터.
 *
 * @typedef {object} BindOptions
 *
 * @property {typeof import('./UILayout.js').UILayout} layout
 *   UI 계약 선언 클래스.
 *
 * @property {'edit'|'read'} [mode='edit']
 *   렌더링 모드.
 *   - `'edit'`: `templateSelector` 사용. 입력 이벤트 리스너 등록.
 *   - `'read'`: `readonlyTemplateSelector` 사용. 이벤트 리스너 미등록.
 *
 * @property {Record<string, DomainCollection>} [sources={}]
 *   `<select>` 옵션 채우기용 소스 맵.
 *   `layout.columns[field].sourceKey`가 이 객체의 키와 매칭된다.
 *
 * @property {string} [selectAllSelector]
 *   전체선택 체크박스 CSS 선택자. `bind()` (그리드) 전용.
 */

/**
 * `bindSingle()` 반환값.
 *
 * @typedef {object} BindResult
 * @property {() => void} unbind - 이벤트 리스너 정리 함수. 컴포넌트 언마운트 시 호출.
 */

// ════════════════════════════════════════════════════════════════════════════════
// UIComposer 플러그인 객체
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainState.use(UIComposer)`으로 설치하는 플러그인 객체.
 *
 * 설치 시 다음 메서드가 추가된다:
 * - `DomainState.prototype.bindSingle()` — 단일 폼 양방향 바인딩
 * - `DomainCollection.prototype.bind()` — 그리드 바인딩 (CollectionBinder 위임)
 *
 * @type {import('../domain/DomainState.js').DsmPlugin}
 */
export const UIComposer = {
    /**
     * `DomainState`에 UIComposer 기능을 설치한다.
     *
     * `DomainState.use(UIComposer)` 호출 시 자동으로 실행된다.
     * `prototype` 동적 확장이므로 `@type {any}` cast로 TS 2339를 억제한다.
     *
     * @param {typeof import('../domain/DomainState.js').DomainState} DomainStateClass
     *   `DomainState` 클래스 참조. `prototype`에 메서드를 동적으로 추가한다.
     */
    install(DomainStateClass) {
        // ── bindSingle() — 단일 DomainState 폼 바인딩 ────────────────────────
        /**
         * 단일 `DomainState`를 HTML 폼 요소에 양방향 바인딩한다.
         *
         * `layout.columns`를 순회하여 각 필드의 `selector`로 요소를 탐색하고:
         * - 현재 도메인 데이터를 DOM에 채운다
         * - `mode: 'edit'` 시 `input`/`change` 이벤트로 `DomainState.data`를 즉시 갱신한다
         *
         * @this {import('../domain/DomainState.js').DomainState}
         * @param {string | Element} containerSelectorOrEl
         *   폼 컨테이너의 CSS 선택자 문자열 또는 DOM 요소.
         * @param {BindOptions} options
         *   바인딩 옵션. `layout` 필드가 필수.
         * @returns {BindResult} `{ unbind }` — 이벤트 리스너 정리 함수.
         * @throws {Error} 컨테이너 요소를 찾지 못한 경우.
         * @throws {Error} `sourceKey` 선언됐는데 `sources`에 없는 경우.
         */
        // prototype 동적 확장 — TS 2339 억제
        // @type {any} cast를 거치면 위 JSDoc 블록이 파라미터에 연결되지 않으므로
        // 함수 표현식 자체에 인라인 JSDoc을 추가하여 TS 7006을 해소한다.
        /** @type {any} */ (DomainStateClass.prototype).bindSingle =
            /**
             * @param {string | Element} containerSelectorOrEl - 폼 컨테이너 CSS 선택자 또는 DOM 요소
             * @param {BindOptions} options - 바인딩 옵션
             * @returns {BindResult}
             */
            function (containerSelectorOrEl, options) {
                const self = this;
                const { layout, mode = 'edit', sources = {} } = options;
                const containerEl = _resolveContainer(containerSelectorOrEl);
                const data = self._getTarget();

                /** @type {Array<{ el: Element, eventName: string, handler: EventListener }>} */
                const listeners = [];

                for (const [field, config] of Object.entries(layout.columns)) {
                    const el = containerEl.querySelector(config.selector);
                    if (!el) continue;

                    const tag = el.tagName.toLowerCase();

                    // sourceKey 선언된 <select> 옵션 채우기
                    if (tag === 'select' && config.sourceKey) {
                        const srcCollection = sources[config.sourceKey];
                        if (!srcCollection) {
                            throw new Error(
                                `[DSM] UIComposer.bindSingle(): columns에 선언된 ` +
                                    `sourceKey="${config.sourceKey}"가 sources 옵션에 없습니다.`
                            );
                        }
                        _populateSelectEl(
                            /** @type {HTMLSelectElement} */ (el),
                            srcCollection,
                            config.sourceValueField ?? 'id',
                            config.sourceLabelField ?? 'name'
                        );
                    }

                    // 현재 값 DOM에 채우기
                    _setElValue(el, /** @type {Record<string,*>} */ (data)[field] ?? '');

                    // edit 모드 + readOnly 아닌 필드만 이벤트 등록
                    if (mode === 'edit' && !config.readOnly) {
                        const eventName =
                            tag === 'select' ||
                            el.getAttribute('type') === 'checkbox' ||
                            el.getAttribute('type') === 'radio'
                                ? 'change'
                                : 'input';

                        /** @type {EventListener} */
                        const handler = () => {
                            /** @type {any} */ (self.data)[field] = _getElValue(el);
                        };

                        el.addEventListener(eventName, handler);
                        listeners.push({ el, eventName, handler });
                    }
                }

                return {
                    unbind() {
                        for (const { el, eventName, handler } of listeners) {
                            el.removeEventListener(eventName, handler);
                        }
                    },
                };
            };
    },
};

// ════════════════════════════════════════════════════════════════════════════════
// DomainCollection 확장 — prototype.bind()
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainCollection`에 그리드 DOM 바인딩 기능을 추가한다.
 *
 * `DomainState.use(UIComposer)` 호출과 함께 이 확장이 등록된다.
 * 내부적으로 `createCollectionBinder()`를 호출하여 DOM 조작을 위임한다.
 *
 * 소비자 사용 예:
 * ```js
 * DomainState.use(UIComposer);
 * const controls = certCollection.bind('#certGrid', {
 *     layout:  CertLayout,
 *     mode:    'edit',
 *     sources: { certTypes: certTypeCollection },
 * });
 * ```
 *
 * @param {string | Element} containerSelectorOrEl
 *   그리드 컨테이너의 CSS 선택자 문자열 또는 DOM 요소.
 * @param {BindOptions} options
 *   바인딩 옵션. `layout` 필드가 필수.
 * @returns {import('./collection/CollectionBinder.js').CollectionControls}
 *   컨트롤 함수 집합.
 * @throws {Error} 컨테이너 요소를 찾지 못한 경우.
 */
// prototype 동적 확장 — TS 2339 억제
/** @type {any} */ (DomainCollection.prototype).bind =
    /**
     * @param {string | Element} containerSelectorOrEl - 그리드 컨테이너 CSS 선택자 또는 DOM 요소
     * @param {BindOptions} options - 바인딩 옵션
     * @returns {import('./collection/CollectionBinder.js').CollectionControls}
     */
    function (containerSelectorOrEl, options) {
        const containerEl = _resolveContainer(containerSelectorOrEl);

        return createCollectionBinder(this, containerEl, {
            layout: options.layout,
            mode: options.mode ?? 'edit',
            sources: options.sources ?? {},
            selectAllSelector: options.selectAllSelector,
        });
    };

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 내부 유틸
// ════════════════════════════════════════════════════════════════════════════════

/**
 * CSS 선택자 문자열 또는 DOM 요소를 받아 DOM 요소를 반환한다.
 *
 * @param {string | Element} selectorOrEl - CSS 선택자 문자열 또는 DOM 요소 참조
 * @returns {Element} 탐색된 DOM 요소
 * @throws {Error} 선택자로 요소를 찾지 못한 경우
 */
function _resolveContainer(selectorOrEl) {
    if (selectorOrEl instanceof Element) return selectorOrEl;

    const el = document.querySelector(selectorOrEl);
    if (!el) {
        throw new Error(
            `[DSM] UIComposer: selector="${selectorOrEl}"인 컨테이너 요소를 찾을 수 없습니다.`
        );
    }
    return el;
}

/**
 * DOM 요소에 값을 설정한다.
 *
 * - `input[type=checkbox|radio]` : `checked` 속성
 * - `input` / `select` / `textarea` : `value` 속성
 * - 그 외 (`span`, `td` 등) : `textContent`
 *
 * @param {Element} el    - 값을 설정할 DOM 요소
 * @param {*}       value - 설정할 값. `null` / `undefined`이면 빈 문자열로 처리.
 */
function _setElValue(el, value) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
        const inputEl = /** @type {HTMLInputElement} */ (el);
        if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
            inputEl.checked = Boolean(value);
        } else {
            inputEl.value = value == null ? '' : String(value);
        }
    } else if (tag === 'select' || tag === 'textarea') {
        /** @type {HTMLSelectElement | HTMLTextAreaElement} */ (el).value =
            value == null ? '' : String(value);
    } else {
        el.textContent = value == null ? '' : String(value);
    }
}

/**
 * DOM 요소의 현재 값을 읽는다.
 *
 * @param {Element} el - 값을 읽을 DOM 요소
 * @returns {string | boolean} 요소의 현재 값
 */
function _getElValue(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
        const inputEl = /** @type {HTMLInputElement} */ (el);
        if (inputEl.type === 'checkbox' || inputEl.type === 'radio') return inputEl.checked;
        return inputEl.value;
    }
    if (tag === 'select' || tag === 'textarea') {
        return /** @type {HTMLSelectElement | HTMLTextAreaElement} */ (el).value;
    }
    return el.textContent ?? '';
}

/**
 * `<select>` 요소에 DomainCollection 항목으로 `<option>`을 채운다.
 *
 * 기존 옵션을 모두 제거한 뒤 컬렉션 항목으로 새로 생성한다.
 *
 * @param {HTMLSelectElement} selectEl   - 옵션을 채울 `<select>` 요소
 * @param {DomainCollection}  collection - 옵션 소스 컬렉션
 * @param {string}            valueField - `<option value>` 기준 필드명
 * @param {string}            labelField - `<option>` 텍스트 기준 필드명
 */
function _populateSelectEl(selectEl, collection, valueField, labelField) {
    selectEl.innerHTML = '';
    for (const item of collection.getItems()) {
        const d = /** @type {Record<string, *>} */ (item._getTarget());
        const opt = document.createElement('option');
        opt.value = d[valueField] == null ? '' : String(d[valueField]);
        opt.textContent = d[labelField] == null ? '' : String(d[labelField]);
        selectEl.appendChild(opt);
    }
}
