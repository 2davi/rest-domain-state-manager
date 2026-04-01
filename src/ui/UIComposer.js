/**
 * UIComposer — DomainState / DomainCollection UI 바인딩 플러그인
 *
 * `DomainState.use(UIComposer)` 호출로 설치하면
 * `DomainState.prototype`에 `bind()` / `bindCollection()` 메서드가 추가된다.
 *
 * ## 역할 분리
 *
 * | 레이어           | 책임                                    |
 * |------------------|-----------------------------------------|
 * | `UILayout`       | UI 계약 선언 (templateSelector, columns) |
 * | `CollectionBinder` | DOM 조작 엔진 (clone, fill, listen)   |
 * | `UIComposer`     | 플러그인 진입점 — 두 레이어를 연결      |
 *
 * ## 설계 원칙
 *
 * ### FormBinder / DomainRenderer와의 관계
 * `UIComposer`는 두 플러그인을 **대체**한다.
 * `FormBinder`(DOM-first)와 `DomainRenderer`(State-first) 모두 단방향이지만
 * `UIComposer`는 양방향 바인딩을 지원한다.
 *
 * v1.4.x에서 `FormBinder` / `DomainRenderer`에 `@deprecated` JSDoc이 추가된다.
 * 두 플러그인은 v2.x까지 제거하지 않는다.
 *
 * ## 소비자 API
 *
 * ```js
 * // 1. 플러그인 설치 (앱 진입점에서 1회)
 * DomainState.use(UIComposer);
 *
 * // 2. 단일 폼 바인딩 (DomainState)
 * const { unbind } = user.bind('#userForm', { layout: UserFormLayout });
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
import { DomainCollection }       from '../domain/DomainCollection.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `bind()` 메서드의 `options` 파라미터.
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
 * @property {string} [containerSelector]
 *   컨테이너 DOM 요소의 CSS 선택자.
 *   `bindCollection()` 사용 시 DOM 요소를 직접 전달하는 대신 선택자를 사용할 수 있다.
 *
 * @property {Record<string, DomainCollection>} [sources={}]
 *   `<select>` 옵션 채우기용 소스 맵.
 *   `layout.columns[field].sourceKey`가 이 객체의 키와 매칭된다.
 *
 * @property {string} [selectAllSelector]
 *   전체선택 체크박스 CSS 선택자. `bindCollection()` 전용.
 */

/**
 * `DomainState.prototype.bind()` 반환값.
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
 * 설치 시 `DomainState.prototype`에 다음 메서드가 추가된다:
 * - `bind(containerSelectorOrEl, options)` — `DomainCollection` 그리드 바인딩
 *
 * `DomainState.prototype.bindSingle(containerSelectorOrEl, options)` 도 추가된다:
 * - 단일 `DomainState` 폼 바인딩 (v1.4.x MVP)
 *
 * @type {import('../domain/DomainState.js').DsmPlugin}
 */
