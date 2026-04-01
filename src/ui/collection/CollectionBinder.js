/**
 * CollectionBinder — 1:N 그리드 UI 바인딩 엔진 (MVP)
 *
 * `DomainCollection` 또는 `DomainState` 내부 배열 필드를 HTML `<template>` 기반
 * 그리드 DOM에 바인딩하고, 행(row) 추가/제거/선택/검증 컨트롤 함수를 반환한다.
 *
 * ## 소비자 API
 * `bindCollection()` 호출이 이 모듈의 `createCollectionBinder()` 팩토리를 내부에서 사용한다.
 * 소비자는 반환된 함수를 destructuring하여 원하는 버튼/이벤트에 직접 연결한다.
 *
 * ```js
 * const { addEmpty, removeChecked, selectAll, validate } =
 *     certCollection.bind('#certGrid', { layout: CertLayout, mode: 'edit' });
 *
 * document.getElementById('btnAdd').onclick    = addEmpty;
 * document.getElementById('btnRemove').onclick = removeChecked;
 * ```
 *
 * ## 내부 이벤트 위임
 * 개별 행 체크박스(`.dsm-checkbox`) 클릭은 컨테이너에 위임된 단일 이벤트 리스너로 처리한다.
 * 소비자가 직접 바인딩하는 것은 허용하지 않는다.
 *
 * ## Reactive 바인딩
 * 행 내부 `input` / `select` / `textarea` 변경은 즉시 `DomainState.data[field]`에 반영된다.
 * `lazy` tracking mode에서도 값 자체는 Proxy를 통해 직접 반영되며,
 * changeLog 기록만 건너뛴다.
 *
 * @module ui/collection/CollectionBinder
 * @see {@link module:ui/UILayout UILayout}
 * @see {@link module:domain/DomainCollection DomainCollection}
 */

/**
 * JSDoc 전용 타입 참조 — 런타임 import 없음.
 * `DomainCollection` / `DomainState`는 이 모듈에서 instanceof 검사 없이
 * 소비자에게서 주입된 인스턴스를 그대로 사용하므로 런타임 의존이 불필요하다.
 *
 * @typedef {import('../../domain/DomainCollection.js').DomainCollection} DomainCollection
 * @typedef {import('../../domain/DomainState.js').DomainState} DomainState
 */

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `createCollectionBinder()`의 반환값.
 * 소비자가 destructuring하여 사용하는 컨트롤 함수 집합.
 *
 * @typedef {object} CollectionControls
 * @property {() => DomainState}   addEmpty        - 빈 행 추가. 새로 생성된 DomainState 반환.
 * @property {() => void}          removeChecked   - 체크된 행 삭제 (역순 LIFO 정렬 보장).
 * @property {() => void}          removeAll       - 전체 행 삭제.
 * @property {(checked: boolean) => void} selectAll - 전체 행 선택/해제.
 * @property {() => void}          invertSelection - 선택 반전.
 * @property {() => boolean}       validate        - 필수 필드 검증. 유효하면 `true`.
 * @property {() => DomainState[]} getCheckedItems - 체크된 DomainState 목록 반환.
 * @property {() => DomainState[]} getItems        - 전체 DomainState 목록 반환.
 * @property {() => number}        getCount        - 총 행 수 반환.
 * @property {() => void}          destroy         - 이벤트 리스너 정리.
 */

/**
 * `createCollectionBinder()`의 `options` 파라미터.
 *
 * @typedef {object} CollectionBinderOptions
 * @property {typeof import('../UILayout.js').UILayout} layout
 *   UI 계약 선언 클래스.
 * @property {'edit'|'read'} [mode='edit']
 *   렌더링 모드.
 * @property {Record<string, DomainCollection>} [sources={}]
 *   `<select>` 요소 채우기용 DomainCollection 소스 맵.
 *   `layout.columns[field].sourceKey`가 이 객체의 키와 매칭된다.
 * @property {string} [selectAllSelector]
 *   그리드 외부의 "전체선택" 체크박스 CSS 선택자.
 *   지정 시 모든 행 체크 상태 변경 시 자동으로 동기화된다.
 */

