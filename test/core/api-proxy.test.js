import { describe, it, expect, beforeEach } from 'vitest';
import { createProxy } from '../../src/core/api-proxy.js';

// ══════════════════════════════════════════════════════════════════════════════
// TC-C-001 ~ TC-C-004  기본 변경 추적
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — 기본 변경 추적', () => {
    it('TC-C-001: 존재하는 키 수정 → replace op 기록', () => {
        const { proxy, getChangeLog } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';
        const log = getChangeLog();
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({
            op: 'replace',
            path: '/name',
            oldValue: 'Davi',
            newValue: 'Lee',
        });
    });

    it('TC-C-002: 존재하지 않는 키 추가 → add op 기록', () => {
        const { proxy, getChangeLog } = createProxy({ name: 'Davi' });
        proxy.phone = '010';
        const log = getChangeLog();
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ op: 'add', path: '/phone', newValue: '010' });
        expect(log[0].oldValue).toBeUndefined();
    });

    it('TC-C-003: delete 연산 → remove op 기록', () => {
        const { proxy, getChangeLog } = createProxy({ name: 'Davi', age: 30 });
        delete proxy.age;
        const log = getChangeLog();
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({ op: 'remove', path: '/age', oldValue: 30 });
        expect(log[0].newValue).toBeUndefined();
    });

    it('TC-C-004: 동일 값 재할당 → No-op (changeLog 기록 없음)', () => {
        const { proxy, getChangeLog } = createProxy({ name: 'Davi' });
        proxy.name = 'Davi'; // 동일값
        expect(getChangeLog()).toHaveLength(0);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-C-005 ~ TC-C-006  중첩 객체 추적
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — 중첩 객체 추적', () => {
    it('TC-C-005: 중첩 객체 수정 → path에 부모/자식 포함', () => {
        const { proxy, getChangeLog } = createProxy({ address: { city: 'Seoul' } });
        proxy.address.city = 'Busan';
        const log = getChangeLog();
        expect(log).toHaveLength(1);
        expect(log[0].path).toBe('/address/city');
    });

    it('TC-C-006: 동일 중첩 객체 재접근 → WeakMap 캐싱 (동일 참조)', () => {
        const { proxy } = createProxy({ address: { city: 'Seoul' } });
        const a1 = proxy.address;
        const a2 = proxy.address;
        expect(a1).toBe(a2);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-C-007 ~ TC-C-009  배열 변이 추적
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — 배열 변이 추적', () => {
    it('TC-C-007: push → 마지막 인덱스에 add op 기록', () => {
        const { proxy, getChangeLog } = createProxy({ items: ['A', 'B'] });
        proxy.items.push('C');
        const log = getChangeLog();
        const addEntry = log.find((e) => e.op === 'add' && e.path === '/items/2');
        expect(addEntry).toBeDefined();
        expect(addEntry.newValue).toBe('C');
    });

    it('TC-C-008: splice(1,1,"X") → index 1 remove 후 add 기록', () => {
        const { proxy, getChangeLog } = createProxy({ items: ['A', 'B', 'C'] });
        proxy.items.splice(1, 1, 'X');
        const log = getChangeLog();
        const removeEntry = log.find((e) => e.op === 'remove' && e.path === '/items/1');
        const addEntry = log.find((e) => e.op === 'add' && e.path === '/items/1');
        expect(removeEntry).toBeDefined();
        expect(removeEntry.oldValue).toBe('B');
        expect(addEntry).toBeDefined();
        expect(addEntry.newValue).toBe('X');
    });

    it('TC-C-009: sort → 배열 전체 단일 replace op', () => {
        const { proxy, getChangeLog } = createProxy({ items: ['C', 'A', 'B'] });
        proxy.items.sort();
        const log = getChangeLog();
        // sort는 단일 replace op를 생성해야 함
        expect(log.filter((e) => e.op === 'replace' && e.path === '/items')).toHaveLength(1);
    });

    it('reverse → 배열 전체 단일 replace op', () => {
        const { proxy, getChangeLog } = createProxy({ items: [1, 2, 3] });
        proxy.items.reverse();
        const log = getChangeLog();
        expect(log.filter((e) => e.op === 'replace' && e.path === '/items')).toHaveLength(1);
    });

    it('shift → index 0 remove op', () => {
        const { proxy, getChangeLog } = createProxy({ items: ['A', 'B'] });
        proxy.items.shift();
        const log = getChangeLog();
        expect(log.find((e) => e.op === 'remove' && e.path === '/items/0')).toBeDefined();
    });

    it('unshift → index 0 add op', () => {
        const { proxy, getChangeLog } = createProxy({ items: ['B', 'C'] });
        proxy.items.unshift('A');
        const log = getChangeLog();
        expect(log.find((e) => e.op === 'add' && e.path === '/items/0')).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-C-010 ~ TC-C-012  dirtyFields 추적 (Milestone 1-A)
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — dirtyFields 추적 (1-A)', () => {
    it('TC-C-010: 최상위 키 변경 → dirtyFields에 해당 키 등록', () => {
        const { proxy, getDirtyFields } = createProxy({ name: 'Davi', age: 30 });
        proxy.name = 'Lee';
        expect(getDirtyFields().has('name')).toBe(true);
        expect(getDirtyFields().has('age')).toBe(false);
    });

    it('TC-C-011: 중첩 키 변경 → 최상위 키만 dirtyFields에 등록', () => {
        const { proxy, getDirtyFields } = createProxy({ address: { city: 'Seoul' } });
        proxy.address.city = 'Busan';
        const dirty = getDirtyFields();
        expect(dirty.has('address')).toBe(true);
        expect(dirty.size).toBe(1);
    });

    it('TC-C-012: 동일 키 반복 변경 → dirtyFields.size 유지 (Set 중복 무시)', () => {
        const { proxy, getDirtyFields } = createProxy({ name: 'A' });
        for (let i = 0; i < 10; i++) proxy.name = String(i);
        expect(getDirtyFields().size).toBe(1);
    });

    it('clearDirtyFields 호출 후 dirtyFields 비워짐', () => {
        const { proxy, getDirtyFields, clearDirtyFields } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';
        expect(getDirtyFields().size).toBe(1);
        clearDirtyFields();
        expect(getDirtyFields().size).toBe(0);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-C-013 ~ TC-C-015  복원 메서드 (Milestone 1-D)
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — 복원 메서드 (1-D)', () => {
    it('TC-C-013: restoreTarget → domainObject를 스냅샷으로 복원', () => {
        const { proxy, getTarget, restoreTarget } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';
        expect(getTarget().name).toBe('Lee');

        restoreTarget({ name: 'Davi' });
        expect(getTarget().name).toBe('Davi');
    });

    it('TC-C-014: restoreTarget → Proxy 우회, changeLog에 기록 안 됨', () => {
        const { proxy, getChangeLog, restoreTarget } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee'; // changeLog: 1개
        const countBefore = getChangeLog().length;

        restoreTarget({ name: 'Davi' });
        // 복원 자체는 changeLog에 추가되지 않아야 함
        expect(getChangeLog().length).toBe(countBefore);
    });

    it('TC-C-015: Array 루트 객체 복원 → splice/push로 처리', () => {
        const arr = ['A', 'B', 'C'];
        const { proxy, getTarget, restoreTarget } = createProxy(arr);
        proxy[0] = 'X';

        restoreTarget(['A', 'B', 'C']);
        expect(getTarget()).toEqual(['A', 'B', 'C']);
    });

    it('restoreChangeLog → changeLog를 스냅샷 항목으로 교체', () => {
        const { proxy, getChangeLog, restoreChangeLog } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';
        const snapshot = getChangeLog(); // 얕은 복사본
        proxy.name = 'Kim';

        restoreChangeLog(snapshot);
        expect(getChangeLog()).toHaveLength(1);
        expect(getChangeLog()[0].newValue).toBe('Lee');
    });

    it('restoreDirtyFields → dirtyFields를 스냅샷 집합으로 교체', () => {
        const { proxy, getDirtyFields, restoreDirtyFields } = createProxy({
            name: 'Davi',
            age: 30,
        });
        proxy.name = 'Lee';
        const snapshot = getDirtyFields(); // new Set 복사본
        proxy.age = 31;

        expect(getDirtyFields().has('age')).toBe(true);
        restoreDirtyFields(snapshot);
        expect(getDirtyFields().has('age')).toBe(false);
        expect(getDirtyFields().has('name')).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// ProxyWrapper 인터페이스 — 외부 변조 방지
// ══════════════════════════════════════════════════════════════════════════════

describe('createProxy — ProxyWrapper 인터페이스', () => {
    it('getChangeLog는 얕은 복사본 반환 → 외부 변조가 내부 changeLog에 영향 없음', () => {
        const { proxy, getChangeLog } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';

        const log = getChangeLog();
        log.pop(); // 외부에서 제거 시도

        // 내부 changeLog는 영향받지 않아야 함
        expect(getChangeLog()).toHaveLength(1);
    });

    it('getDirtyFields는 new Set 복사본 반환 → 외부 변조가 내부에 영향 없음', () => {
        const { proxy, getDirtyFields } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';

        const dirty = getDirtyFields();
        dirty.clear(); // 외부에서 제거 시도

        // 내부 dirtyFields는 영향받지 않아야 함
        expect(getDirtyFields().size).toBe(1);
    });

    it('clearChangeLog 후 getChangeLog().length === 0', () => {
        const { proxy, getChangeLog, clearChangeLog } = createProxy({ name: 'Davi' });
        proxy.name = 'Lee';
        clearChangeLog();
        expect(getChangeLog()).toHaveLength(0);
    });
});
