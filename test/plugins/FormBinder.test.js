// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { FormBinder } from '../../src/plugins/form-binder/FormBinder.js';

DomainState.use(FormBinder);

function mockHandler() {
    return {
        _fetch: () => Promise.resolve(null),
        getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
        isDebug: () => false,
    };
}

// 테스트용 폼 DOM 생성
function createForm(id = 'testForm') {
    document.body.innerHTML = `
        <form id="${id}">
            <input name="name"  type="text"   value="Davi" />
            <input name="email" type="email"  value="davi@example.com" />
            <select name="role">
                <option value="admin" selected>Admin</option>
                <option value="user">User</option>
            </select>
        </form>
    `;
    return document.getElementById(id);
}

// ══════════════════════════════════════════════════════════════════════════════
// TC-FB-001  fromForm()
// ══════════════════════════════════════════════════════════════════════════════

describe('FormBinder — fromForm()', () => {
    beforeEach(() => {
        createForm();
    });

    it('TC-FB-001: 폼 현재 값으로 DomainState 생성 (isNew:true)', () => {
        const state = DomainState.fromForm('testForm', mockHandler());
        expect(state._isNew).toBe(true);
        expect(state.data.name).toBe('Davi');
        expect(state.data.email).toBe('davi@example.com');
    });

    it('유효하지 않은 formOrId → Error throw', () => {
        expect(() => DomainState.fromForm('nonExistentForm', mockHandler())).toThrow();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-FB-002  input 이벤트 추적
// ══════════════════════════════════════════════════════════════════════════════

describe('FormBinder — 이벤트 추적', () => {
    beforeEach(() => {
        createForm();
    });

    it('TC-FB-002: text input blur → data 갱신', () => {
        const state = DomainState.fromForm('testForm', mockHandler());
        const input = document.querySelector('input[name="name"]');

        input.value = 'Lee';
        input.dispatchEvent(new Event('focusout', { bubbles: true }));

        expect(state.data.name).toBe('Lee');
    });

    it('select change → data 즉시 갱신', () => {
        const state = DomainState.fromForm('testForm', mockHandler());
        const select = document.querySelector('select[name="role"]');

        select.value = 'user';
        select.dispatchEvent(new Event('input', { bubbles: true }));

        expect(state.data.role).toBe('user');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-FB-003  bindForm()
// ══════════════════════════════════════════════════════════════════════════════

describe('FormBinder — bindForm()', () => {
    it('TC-FB-003: DomainState.data → 폼 필드 역동기화', () => {
        document.body.innerHTML = `
            <form id="bindForm">
                <input name="name" type="text" value="" />
            </form>
        `;
        const state = DomainState.fromJSON(
            JSON.stringify({ name: 'Davi', email: '' }),
            mockHandler()
        );
        state.bindForm('bindForm');

        const input = document.querySelector('input[name="name"]');
        expect(input.value).toBe('Davi');
    });
});