// ════════════════════════════════════════════════════════════════════════════════
// 내부 유틸
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `<input>` / `<select>` / `<textarea>` 요소에 값을 채운다.
 *
 * - `checkbox` / `radio` : `checked` 속성 설정
 * - `select-one`         : `value` 설정 (option이 없으면 no-op)
 * - 나머지               : `value` 설정
 *
 * DOM 요소가 form 요소가 아닌 경우(`span`, `td` 등) `textContent`로 채운다.
 *
 * @param {Element | null} el    - 대상 DOM 요소
 * @param {*}              value - 채울 값
 */
function _setElementValue(el, value) {
    if (!el) return;

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
        // span, td, div 등 텍스트 노드만
        el.textContent = value == null ? '' : String(value);
    }
}

/**
 * `<input>` / `<select>` / `<textarea>` 요소의 현재 값을 읽는다.
 *
 * @param {Element | null} el - 대상 DOM 요소
 * @returns {string | boolean}
 */
function _getElementValue(el) {
    if (!el) return '';

    const tag = el.tagName.toLowerCase();

    if (tag === 'input') {
        const inputEl = /** @type {HTMLInputElement} */ (el);
        if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
            return inputEl.checked;
        }
        return inputEl.value;
    }
    if (tag === 'select' || tag === 'textarea') {
        return /** @type {HTMLSelectElement | HTMLTextAreaElement} */ (el).value;
    }
    return el.textContent ?? '';
}

/**
 * DomainState의 현재 데이터를 행 DOM에 채운다.
 *
 * `layout.columns`를 순회하여 각 필드의 `selector`로 요소를 찾고 값을 설정한다.
 *
 * @param {Element}   rowEl   - 행 DOM 요소
 * @param {DomainState} state - 데이터 소스
 * @param {typeof import('../UILayout.js').UILayout} layout - UILayout 클래스
 */
function _fillRow(rowEl, state, layout) {
    const data = state._getTarget();
    for (const [field, config] of Object.entries(layout.columns)) {
        const el = rowEl.querySelector(config.selector);
        _setElementValue(el, /** @type {Record<string,*>} */ (data)[field] ?? '');
    }
}

/**
 * `<select>` 요소에 DomainCollection 항목으로 `<option>`을 채운다.
 *
 * 기존 `<option>` 목록을 모두 제거한 뒤 새로 생성한다.
 *
 * @param {HTMLSelectElement} selectEl    - 대상 `<select>` 요소
 * @param {DomainCollection}  collection  - 옵션 소스
 * @param {string}            valueField  - `<option value>` 기준 필드명
 * @param {string}            labelField  - `<option>` 텍스트 기준 필드명
 */
function _populateSelect(selectEl, collection, valueField, labelField) {
    selectEl.innerHTML = '';
    for (const item of collection.getItems()) {
        const d = /** @type {Record<string, *>} */ (item._getTarget());
        const opt = document.createElement('option');
        opt.value = d[valueField] == null ? '' : String(d[valueField]);
        opt.textContent = d[labelField] == null ? '' : String(d[labelField]);
        selectEl.appendChild(opt);
    }
}

/**
 * 행 DOM에 `input` / `change` 이벤트 리스너를 등록하여
 * DOM 값 변경이 `DomainState.data[field]`에 즉시 반영되도록 한다.
 *
 * Reactive 바인딩 핵심 로직.
 *
 * @param {Element}   rowEl   - 행 DOM 요소
 * @param {DomainState} state - 데이터 동기화 대상
 * @param {typeof import('../UILayout.js').UILayout} layout - UILayout 클래스
 */
