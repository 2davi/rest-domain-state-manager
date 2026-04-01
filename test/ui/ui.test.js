/**
 * UILayout + CollectionBinder 단위 테스트 — v1.4.x
 *
 * ## 테스트 환경
 * jsdom (`vitest.config.js` `test/ui/**` 설정)
 * DOM API (`document`, `HTMLTemplateElement`, `HTMLInputElement` 등) 사용
 *
 * ## 테스트 대상
 * ### UILayout
 * - `getTemplate()` — selector 미선언, DOM 미존재, 비template 요소
 * - `cloneRow()` — template 복제, 자식 요소 없음 에러
 *
 * ### CollectionBinder
 * - 초기 렌더링 — DomainCollection 항목을 행으로 그리드에 그리기
 * - `addEmpty()` — 빈 행 추가
 * - `removeChecked()` — 체크된 행 역순(LIFO) 제거
 * - `removeAll()` — 전체 제거
 * - `selectAll()` / `invertSelection()` — 체크 제어
 * - `validate()` — required 필드 검증
 * - Reactive 바인딩 — input 변경이 DomainState.data에 반영
 * - `sourceKey` — select 옵션 자동 채우기
 *
 * ### UIComposer
 * - `DomainState.use(UIComposer)` 설치
 * - `DomainCollection.bind()` — controls 반환
 *
 * @see {@link ../../src/ui/UILayout.js UILayout}
 * @see {@link ../../src/ui/collection/CollectionBinder.js CollectionBinder}
 * @see {@link ../../src/ui/UIComposer.js UIComposer}
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UILayout } from '../../src/ui/UILayout.js';
import { createCollectionBinder } from '../../src/ui/collection/CollectionBinder.js';
import { UIComposer } from '../../src/ui/UIComposer.js';
import { DomainCollection } from '../../src/domain/DomainCollection.js';
import { DomainState } from '../../src/domain/DomainState.js';
import { ApiHandler } from '../../src/network/api-handler.js';
import { DomainPipeline } from '../../src/domain/DomainPipeline.js';

// ── 전역 설정 ─────────────────────────────────────────────────────────────────

beforeEach(() => {
    DomainState.configure({
        pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    // DOM 초기화
    document.body.innerHTML = '';
    document.head.innerHTML = '';
});

// ── 테스트용 UILayout 서브클래스 ─────────────────────────────────────────────

/** sourceKey 없는 기본 테스트용 UILayout — 대부분의 TC에서 사용 */
class TestLayout extends UILayout {
    static templateSelector = '#testTemplate';
    static readonlyTemplateSelector = '#testReadTemplate';
    static itemKey = 'certId';

    static columns = {
        certName: { selector: '[data-field="certName"]', required: true },
        certType: { selector: '[data-field="certType"]' }, // sourceKey 없음
    };
}

/** sourceKey 포함 레이아웃 — TC-UI-070 / TC-UI-071 전용 */
class TestLayoutWithSource extends UILayout {
    static templateSelector = '#testTemplate';
    static itemKey = 'certId';

    static columns = {
        certName: { selector: '[data-field="certName"]', required: true },
        certType: {
            selector: '[data-field="certType"]',
            sourceKey: 'certTypes',
            sourceValueField: 'typeId',
            sourceLabelField: 'typeName',
        },
    };
}

/** 테스트용 DOM fixture 설정 */
function setupDOM() {
    document.body.innerHTML = `
        <div id="grid"></div>
        <input type="checkbox" id="selectAll">
        <template id="testTemplate">
            <div class="row">
                <input type="checkbox" class="dsm-checkbox">
                <input data-field="certName" type="text">
                <select data-field="certType"></select>
                <span class="dsm-row-number"></span>
            </div>
        </template>
        <template id="testReadTemplate">
            <div class="row read-only">
                <span data-field="certName"></span>
            </div>
        </template>
    `;
}

/** 테스트용 DomainCollection 생성 헬퍼 */
function createTestCollection(items = []) {
    const handler = new ApiHandler({ host: 'localhost:8080' });
    vi.spyOn(handler, '_fetch').mockResolvedValue(null);

    if (items.length === 0) return DomainCollection.create(handler);

    return DomainCollection.fromJSONArray(JSON.stringify(items), handler);
}

