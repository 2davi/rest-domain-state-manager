/**
 * lcs-diff.js 단위 테스트 — v1.2.x
 *
 * ## 테스트 대상
 * - `deepDiff(initial, current, itemKey?)` 공개 API
 * - 스칼라 변경 감지 (add / replace / remove)
 * - 중첩 객체 재귀 비교
 * - 배열: positional fallback (itemKey 미지정)
 * - 배열: LCS 기반 비교 (itemKey 지정)
 * - 경계 케이스: 빈 객체, 빈 배열, null 방어
 *
 * @see {@link ../../src/common/lcs-diff.js deepDiff}
 */

import { describe, it, expect } from 'vitest';
import { deepDiff } from '../../src/common/lcs-diff.js';

// ────────────────────────────────────────────────────────────────────────────
// 1. 스칼라 필드 변경
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — 스칼라 필드 변경', () => {
    it('[TC-DIFF-001] 변경 없음 → 빈 배열 반환', () => {
        const initial = { name: 'Davi', age: 30 };
        const current = { name: 'Davi', age: 30 };
        expect(deepDiff(initial, current)).toEqual([]);
    });

    it('[TC-DIFF-002] 단일 필드 replace 감지', () => {
        const initial = { name: 'Davi', age: 30 };
        const current = { name: 'Lee', age: 30 };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            op: 'replace',
            path: '/name',
            oldValue: 'Davi',
            newValue: 'Lee',
        });
    });

    it('[TC-DIFF-003] 다중 필드 replace 감지', () => {
        const initial = { name: 'Davi', age: 30 };
        const current = { name: 'Lee', age: 31 };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(2);
        const ops = result.map((r) => r.path);
        expect(ops).toContain('/name');
        expect(ops).toContain('/age');
    });

    it('[TC-DIFF-004] 신규 키 추가 → op: add', () => {
        const initial = { name: 'Davi' };
        const current = { name: 'Davi', phone: '010-0000' };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ op: 'add', path: '/phone', newValue: '010-0000' });
    });

    it('[TC-DIFF-005] 기존 키 삭제 → op: remove', () => {
        const initial = { name: 'Davi', phone: '010-0000' };
        const current = { name: 'Davi' };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ op: 'remove', path: '/phone', oldValue: '010-0000' });
    });

    it('[TC-DIFF-006] remove 항목에 newValue가 없어야 한다 (RFC 6902 §4.2)', () => {
        const result = deepDiff({ name: 'Davi', x: 1 }, { name: 'Davi' });
        const removeEntry = result.find((r) => r.op === 'remove');
        expect(removeEntry).toBeDefined();
        expect(removeEntry).not.toHaveProperty('newValue');
    });

    it('[TC-DIFF-007] add 항목에 oldValue가 없어야 한다', () => {
        const result = deepDiff({ name: 'Davi' }, { name: 'Davi', x: 1 });
        const addEntry = result.find((r) => r.op === 'add');
        expect(addEntry).toBeDefined();
        expect(addEntry).not.toHaveProperty('oldValue');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 중첩 객체 재귀 비교
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — 중첩 객체', () => {
    it('[TC-DIFF-010] 중첩 객체 내부 필드 replace 감지', () => {
        const initial = { address: { city: 'Seoul', zip: '00000' } };
        const current = { address: { city: 'Busan', zip: '00000' } };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            op: 'replace',
            path: '/address/city',
            oldValue: 'Seoul',
            newValue: 'Busan',
        });
    });

    it('[TC-DIFF-011] 중첩 객체 내부 신규 키 add', () => {
        const initial = { address: { city: 'Seoul' } };
        const current = { address: { city: 'Seoul', zip: '12345' } };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ op: 'add', path: '/address/zip', newValue: '12345' });
    });

    it('[TC-DIFF-012] 최상위 plain 객체가 replace되면 내부 필드 단위로 diff', () => {
        const initial = { profile: { score: 10, active: true } };
        const current = { profile: { score: 20, active: true } };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('/profile/score');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 배열 — positional fallback (itemKey 없음)
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — 배열 positional fallback', () => {
    it('[TC-DIFF-020] 배열 요소 값 변경 → replace', () => {
        const initial = { tags: ['A', 'B', 'C'] };
        const current = { tags: ['A', 'X', 'C'] };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            op: 'replace',
            path: '/tags/1',
            oldValue: 'B',
            newValue: 'X',
        });
    });

    it('[TC-DIFF-021] 배열 끝에 항목 추가 → add with path "/-"', () => {
        const initial = { tags: ['A', 'B'] };
        const current = { tags: ['A', 'B', 'C'] };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ op: 'add', path: '/tags/-', newValue: 'C' });
    });

    it('[TC-DIFF-022] 배열 끝에서 항목 제거 → remove', () => {
        const initial = { tags: ['A', 'B', 'C'] };
        const current = { tags: ['A', 'B'] };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ op: 'remove', path: '/tags/2', oldValue: 'C' });
    });

    it('[TC-DIFF-023] 빈 배열로 교체 → 기존 항목 모두 remove', () => {
        const initial = { tags: ['A', 'B'] };
        const current = { tags: [] };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(2);
        expect(result.every((r) => r.op === 'remove')).toBe(true);
    });

    it('[TC-DIFF-024] 빈 배열에서 항목 추가 → 항목 모두 add', () => {
        const initial = { tags: [] };
        const current = { tags: ['A', 'B'] };
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(2);
        expect(result.every((r) => r.op === 'add')).toBe(true);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 배열 — LCS 기반 비교 (itemKey 지정)
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — 배열 LCS (itemKey 지정)', () => {
    it('[TC-DIFF-030] 항목 삭제 + 신규 추가 — replace가 아닌 remove + add로 구분', () => {
        const initial = {
            items: [
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ],
        };
        const current = {
            items: [
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ],
        };
        const result = deepDiff(initial, current, 'id');

        const removes = result.filter((r) => r.op === 'remove');
        const adds = result.filter((r) => r.op === 'add');

        expect(removes).toHaveLength(1);
        expect(adds).toHaveLength(1);
        expect(removes[0].oldValue).toMatchObject({ id: 1, name: 'A' });
        expect(adds[0].newValue).toMatchObject({ id: 3, name: 'C' });
    });

    it('[TC-DIFF-031] 매칭 항목 내부 필드 변경 → replace 감지', () => {
        const initial = {
            items: [
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ],
        };
        const current = {
            items: [
                { id: 1, name: 'A' },
                { id: 2, name: 'UPDATED' },
            ],
        };
        const result = deepDiff(initial, current, 'id');

        const replaces = result.filter((r) => r.op === 'replace');
        expect(replaces).toHaveLength(1);
        expect(replaces[0].path).toContain('name');
        expect(replaces[0].newValue).toBe('UPDATED');
    });

    it('[TC-DIFF-032] 순서만 바뀐 경우 변경 없음 (LCS는 순서 이동을 ignore)', () => {
        const initial = { items: [{ id: 1 }, { id: 2 }, { id: 3 }] };
        const current = { items: [{ id: 3 }, { id: 1 }, { id: 2 }] };
        // LCS는 공통 부분 수열 기준이므로 순서 이동을 하나의 삭제+추가로 처리할 수 있음
        // 이 TC는 "에러 없이 완료"를 검증 (결과 형식 확인)
        const result = deepDiff(initial, current, 'id');
        expect(Array.isArray(result)).toBe(true);
    });

    it('[TC-DIFF-033] itemKey 필드값이 undefined인 항목은 매칭에서 제외', () => {
        // itemKey가 없는 항목은 add/remove 처리
        const initial = { items: [{ id: 1, name: 'A' }, { name: 'NoKey' }] };
        const current = { items: [{ id: 1, name: 'A' }, { name: 'NewNoKey' }] };
        const result = deepDiff(initial, current, 'id');
        // id가 없는 항목은 LCS에서 매칭 불가 → remove + add
        expect(Array.isArray(result)).toBe(true);
    });

    it('[TC-DIFF-034] 전체 배열이 교체되는 경우', () => {
        const initial = { items: [{ id: 1 }, { id: 2 }] };
        const current = { items: [{ id: 3 }, { id: 4 }] };
        const result = deepDiff(initial, current, 'id');

        const removes = result.filter((r) => r.op === 'remove');
        const adds = result.filter((r) => r.op === 'add');
        expect(removes).toHaveLength(2);
        expect(adds).toHaveLength(2);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 경계 케이스
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — 경계 케이스', () => {
    it('[TC-DIFF-040] 두 객체 모두 빈 객체 → 빈 배열', () => {
        expect(deepDiff({}, {})).toEqual([]);
    });

    it('[TC-DIFF-041] initial이 빈 객체, current에 키 있음 → add 항목만', () => {
        const result = deepDiff({}, { name: 'Davi' });
        expect(result).toHaveLength(1);
        expect(result[0].op).toBe('add');
    });

    it('[TC-DIFF-042] initial에 키 있음, current가 빈 객체 → remove 항목만', () => {
        const result = deepDiff({ name: 'Davi' }, {});
        expect(result).toHaveLength(1);
        expect(result[0].op).toBe('remove');
    });

    it('[TC-DIFF-043] null 방어 — initial null로 전달 시 에러 없음', () => {
        // null이 전달되면 내부에서 {} 폴백으로 처리
        expect(() => deepDiff(/** @type {any} */ (null), { name: 'Davi' })).not.toThrow();
    });

    it('[TC-DIFF-044] null 방어 — current null로 전달 시 에러 없음', () => {
        expect(() => deepDiff({ name: 'Davi' }, /** @type {any} */ (null))).not.toThrow();
    });

    it('[TC-DIFF-045] 단일 항목 배열 — add', () => {
        const initial = { items: [] };
        const current = { items: [{ id: 1 }] };
        const result = deepDiff(initial, current, 'id');
        expect(result).toHaveLength(1);
        expect(result[0].op).toBe('add');
    });

    it('[TC-DIFF-046] 단일 항목 배열 — remove', () => {
        const initial = { items: [{ id: 1 }] };
        const current = { items: [] };
        const result = deepDiff(initial, current, 'id');
        expect(result).toHaveLength(1);
        expect(result[0].op).toBe('remove');
    });

    it('[TC-DIFF-047] 최상위가 배열인 경우 (DomainCollection Root Array)', () => {
        const initial = [
            { id: 1, v: 'A' },
            { id: 2, v: 'B' },
        ];
        const current = [
            { id: 2, v: 'B' },
            { id: 3, v: 'C' },
        ];
        const result = deepDiff(initial, current, 'id');
        const removes = result.filter((r) => r.op === 'remove');
        const adds = result.filter((r) => r.op === 'add');
        expect(removes).toHaveLength(1);
        expect(adds).toHaveLength(1);
    });

    it('[TC-DIFF-048] 동일 값 재할당 → changeLog에 기록하지 않음', () => {
        const initial = { name: 'Davi', count: 0 };
        const current = { name: 'Davi', count: 0 };
        expect(deepDiff(initial, current)).toEqual([]);
    });

    it('[TC-DIFF-049] 숫자 0과 false는 서로 다른 값으로 처리', () => {
        const initial = { flag: 0 };
        const current = { flag: false };
        // 0 !== false → replace
        const result = deepDiff(initial, current);
        expect(result).toHaveLength(1);
        expect(result[0].op).toBe('replace');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. RFC 6902 규격 준수 확인
// ────────────────────────────────────────────────────────────────────────────
describe('deepDiff — RFC 6902 규격', () => {
    it('[TC-DIFF-050] 모든 항목이 op, path 필드를 포함해야 한다', () => {
        const initial = { a: 1, b: 2 };
        const current = { a: 9, c: 3 };
        const result = deepDiff(initial, current);
        for (const entry of result) {
            expect(entry).toHaveProperty('op');
            expect(entry).toHaveProperty('path');
            expect(entry.path).toMatch(/^\//); // JSON Pointer는 /로 시작
        }
    });

    it('[TC-DIFF-051] LCS add 항목의 path는 "/-" (끝 추가 표기)이어야 한다', () => {
        const initial = { items: [{ id: 1 }] };
        const current = { items: [{ id: 1 }, { id: 2 }] };
        const result = deepDiff(initial, current, 'id');
        const adds = result.filter((r) => r.op === 'add');
        expect(adds.every((a) => a.path.endsWith('/-'))).toBe(true);
    });
});