function _setupRowInputListeners(rowEl, state, layout) {
    for (const [field, config] of Object.entries(layout.columns)) {
        if (config.readOnly) continue;

        const el = rowEl.querySelector(config.selector);
        if (!el) continue;

        const tag = el.tagName.toLowerCase();
        const eventName =
            tag === 'select' ||
            el.getAttribute('type') === 'checkbox' ||
            el.getAttribute('type') === 'radio'
                ? 'change'
                : 'input';

        el.addEventListener(eventName, () => {
            const value = _getElementValue(el);
            /** @type {any} */ (state.data)[field] = value;
        });
    }
}

/**
 * 행 번호 자동 갱신.
 * `.dsm-row-number` CSS 클래스를 가진 요소에 1-based 행 번호를 설정한다.
 *
 * @param {Element} containerEl - 그리드 컨테이너 요소
 */
function _updateRowNumbers(containerEl) {
    let idx = 1;
    for (const rowEl of Array.from(containerEl.children)) {
        const numEl = rowEl.querySelector('.dsm-row-number');
        if (numEl) numEl.textContent = String(idx);
        idx++;
    }
}

/**
 * 전체선택 체크박스 상태를 현재 행 체크 상태에 맞게 동기화한다.
 *
 * @param {Element}           containerEl       - 그리드 컨테이너
 * @param {string | undefined} selectAllSelector - 전체선택 체크박스 CSS 선택자
 */
function _syncSelectAll(containerEl, selectAllSelector) {
    if (!selectAllSelector) return;
    const selectAllEl = /** @type {HTMLInputElement | null} */ (
        document.querySelector(selectAllSelector)
    );
    if (!selectAllEl) return;

    const checkboxes = Array.from(containerEl.querySelectorAll('.dsm-checkbox'));
    if (checkboxes.length === 0) {
        selectAllEl.checked = false;
        return;
    }
    const allChecked = checkboxes.every((cb) => /** @type {HTMLInputElement} */ (cb).checked);
    selectAllEl.checked = allChecked;
}

// ════════════════════════════════════════════════════════════════════════════════
// 공개 팩토리
// ════════════════════════════════════════════════════════════════════════════════

/**
 * CollectionBinder 인스턴스를 생성하고 컨트롤 함수 집합을 반환한다.
 *
 * `UIComposer`의 `bindCollection()` / `DomainCollection.prototype.bind()` 내부에서 호출된다.
 * 소비자가 직접 호출하지 않는다.
 *
 * @param {DomainCollection}       collection    - 바인딩 대상 컬렉션
 * @param {Element}                containerEl   - 그리드 컨테이너 DOM 요소
 * @param {CollectionBinderOptions} options      - 바인더 옵션
 * @returns {CollectionControls} 컨트롤 함수 집합
 */
