// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DomainState }    from '../../src/domain/DomainState.js';
import { DomainRenderer } from '../../src/plugins/domain-renderer/DomainRenderer.js';
import { makeRoleList }   from '../fixtures/index.js';

DomainState.use(DomainRenderer);

function mockHandler() {
    return {
        _fetch:       () => Promise.resolve(null),
        getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
        isDebug:      () => false,
    };
}

function makeArrayState(data) {
    return DomainState.fromJSON(JSON.stringify(data), mockHandler());
}

function makeContainer(id = 'container') {
    document.body.innerHTML = `<div id="${id}"></div>`;
    return document.getElementById(id);
}

// ══════════════════════════════════════════════════════════════════════════════
// TC-DR-001 ~ TC-DR-004
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainRenderer — renderTo()', () => {

    it('TC-DR-001: type:select → HTMLSelectElement 생성, option 수 일치', () => {
        makeContainer();
        const state  = makeArrayState(makeRoleList());
        const result = state.renderTo('container', {
            type: 'select', valueField: 'roleId', labelField: 'roleName',
        });
        expect(result.tagName).toBe('SELECT');
        expect(result.options).toHaveLength(makeRoleList().length);
    });

    it('TC-DR-002: type:radio → input[type=radio] 배열 생성', () => {
        makeContainer();
        const state  = makeArrayState(makeRoleList());
        const result = state.renderTo('container', {
            type: 'radio', valueField: 'roleId', labelField: 'roleName',
        });
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(makeRoleList().length);
        expect(result[0].type).toBe('radio');
    });

    it('TC-DR-003: 같은 컨테이너 재호출 → 기존 내용 교체 (자식 수 두 배 아님)', () => {
        makeContainer();
        const state = makeArrayState(makeRoleList());
        const config = { type: 'select', valueField: 'roleId', labelField: 'roleName' };
        state.renderTo('container', config);
        state.renderTo('container', config); // 두 번째
        const container = document.getElementById('container');
        expect(container.children).toHaveLength(1); // select 1개만
    });

    it('TC-DR-004: 데이터가 배열 아님 → Error throw', () => {
        makeContainer();
        const state = DomainState.fromJSON(
            JSON.stringify({ name: 'Davi' }),
            mockHandler()
        );
        expect(() => state.renderTo('container', {
            type: 'select', valueField: 'id', labelField: 'name',
        })).toThrow();
    });

    it('존재하지 않는 container id → Error throw', () => {
        const state = makeArrayState(makeRoleList());
        expect(() => state.renderTo('nonExistent', {
            type: 'select', valueField: 'roleId', labelField: 'roleName',
        })).toThrow();
    });

});