export const UIComposer = {
    /**
     * `DomainState`에 UIComposer 기능을 설치한다.
     *
     * `DomainState.use(UIComposer)` 호출 시 자동으로 실행된다.
     *
     * @param {typeof import('../domain/DomainState.js').DomainState} DomainStateClass
     */
    install(DomainStateClass) {
        // ── bind() — DomainCollection 그리드 바인딩 ──────────────────────────
        /**
         * `DomainCollection`에 연결된 그리드 DOM을 바인딩하고 컨트롤 함수 집합을 반환한다.
         *
         * `DomainCollection.prototype.bind()`가 내부적으로 이 메서드를 사용한다.
         * 단일 `DomainState`에서 직접 호출하려면 `bindSingle()`을 사용한다.
         *
         * ## 처리 흐름
         * ```
         * 컨테이너 탐색
         *   ↓ layout.getTemplate(mode)
         * <template> 복제
         *   ↓ createCollectionBinder(collection, containerEl, options)
         * CollectionControls 반환
         * ```
         *
         * @this {import('../domain/DomainState.js').DomainState}
         * @param {string | Element} containerSelectorOrEl
         *   그리드 컨테이너 CSS 선택자 또는 DOM 요소.
         * @param {BindOptions & { collection: DomainCollection }} options
         *   바인딩 옵션. `collection` 필드가 필수.
         * @returns {import('./collection/CollectionBinder.js').CollectionControls}
         * @throws {Error} 컨테이너 요소를 찾지 못한 경우
         * @throws {Error} `collection`이 `DomainCollection` 인스턴스가 아닌 경우
         */
        DomainStateClass.prototype._bindCollection = function (
            containerSelectorOrEl,
            options
        ) {
            const { collection, layout, mode = 'edit', sources = {}, selectAllSelector } = options;

            if (!(collection instanceof DomainCollection)) {
                throw new TypeError(
                    '[DSM] UIComposer.bind(): collection은 DomainCollection 인스턴스여야 합니다.'
                );
            }

            const containerEl = _resolveContainer(containerSelectorOrEl);

            return createCollectionBinder(collection, containerEl, {
                layout,
                mode,
                sources,
                selectAllSelector,
            });
        };

        // ── bindSingle() — 단일 DomainState 폼 바인딩 ────────────────────────
        /**
         * 단일 `DomainState`를 HTML 폼 요소에 양방향 바인딩한다.
         *
         * `layout.columns`를 순회하여 각 필드를 `selector`로 찾고:
         * - 현재 값을 DOM에 채운다
         * - `mode: 'edit'` 시 `input`/`change` 이벤트로 `DomainState.data`에 반영한다
         *
         * @this {import('../domain/DomainState.js').DomainState}
         * @param {string | Element} containerSelectorOrEl
         *   폼 컨테이너 CSS 선택자 또는 DOM 요소.
         * @param {BindOptions} options - 바인딩 옵션.
         * @returns {BindResult} `{ unbind }` — 이벤트 리스너 정리 함수.
         * @throws {Error} 컨테이너 요소를 찾지 못한 경우.
         */
        DomainStateClass.prototype.bindSingle = function (
            containerSelectorOrEl,
            options
        ) {
            const self = this;
            const { layout, mode = 'edit', sources = {} } = options;
            const containerEl = _resolveContainer(containerSelectorOrEl);
            const data = self._getTarget();

            /** @type {Array<{ el: Element, eventName: string, handler: EventListenerOrEventListenerObject }>} */
            const listeners = [];

            for (const [field, config] of Object.entries(layout.columns)) {
                const el = containerEl.querySelector(config.selector);
                if (!el) continue;

                // ── 값 채우기 ────────────────────────────────────────────────
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

                // 현재 값 설정
                _setElValue(el, /** @type {Record<string,*>} */ (data)[field] ?? '');

                // ── 이벤트 바인딩 (edit 모드만) ──────────────────────────────
                if (mode === 'edit' && !config.readOnly) {
                    const eventName = (tag === 'select' ||
                        el.getAttribute('type') === 'checkbox' ||
                        el.getAttribute('type') === 'radio')
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
 * `DomainCollection.prototype.bind()`를 추가한다.
 *
 * `UIComposer` 플러그인이 설치되어 있어야 한다.
 * 미설치 시 즉시 에러를 throw한다.
 *
 * 소비자 사용 예:
 * ```js
 * DomainState.use(UIComposer); // 설치
 * const controls = certCollection.bind('#certGrid', {
 *     layout:  CertLayout,
 *     mode:    'edit',
 *     sources: { certTypes: certTypeCollection },
 * });
 * ```
 *
 * @param {string | Element} containerSelectorOrEl - 컨테이너 선택자 또는 요소
 * @param {BindOptions} options - 바인딩 옵션
 * @returns {import('./collection/CollectionBinder.js').CollectionControls}
 */
DomainCollection.prototype.bind = function (containerSelectorOrEl, options) {
    if (typeof /** @type {any} */ (this)._bindCollection !== 'function') {
        // UIComposer가 DomainState에 설치되기 전에 호출됨
        // DomainCollection.bind()는 DomainState 임시 인스턴스를 생성하지 않고
        // createCollectionBinder를 직접 호출한다.
        throw new Error(
            '[DSM] DomainCollection.bind(): UIComposer 플러그인이 설치되지 않았습니다. ' +
            'DomainState.use(UIComposer)를 먼저 호출하세요.'
        );
    }

    const containerEl = _resolveContainer(containerSelectorOrEl);

    return createCollectionBinder(this, containerEl, {
        layout:              options.layout,
        mode:                options.mode ?? 'edit',
        sources:             options.sources ?? {},
        selectAllSelector:   options.selectAllSelector,
    });
};

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 내부 유틸
// ════════════════════════════════════════════════════════════════════════════════

/**
 * CSS 선택자 문자열 또는 DOM 요소를 받아 DOM 요소를 반환한다.
 *
 * @param {string | Element} selectorOrEl
 * @returns {Element}
 * @throws {Error} 요소를 찾지 못한 경우
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
 * @param {Element} el
 * @param {*} value
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
 * @param {Element} el
 * @returns {string | boolean}
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
 * `<select>` 요소에 DomainCollection 항목으로 옵션을 채운다.
 *
 * @param {HTMLSelectElement} selectEl
 * @param {DomainCollection}  collection
 * @param {string}            valueField
 * @param {string}            labelField
 */
function _populateSelectEl(selectEl, collection, valueField, labelField) {
    selectEl.innerHTML = '';
    for (const item of collection.getItems()) {
        const d = /** @type {Record<string, *>} */ (item._getTarget());
        const opt = document.createElement('option');
        opt.value       = d[valueField] == null ? '' : String(d[valueField]);
        opt.textContent = d[labelField] == null ? '' : String(d[labelField]);
        selectEl.appendChild(opt);
    }
}