export function createCollectionBinder(collection, containerEl, options) {
    const { layout, mode = 'edit', sources = {}, selectAllSelector } = options;

    // ── 템플릿 탐색 ───────────────────────────────────────────────────────────
    const template = layout.getTemplate(mode);
    // ─────────────────────────────────────────────────────────────────────────

    // ── rowEl ↔ DomainState 매핑 ──────────────────────────────────────────────
    // WeakMap: rowEl이 DOM에서 제거되면 자동으로 GC 대상
    /** @type {WeakMap<Element, DomainState>} */
    const rowStateMap = new WeakMap();
    // ─────────────────────────────────────────────────────────────────────────

    // ── 초기 렌더링 — 기존 컬렉션 항목을 DOM에 그린다 ────────────────────────
    for (const state of collection.getItems()) {
        const rowEl = layout.cloneRow(template);
        _fillRow(rowEl, state, layout);
        _populateSourceSelects(rowEl, layout, sources);
        if (mode === 'edit') _setupRowInputListeners(rowEl, state, layout);
        rowStateMap.set(rowEl, state);
        containerEl.appendChild(rowEl);
    }
    _updateRowNumbers(containerEl);
    // ─────────────────────────────────────────────────────────────────────────

    // ── 이벤트 위임: 개별 행 체크박스(selectOne) ─────────────────────────────
    // 소비자가 직접 바인딩하지 않고 컨테이너에 위임하여 동적 DOM을 지원한다.
    /**
     * @param {Event} e - 위임된 클릭 이벤트 객체
     */
    function _onContainerClick(e) {
        const target = /** @type {Element} */ (e.target);
        if (
            target instanceof HTMLInputElement &&
            target.type === 'checkbox' &&
            target.classList.contains('dsm-checkbox')
        ) {
            _syncSelectAll(containerEl, selectAllSelector);
        }
    }
    containerEl.addEventListener('click', _onContainerClick);
    // ─────────────────────────────────────────────────────────────────────────

    // ════════════════════════════════════════════════════════════════════════
    // 내부 헬퍼 (클로저)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * 행 DOM에 `<select>` sourceKey 옵션을 채운다.
     *
     * @param {Element} rowEl - 행 DOM 요소
     * @param {typeof import('../UILayout.js').UILayout} _layout - UILayout 클래스
     * @param {Record<string, DomainCollection>} _sources - sourceKey → DomainCollection 소스 맵
     */
    function _populateSourceSelects(rowEl, _layout, _sources) {
        for (const [, config] of Object.entries(_layout.columns)) {
            if (!config.sourceKey) continue;

            const sourceCollection = _sources[config.sourceKey];
            if (!sourceCollection) {
                // sourceKey 선언됐는데 sources에 없음 → Silent Failure 불허
                throw new Error(
                    `[DSM] CollectionBinder: columns에 선언된 sourceKey="${config.sourceKey}"가 ` +
                        'sources 옵션에 없습니다. ' +
                        `bindCollection() 호출 시 sources: { ${config.sourceKey}: collection }을 전달하세요.`
                );
            }

            const selectEl = /** @type {HTMLSelectElement | null} */ (
                rowEl.querySelector(config.selector)
            );
            if (selectEl instanceof HTMLSelectElement) {
                _populateSelect(
                    selectEl,
                    sourceCollection,
                    config.sourceValueField ?? 'id',
                    config.sourceLabelField ?? 'name'
                );
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 컨트롤 함수
    // ════════════════════════════════════════════════════════════════════════

    /**
     * 빈 행을 컬렉션과 DOM에 추가한다.
     *
     * 1. `collection.add({})` 로 새 DomainState 생성
     * 2. `<template>` 복제
     * 3. sourceKey 선언된 `<select>` 옵션 채우기
     * 4. Reactive input 리스너 등록
     * 5. 컨테이너 끝에 추가
     * 6. 행 번호 갱신
     *
     * @returns {DomainState} 생성된 DomainState 인스턴스
     */
    function addEmpty() {
        const newState = collection.add({});
        const rowEl = layout.cloneRow(template);

        _populateSourceSelects(rowEl, layout, sources);
        if (mode === 'edit') _setupRowInputListeners(rowEl, newState, layout);
        rowStateMap.set(rowEl, newState);
        containerEl.appendChild(rowEl);
        _updateRowNumbers(containerEl);
        _syncSelectAll(containerEl, selectAllSelector);
        return newState;
    }

    /**
     * 체크된 행을 역순(LIFO)으로 컬렉션과 DOM에서 제거한다.
     *
     * 정방향 제거는 인덱스 밀림으로 잘못된 항목이 삭제된다.
     * 반드시 내림차순 정렬 후 제거해야 한다.
     */
    function removeChecked() {
        const rows = Array.from(containerEl.children);

        // 체크된 행의 인덱스 수집 → 내림차순 정렬 (LIFO)
        const indices = rows
            .map((rowEl, idx) => {
                const cb = /** @type {HTMLInputElement | null} */ (
                    rowEl.querySelector('.dsm-checkbox')
                );
                return cb?.checked ? idx : -1;
            })
            .filter((idx) => idx >= 0)
            .sort((a, b) => b - a); // 내림차순

        for (const idx of indices) {
            collection.remove(idx);
            rows[idx].remove();
        }

        _updateRowNumbers(containerEl);
        _syncSelectAll(containerEl, selectAllSelector);
    }

    /**
     * 모든 행을 컬렉션과 DOM에서 제거한다.
     */
    function removeAll() {
        // 내림차순으로 전체 제거
        const count = collection.getCount();
        for (let i = count - 1; i >= 0; i--) {
            collection.remove(i);
        }
        containerEl.innerHTML = '';
        _syncSelectAll(containerEl, selectAllSelector);
    }

    /**
     * 모든 행 체크박스 상태를 일괄 설정한다.
     *
     * @param {boolean} checked - 체크 여부
     */
    function selectAll(checked) {
        for (const rowEl of Array.from(containerEl.children)) {
            const cb = /** @type {HTMLInputElement | null} */ (
                rowEl.querySelector('.dsm-checkbox')
            );
            if (cb) cb.checked = checked;
        }
        _syncSelectAll(containerEl, selectAllSelector);
    }

    /**
     * 현재 체크 상태를 반전한다.
     */
    function invertSelection() {
        for (const rowEl of Array.from(containerEl.children)) {
            const cb = /** @type {HTMLInputElement | null} */ (
                rowEl.querySelector('.dsm-checkbox')
            );
            if (cb) cb.checked = !cb.checked;
        }
        _syncSelectAll(containerEl, selectAllSelector);
    }

    /**
     * `required: true` 필드를 검증하고 유효성 여부를 반환한다.
     *
     * 빈 값인 필드의 입력 요소에 `is-invalid` CSS 클래스를 추가하고
     * 인접한 `.invalid-feedback` 요소에 메시지를 설정한다.
     * 유효한 필드는 `is-invalid`를 제거한다.
     *
     * @returns {boolean} 모든 required 필드가 유효하면 `true`
     */
    function validate() {
        let isValid = true;

        for (const rowEl of Array.from(containerEl.children)) {
            for (const [field, config] of Object.entries(layout.columns)) {
                if (!config.required) continue;

                const el = rowEl.querySelector(config.selector);
                if (!el) continue;

                const value = _getElementValue(el);
                const isEmpty = value === '' || value === false || value == null;

                if (isEmpty) {
                    isValid = false;
                    el.classList.add('is-invalid');
                    // .invalid-feedback 요소에 메시지 설정
                    const feedbackEl = el.nextElementSibling;
                    if (feedbackEl?.classList.contains('invalid-feedback')) {
                        feedbackEl.textContent = `${field} 필드는 필수입니다.`;
                    }
                } else {
                    el.classList.remove('is-invalid');
                    const feedbackEl = el.nextElementSibling;
                    if (feedbackEl?.classList.contains('invalid-feedback')) {
                        feedbackEl.textContent = '';
                    }
                }
            }
        }

        return isValid;
    }

    /**
     * 체크된 행의 DomainState 목록을 반환한다.
     *
     * @returns {DomainState[]}
     */
    function getCheckedItems() {
        return Array.from(containerEl.children)
            .filter((rowEl) => {
                const cb = /** @type {HTMLInputElement | null} */ (
                    rowEl.querySelector('.dsm-checkbox')
                );
                return cb?.checked === true;
            })
            .map((rowEl) => rowStateMap.get(rowEl))
            .filter(
                /** @param {DomainState | undefined} s @returns {s is DomainState} */
                (s) => s !== undefined
            );
    }

    /**
     * 등록된 이벤트 리스너를 제거한다.
     * 컴포넌트 언마운트 시 호출하여 메모리 누수를 방지한다.
     */
    function destroy() {
        containerEl.removeEventListener('click', _onContainerClick);
    }

    // ── 컨트롤 함수 집합 반환 ─────────────────────────────────────────────────
    return {
        addEmpty,
        removeChecked,
        removeAll,
        selectAll,
        invertSelection,
        validate,
        getCheckedItems,
        getItems: () => collection.getItems(),
        getCount: () => collection.getCount(),
        destroy,
    };
}