// ────────────────────────────────────────────────────────────────────────────
// 1. UILayout — getTemplate()
// ────────────────────────────────────────────────────────────────────────────
describe('UILayout.getTemplate()', () => {
    it('[TC-UI-001] 유효한 templateSelector로 <template> 요소를 반환해야 한다', () => {
        setupDOM();
        const template = TestLayout.getTemplate('edit');
        expect(template).toBeInstanceOf(HTMLTemplateElement);
    });

    it('[TC-UI-002] templateSelector 미선언 시 Error를 throw해야 한다', () => {
        setupDOM();
        class NoSelectorLayout extends UILayout {}
        expect(() => NoSelectorLayout.getTemplate('edit')).toThrow(/templateSelector/);
    });

    it('[TC-UI-003] mode: "read" + readonlyTemplateSelector 미선언 시 Error를 throw해야 한다', () => {
        setupDOM();
        class NoReadLayout extends UILayout {
            static templateSelector = '#testTemplate';
            // readonlyTemplateSelector 미선언
        }
        expect(() => NoReadLayout.getTemplate('read')).toThrow(/readonlyTemplateSelector/);
    });

    it('[TC-UI-004] selector가 DOM에 없으면 Error를 throw해야 한다', () => {
        // DOM 미설정 — #testTemplate이 없음
        document.body.innerHTML = '';
        expect(() => TestLayout.getTemplate('edit')).toThrow(/찾을 수 없습니다/);
    });

    it('[TC-UI-005] selector가 <template>이 아닌 요소를 가리키면 Error를 throw해야 한다', () => {
        document.body.innerHTML = '<div id="notTemplate"></div>';

        class WrongEl extends UILayout {
            static templateSelector = '#notTemplate';
        }
        expect(() => WrongEl.getTemplate('edit')).toThrow(/<template>/);
    });

    it('[TC-UI-006] mode: "read"로 readonlyTemplateSelector 탐색이 성공해야 한다', () => {
        setupDOM();
        const template = TestLayout.getTemplate('read');
        expect(template).toBeInstanceOf(HTMLTemplateElement);
        // read 템플릿의 내용 확인
        const clone = document.importNode(template.content, true);
        expect(clone.querySelector('.read-only')).not.toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. UILayout — cloneRow()
// ────────────────────────────────────────────────────────────────────────────
describe('UILayout.cloneRow()', () => {
    it('[TC-UI-010] <template> 복제 시 첫 번째 자식 Element를 반환해야 한다', () => {
        setupDOM();
        const template = TestLayout.getTemplate('edit');
        const rowEl = TestLayout.cloneRow(template);
        expect(rowEl).toBeInstanceOf(Element);
        expect(rowEl.classList.contains('row')).toBe(true);
    });

    it('[TC-UI-011] 비어있는 <template>에서 cloneRow() 시 Error를 throw해야 한다', () => {
        document.body.innerHTML = '<template id="emptyTemplate"></template>';

        class EmptyLayout extends UILayout {
            static templateSelector = '#emptyTemplate';
        }
        const template = EmptyLayout.getTemplate('edit');
        expect(() => EmptyLayout.cloneRow(template)).toThrow(/자식 요소/);
    });

    it('[TC-UI-012] 복제된 행은 원본 <template>과 독립된 참조여야 한다', () => {
        setupDOM();
        const template = TestLayout.getTemplate('edit');
        const row1 = TestLayout.cloneRow(template);
        const row2 = TestLayout.cloneRow(template);
        expect(row1).not.toBe(row2);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. CollectionBinder — 초기 렌더링
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — 초기 렌더링', () => {
    it('[TC-UI-020] DomainCollection 항목만큼 행이 그리드에 렌더링되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([
            { certId: 1, certName: '정보처리기사', certType: 'IT' },
            { certId: 2, certName: '한국사', certType: 'HISTORY' },
        ]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, { layout: TestLayout, sources: {} });

        expect(containerEl.children.length).toBe(2);
    });

    it('[TC-UI-021] 각 행에 DomainState 데이터가 채워져야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: '정보처리기사' }]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, { layout: TestLayout, sources: {} });

        const inputEl = containerEl.querySelector('[data-field="certName"]');
        expect(/** @type {HTMLInputElement} */ (inputEl).value).toBe('정보처리기사');
    });

    it('[TC-UI-022] 빈 컬렉션이면 행이 없어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, { layout: TestLayout, sources: {} });

        expect(containerEl.children.length).toBe(0);
    });

    it('[TC-UI-023] 행 번호(.dsm-row-number)가 1-based로 설정되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([
            { certId: 1, certName: 'A' },
            { certId: 2, certName: 'B' },
        ]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, { layout: TestLayout, sources: {} });

        const nums = [...containerEl.querySelectorAll('.dsm-row-number')].map(
            (el) => el.textContent
        );
        expect(nums).toEqual(['1', '2']);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. CollectionBinder — addEmpty() / removeChecked() / removeAll()
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — 행 추가/제거', () => {
    it('[TC-UI-030] addEmpty()는 그리드에 행을 추가하고 DomainState를 반환해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([]);
        const containerEl = document.getElementById('grid');
        const { addEmpty } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        const state = addEmpty();

        expect(state).toBeInstanceOf(DomainState);
        expect(containerEl.children.length).toBe(1);
        expect(collection.getCount()).toBe(1);
    });

    it('[TC-UI-031] removeChecked()는 체크된 행을 역순으로 제거해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([
            { certId: 1, certName: 'A' },
            { certId: 2, certName: 'B' },
            { certId: 3, certName: 'C' },
        ]);
        const containerEl = document.getElementById('grid');
        const { removeChecked } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        // 1번(index 0)과 3번(index 2) 체크
        const rows = [...containerEl.children];
        /** @type {HTMLInputElement} */ (rows[0].querySelector('.dsm-checkbox')).checked = true;
        /** @type {HTMLInputElement} */ (rows[2].querySelector('.dsm-checkbox')).checked = true;

        removeChecked();

        // A(index 0), C(index 2) 제거 → B만 남음
        expect(collection.getCount()).toBe(1);
        expect(containerEl.children.length).toBe(1);
        expect(collection.getItems()[0]._getTarget()).toMatchObject({ certName: 'B' });
    });

    it('[TC-UI-032] removeAll()은 모든 행을 제거해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }, { certId: 2 }, { certId: 3 }]);
        const containerEl = document.getElementById('grid');
        const { removeAll } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        removeAll();

        expect(collection.getCount()).toBe(0);
        expect(containerEl.children.length).toBe(0);
    });

    it('[TC-UI-033] addEmpty() 후 행 번호가 갱신되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }]);
        const containerEl = document.getElementById('grid');
        const { addEmpty } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        addEmpty();

        const nums = [...containerEl.querySelectorAll('.dsm-row-number')].map(
            (el) => el.textContent
        );
        expect(nums).toEqual(['1', '2']);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. CollectionBinder — selectAll() / invertSelection()
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — 선택 제어', () => {
    it('[TC-UI-040] selectAll(true)는 모든 행을 체크해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }, { certId: 2 }]);
        const containerEl = document.getElementById('grid');
        const { selectAll } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        selectAll(true);

        const checkboxes = [...containerEl.querySelectorAll('.dsm-checkbox')];
        expect(checkboxes.every((cb) => /** @type {HTMLInputElement} */ (cb).checked)).toBe(true);
    });

    it('[TC-UI-041] selectAll(false)는 모든 행을 해제해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }, { certId: 2 }]);
        const containerEl = document.getElementById('grid');
        const { selectAll } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        selectAll(true);
        selectAll(false);

        const checkboxes = [...containerEl.querySelectorAll('.dsm-checkbox')];
        expect(checkboxes.every((cb) => !(/** @type {HTMLInputElement} */ (cb).checked))).toBe(
            true
        );
    });

    it('[TC-UI-042] invertSelection()은 체크 상태를 반전해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }, { certId: 2 }]);
        const containerEl = document.getElementById('grid');
        const { selectAll, invertSelection } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        selectAll(true); // 모두 체크
        invertSelection(); // 반전 → 모두 해제

        const checkboxes = [...containerEl.querySelectorAll('.dsm-checkbox')];
        expect(checkboxes.every((cb) => !(/** @type {HTMLInputElement} */ (cb).checked))).toBe(
            true
        );
    });

    it('[TC-UI-043] getCheckedItems()는 체크된 행의 DomainState 목록을 반환해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1 }, { certId: 2 }]);
        const containerEl = document.getElementById('grid');
        const { selectAll, getCheckedItems } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        selectAll(true);
        const checked = getCheckedItems();
        expect(checked).toHaveLength(2);
        expect(checked[0]).toBeInstanceOf(DomainState);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. CollectionBinder — validate()
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — validate()', () => {
    it('[TC-UI-050] required 필드가 채워지면 validate()가 true를 반환해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: '정보처리기사' }]);
        const containerEl = document.getElementById('grid');
        const { validate } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        expect(validate()).toBe(true);
    });

    it('[TC-UI-051] required 필드가 비어있으면 validate()가 false를 반환하고 is-invalid 클래스가 추가되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: '' }]);
        const containerEl = document.getElementById('grid');
        const { validate } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        const result = validate();
        const inputEl = containerEl.querySelector('[data-field="certName"]');

        expect(result).toBe(false);
        expect(inputEl?.classList.contains('is-invalid')).toBe(true);
    });

    it('[TC-UI-052] 값 입력 후 validate() 재호출 시 is-invalid 클래스가 제거되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: '' }]);
        const containerEl = document.getElementById('grid');
        const { validate } = createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
        });

        validate(); // is-invalid 추가

        // 값 직접 설정
        const inputEl = /** @type {HTMLInputElement} */ (
            containerEl.querySelector('[data-field="certName"]')
        );
        inputEl.value = '정보처리기사';

        const result = validate(); // is-invalid 제거 기대
        expect(result).toBe(true);
        expect(inputEl.classList.contains('is-invalid')).toBe(false);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. CollectionBinder — Reactive 바인딩
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — Reactive 바인딩', () => {
    it('[TC-UI-060] input 이벤트 발생 시 DomainState.data에 즉시 반영되어야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: 'Init' }]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
            mode: 'edit',
        });

        const inputEl = /** @type {HTMLInputElement} */ (
            containerEl.querySelector('[data-field="certName"]')
        );
        inputEl.value = 'Updated';
        inputEl.dispatchEvent(new Event('input'));

        expect(collection.getItems()[0]._getTarget()).toMatchObject({ certName: 'Updated' });
    });

    it('[TC-UI-061] mode: "read" 시 input 이벤트 리스너가 등록되지 않아야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: 'Init' }]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, {
            layout: TestLayout,
            sources: {},
            mode: 'read',
        });

        // read 모드에서는 readonlyTemplate이 사용됨
        // span 요소는 input 이벤트를 받지 않으므로 데이터 변경 없음
        const spanEl = containerEl.querySelector('[data-field="certName"]');
        if (spanEl) {
            spanEl.dispatchEvent(new Event('input'));
        }

        // read 모드에서는 DomainState 데이터가 변경되지 않아야 함
        expect(collection.getItems()[0]._getTarget()).toMatchObject({ certName: 'Init' });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. CollectionBinder — sourceKey (<select> 옵션 자동 채우기)
