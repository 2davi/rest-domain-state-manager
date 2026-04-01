/**
 * UILayout — 화면 단위 UI 계약 선언 베이스 클래스
 *
 * `DomainVO`가 데이터 계약을 선언하듯, `UILayout`은 UI 계약을 선언한다.
 * 동일한 `DomainVO`(또는 `DomainState`)로 여러 화면에서 다른 `UILayout`을 사용할 수 있다.
 *
 * ## 설계 원칙
 *
 * ### HTML `<template>` 기반 — DOM 구조 통제권은 HTML 작성자에게
 * 라이브러리는 `<template>` 요소를 복제하여 데이터를 `selector`로 지정된 요소에 채울 뿐이다.
 * CSS 클래스, 중첩 구조, Bootstrap/Tailwind 레이아웃에 전혀 관여하지 않는다.
 *
 * ### `UIComposer` 플러그인 미설치 시 에러 throw
 * `bind()` / `bindCollection()` 호출은 `UIComposer` 플러그인이 설치된 이후에만 동작한다.
 * 미설치 상태에서 호출하면 즉시 명확한 에러를 throw한다.
 *
 * ### `readonlyTemplateSelector` 미선언 + `mode: 'read'` → 즉시 에러
 * 조용히 잘못된 레이아웃을 렌더링하는 Silent Failure를 허용하지 않는다.
 *
 * ## 서브클래스 선언 예시
 *
 * ```js
 * class CertificateEditLayout extends UILayout {
 *     static templateSelector         = '#certRowTemplate';
 *     static readonlyTemplateSelector = '#certRowReadTemplate'; // 선택
 *     static itemKey  = 'certId';
 *
 *     static columns = {
 *         certId:   { selector: '[data-field="certId"]' },
 *         certName: { selector: '[data-field="certName"]', required: true },
 *         certType: {
 *             selector:        '[data-field="certType"]',
 *             sourceKey:       'certTypes',
 *             sourceValueField: 'codeId',
 *             sourceLabelField: 'codeName',
 *         },
 *     };
 * }
 * ```
 *
 * @module ui/UILayout
 * @see {@link module:ui/UIComposer UIComposer}
 */

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `UILayout.static columns`에 선언하는 단일 컬럼 매핑 객체.
 *
 * @typedef {object} ColumnConfig
 *
 * @property {string} selector
 *   해당 필드 데이터를 채울 DOM 요소의 CSS 선택자.
 *   `<template>` 복제본 내부에서 `querySelector(selector)`로 탐색한다.
 *   예: `'[data-field="certName"]'`, `'input[name="certName"]'`
 *
 * @property {boolean} [required=false]
 *   `true`이면 `validate()` 호출 시 빈 값을 invalid로 처리한다.
 *   해당 요소에 `is-invalid` CSS 클래스가 추가되고 `.invalid-feedback` 요소에 메시지가 표시된다.
 *
 * @property {boolean} [readOnly=false]
 *   `true`이면 해당 필드를 읽기 전용으로 처리한다.
 *   `UIComposer`가 이 필드에 대한 `input` 이벤트 리스너를 등록하지 않는다.
 *
 * @property {string} [sourceKey]
 *   `<select>` 요소의 `<option>`을 채울 `DomainCollection`의 소스 키.
 *   `bindCollection()` 호출 시 `sources: { [sourceKey]: DomainCollection }` 형태로 주입한다.
 *   미지정 시 소스 연결 없이 `<select>`를 그대로 유지한다.
 *
 * @property {string} [sourceValueField='id']
 *   `sourceKey` 지정 시 `<option value="...">` 에 사용할 DomainCollection 항목의 필드명.
 *   기본값 `'id'`.
 *
 * @property {string} [sourceLabelField='name']
 *   `sourceKey` 지정 시 `<option>` 텍스트에 사용할 DomainCollection 항목의 필드명.
 *   기본값 `'name'`.
 */

/**
 * `UILayout.static columns`의 전체 선언 형태.
 * 키는 `DomainState.data`의 필드명, 값은 `ColumnConfig` 객체다.
 *
 * @typedef {Record<string, ColumnConfig>} ColumnsSchema
 */

// ════════════════════════════════════════════════════════════════════════════════
// UILayout 클래스
// ════════════════════════════════════════════════════════════════════════════════

export class UILayout {
    // ── 서브클래스가 선언하는 static fields ──────────────────────────────────

    /**
     * 편집 모드 `<template>` 요소의 CSS 선택자.
     *
     * `mode: 'edit'`(기본) 또는 `mode`가 지정되지 않을 때 이 템플릿을 복제한다.
     * 서브클래스에서 반드시 선언해야 한다. 미선언 시 `bind()` / `bindCollection()` 호출에서 에러.
     *
     * @type {string | undefined}
     */
    static templateSelector = undefined;

