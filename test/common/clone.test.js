import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeClone } from '../../src/common/clone.js';

// ══════════════════════════════════════════════════════════════════════════════
// safeClone — structuredClone 경로
// ══════════════════════════════════════════════════════════════════════════════

describe('safeClone — structuredClone 경로', () => {

    it('SC-001: null을 그대로 반환한다', () => {
        expect(safeClone(null)).toBeNull();
    });

    it('SC-002: 원시값(string, number, boolean)을 그대로 반환한다', () => {
        expect(safeClone('hello')).toBe('hello');
        expect(safeClone(42)).toBe(42);
        expect(safeClone(true)).toBe(true);
    });

    it('SC-003: 일반 객체를 deep copy한다 — 원본과 독립적인 참조', () => {
        const obj = { a: 1, nested: { b: 2 } };
        const copy = safeClone(obj);

        expect(copy).toEqual(obj);
        copy.nested.b = 99;
        expect(obj.nested.b).toBe(2);  // 원본 불변
    });

    it('SC-004: 배열을 deep copy한다', () => {
        const arr = [1, { x: 2 }, [3, 4]];
        const copy = safeClone(arr);

        expect(copy).toEqual(arr);
        /** @type {any} */ (copy)[1].x = 99;
        expect(arr[1]).toEqual({ x: 2 });  // 원본 불변
    });

    it('SC-005: Date 객체를 Date 타입으로 보존한다', () => {
        const obj = { createdAt: new Date('2026-01-01T00:00:00.000Z') };
        const copy = safeClone(obj);

        expect(copy.createdAt).toBeInstanceOf(Date);
        expect(copy.createdAt.getTime()).toBe(obj.createdAt.getTime());
        copy.createdAt.setFullYear(2025);
        expect(obj.createdAt.getFullYear()).toBe(2026);  // 원본 불변
    });

    it('SC-006: RegExp 객체를 RegExp 타입으로 보존한다', () => {
        const obj = { pattern: /^[a-z]+$/gi };
        const copy = safeClone(obj);

        expect(copy.pattern).toBeInstanceOf(RegExp);
        expect(copy.pattern.source).toBe(obj.pattern.source);
        expect(copy.pattern.flags).toBe(obj.pattern.flags);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// safeClone — _cloneDeep 폴백 경로
// ══════════════════════════════════════════════════════════════════════════════

describe('safeClone — _cloneDeep 폴백 경로', () => {
    /** @type {typeof structuredClone | undefined} */
    let originalStructuredClone;

    beforeEach(() => {
        // global.structuredClone을 undefined로 교체하여 폴백 경로 강제 진입
        originalStructuredClone = globalThis.structuredClone;
        // @ts-ignore
        globalThis.structuredClone = undefined;
    });

    afterEach(() => {
        globalThis.structuredClone = originalStructuredClone;
    });

    it('SC-007: 폴백 경로에서 null을 그대로 반환한다', () => {
        expect(safeClone(null)).toBeNull();
    });

    it('SC-008: 폴백 경로에서 원시값을 그대로 반환한다', () => {
        expect(safeClone('hello')).toBe('hello');
        expect(safeClone(0)).toBe(0);
    });

    it('SC-009: 폴백 경로에서 일반 객체를 deep copy한다', () => {
        const obj = { a: 1, nested: { b: 2 } };
        const copy = safeClone(obj);

        expect(copy).toEqual(obj);
        /** @type {any} */ (copy).nested.b = 99;
        expect(obj.nested.b).toBe(2);
    });

    it('SC-010: 폴백 경로에서 Date를 Date 타입으로 보존한다', () => {
        const date = new Date('2026-03-27T00:00:00.000Z');
        const copy = safeClone({ d: date });

        expect(/** @type {any} */ (copy).d).toBeInstanceOf(Date);
        expect(/** @type {any} */ (copy).d.getTime()).toBe(date.getTime());
    });

    it('SC-011: 폴백 경로에서 RegExp를 RegExp 타입으로 보존한다', () => {
        const re = /^test$/i;
        const copy = safeClone({ r: re });

        expect(/** @type {any} */ (copy).r).toBeInstanceOf(RegExp);
        expect(/** @type {any} */ (copy).r.source).toBe('^test$');
        expect(/** @type {any} */ (copy).r.flags).toBe('i');
    });

    it('SC-012: 폴백 경로에서 배열을 deep copy한다', () => {
        const arr = [{ x: 1 }, { x: 2 }];
        const copy = safeClone(arr);

        expect(copy).toEqual(arr);
        /** @type {any} */ (copy)[0].x = 99;
        expect(arr[0].x).toBe(1);
    });
});