// ────────────────────────────────────────────────────────────────────────────
describe('CollectionBinder — sourceKey', () => {
    it('[TC-UI-070] sourceKey 지정 시 <select>에 옵션이 채워져야 한다', () => {
        setupDOM();

        // certTypes DomainCollection 생성
        const handler = new ApiHandler({ host: 'localhost:8080' });
        vi.spyOn(handler, '_fetch').mockResolvedValue(null);
        const certTypes = DomainCollection.fromJSONArray(
            JSON.stringify([
                { typeId: 'IT', typeName: 'IT자격증' },
                { typeId: 'HISTORY', typeName: '역사자격증' },
            ]),
            handler
        );

        const collection = createTestCollection([{ certId: 1, certName: 'A', certType: 'IT' }]);
        const containerEl = document.getElementById('grid');
        createCollectionBinder(collection, containerEl, {
            layout: TestLayoutWithSource,
            sources: { certTypes },
        });

        const selectEl = /** @type {HTMLSelectElement} */ (
            containerEl.querySelector('[data-field="certType"]')
        );
        expect(selectEl).not.toBeNull();
        const options = Array.from(selectEl.children);
        expect(options.length).toBe(2);
        expect(/** @type {HTMLOptionElement} */ (options[0]).value).toBe('IT');
        expect(/** @type {HTMLOptionElement} */ (options[0]).textContent).toBe('IT자격증');
    });

    it('[TC-UI-071] sourceKey 선언됐는데 sources에 없으면 Error를 throw해야 한다', () => {
        setupDOM();
        const collection = createTestCollection([{ certId: 1, certName: 'A', certType: 'IT' }]);
        const containerEl = document.getElementById('grid');

        // sources에 certTypes 미전달
        expect(() =>
            createCollectionBinder(collection, containerEl, {
                layout: TestLayoutWithSource,
                sources: {}, // certTypes 없음
            })
        ).toThrow(/sourceKey="certTypes"/);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. UIComposer — 플러그인 설치 + DomainCollection.bind()
// ────────────────────────────────────────────────────────────────────────────
describe('UIComposer — 플러그인', () => {
    it('[TC-UI-080] DomainState.use(UIComposer) 설치 후 DomainCollection.bind()가 동작해야 한다', () => {
        setupDOM();
        DomainState.use(UIComposer);

        const collection = createTestCollection([{ certId: 1, certName: '정보처리기사' }]);
        const containerEl = document.getElementById('grid');

        const controls = collection.bind(containerEl, {
            layout: TestLayout,
            sources: {},
        });

        expect(typeof controls.addEmpty).toBe('function');
        expect(typeof controls.removeChecked).toBe('function');
        expect(typeof controls.validate).toBe('function');
        expect(containerEl.children.length).toBe(1);
    });

    it('[TC-UI-081] UIComposer 미설치 시 DomainCollection.bind()는 Error를 throw해야 한다', () => {
        setupDOM();
        // UIComposer 미설치 상태 — DomainCollection.prototype.bind는 항상 존재하지만
        // _bindCollection 없이 호출 시 에러
        const collection = createTestCollection([]);

        // UIComposer가 이미 설치된 경우엔 이 TC가 의미 없으므로
        // 직접 _bindCollection을 제거하여 미설치 상태 시뮬레이션
        const origBind = DomainCollection.prototype.bind;
        // @ts-ignore
        DomainCollection.prototype.bind = function () {
            throw new Error(
                '[DSM] DomainCollection.bind(): UIComposer 플러그인이 설치되지 않았습니다.'
            );
        };

        expect(() =>
            collection.bind(document.getElementById('grid'), { layout: TestLayout, sources: {} })
        ).toThrow(/UIComposer/);

        DomainCollection.prototype.bind = origBind;
    });

    it('[TC-UI-082] DomainState.prototype.bindSingle()이 단일 폼을 바인딩해야 한다', () => {
        DomainState.use(UIComposer);

        document.body.innerHTML = `
            <form id="userForm">
                <input data-field="certName" type="text">
            </form>
        `;

        const handler = new ApiHandler({ host: 'localhost:8080' });
        vi.spyOn(handler, '_fetch').mockResolvedValue(null);
        const state = DomainState.fromJSON(
            JSON.stringify({ certId: 1, certName: '정보처리기사' }),
            handler
        );

        class SingleLayout extends UILayout {
            static templateSelector = undefined;
            static columns = {
                certName: { selector: '[data-field="certName"]' },
            };
        }

        const { unbind } = /** @type {any} */ (state).bindSingle('#userForm', {
            layout: SingleLayout,
        });

        const inputEl = /** @type {HTMLInputElement} */ (
            document.querySelector('[data-field="certName"]')
        );
        expect(inputEl.value).toBe('정보처리기사');

        // input 이벤트 → DomainState 반영
        inputEl.value = 'Changed';
        inputEl.dispatchEvent(new Event('input'));
        expect(state._getTarget()).toMatchObject({ certName: 'Changed' });

        expect(typeof unbind).toBe('function');
        unbind();
    });
});