    /**
     * 읽기 전용 모드 `<template>` 요소의 CSS 선택자.
     *
     * `mode: 'read'`로 호출 시 이 템플릿을 복제한다.
     * 미선언 시 `mode: 'read'`로 `bind()` / `bindCollection()`을 호출하면 즉시 에러를 throw한다.
     * 조용히 잘못된 레이아웃을 렌더링하는 Silent Failure를 허용하지 않는다.
     *
     * @type {string | undefined}
     */
    static readonlyTemplateSelector = undefined;

    /**
     * `lazy` tracking mode diff 연산의 배열 항목 동일성 기준 필드명.
     *
     * `DomainState.fromJSON()` / `DomainCollection.fromJSONArray()`의
     * `itemKey` 옵션으로 전달된다.
     * 미선언 시 positional fallback이 적용된다.
     *
     * @type {string | undefined}
     */
    static itemKey = undefined;

    /**
     * 필드명 → DOM 매핑 선언.
     * 키는 `DomainState.data`의 필드명, 값은 `ColumnConfig` 객체다.
     *
     * @type {ColumnsSchema}
     */
    static columns = {};

    // ════════════════════════════════════════════════════════════════════════════
    // 공개 유틸 (static)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 지정된 모드에 맞는 `<template>` 요소를 반환한다.
     *
     * - `mode: 'edit'` (기본): `static templateSelector`로 탐색
     * - `mode: 'read'`: `static readonlyTemplateSelector`로 탐색
     *
     * 탐색 실패 시 즉시 명확한 에러를 throw한다.
     *
     * @param {'edit'|'read'} [mode='edit'] - 렌더링 모드
     * @returns {HTMLTemplateElement} 탐색된 `<template>` 요소
     * @throws {Error} selector가 선언되지 않은 경우
     * @throws {Error} selector로 DOM 요소를 찾지 못한 경우
     * @throws {Error} 찾은 요소가 `<template>`이 아닌 경우
     */
    static getTemplate(mode = 'edit') {
        const isReadonly = mode === 'read';
        const selector = isReadonly ? this.readonlyTemplateSelector : this.templateSelector;

        // ── selector 미선언 ───────────────────────────────────────────────────
        if (!selector) {
            if (isReadonly) {
                throw new Error(
                    `[DSM] UILayout.getTemplate(): ${this.name || 'UILayout'}에 ` +
                        'readonlyTemplateSelector가 선언되지 않았습니다. ' +
                        "mode: 'read'로 bindCollection()을 호출하려면 " +
                        "static readonlyTemplateSelector = '#yourReadTemplate'을 선언하세요."
                );
            }
            throw new Error(
                `[DSM] UILayout.getTemplate(): ${this.name || 'UILayout'}에 ` +
                    'templateSelector가 선언되지 않았습니다. ' +
                    "static templateSelector = '#yourTemplate'을 선언하세요."
            );
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── DOM 탐색 ──────────────────────────────────────────────────────────
        const el = document.querySelector(selector);
        if (!el) {
            throw new Error(
                `[DSM] UILayout.getTemplate(): selector="${selector}"로 ` +
                    'DOM 요소를 찾을 수 없습니다. ' +
                    'HTML에 해당 <template> 요소가 존재하는지 확인하세요.'
            );
        }
        if (!(el instanceof HTMLTemplateElement)) {
            throw new Error(
                `[DSM] UILayout.getTemplate(): selector="${selector}"가 ` +
                    `<${el.tagName.toLowerCase()}> 요소를 가리킵니다. ` +
                    '<template> 요소여야 합니다.'
            );
        }
        // ─────────────────────────────────────────────────────────────────────

        return el;
    }

    /**
     * `<template>` 콘텐츠를 복제하여 첫 번째 자식 요소를 반환한다.
     *
     * `document.importNode(template.content, true)`로 깊은 복제를 수행한다.
     * 복제된 프래그먼트의 첫 번째 `Element`를 행(row) 요소로 반환한다.
     *
     * @param {HTMLTemplateElement} template - 복제할 `<template>` 요소
     * @returns {Element} 복제된 첫 번째 자식 요소
     * @throws {Error} 템플릿에 자식 요소가 없는 경우
     */
    static cloneRow(template) {
        const fragment = document.importNode(template.content, true);
        const rowEl = fragment.firstElementChild;
        if (!rowEl) {
            throw new Error(
                '[DSM] UILayout.cloneRow(): <template> 콘텐츠에 자식 요소가 없습니다. ' +
                    '<template> 내부에 행(row)을 구성하는 HTML 요소를 선언하세요.'
            );
        }
        return rowEl;
    }
}
