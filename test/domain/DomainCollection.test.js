/**
 * DomainCollection 단위 테스트 — v1.3.x
 *
 * ## 테스트 대상
 * - `DomainCollection.create()` / `fromJSONArray()` 팩토리
 * - `add()` / `remove()` 항목 조작 (역순 splice 포함)
 * - `getItems()` / `getCount()` / `toJSON()` 조회
 * - `saveAll({ strategy: 'batch' })` — POST / PUT / 실패 롤백
 * - `lazy` trackingMode 상호작용
 * - 에러 케이스 (비배열 JSON, 경로 없음, 미지원 strategy)
 *
 * @see {@link ../../src/domain/DomainCollection.js DomainCollection}
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainCollection } from '../../src/domain/DomainCollection.js';
import { DomainState       } from '../../src/domain/DomainState.js';
import { ApiHandler         } from '../../src/network/api-handler.js';
import { DomainPipeline     } from '../../src/domain/DomainPipeline.js';

// ── 전역 설정 ─────────────────────────────────────────────────────────────────

beforeEach(() => {
    DomainState.configure({
        pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/**
 * 테스트용 ApiHandler와 fetchSpy를 생성한다.
 *
 * @returns {{ handler: ApiHandler, fetchSpy: import('vitest').Mock }}
 */
function createHandler() {
    const handler  = new ApiHandler({ host: 'localhost:8080' });
    const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);
    return { handler, fetchSpy };
}

/** 테스트용 JSON 배열 문자열 */
const CERT_JSON = JSON.stringify([
    { certId: 1, certName: '정보처리기사', certType: 'IT' },
    { certId: 2, certName: '한국사능력',   certType: 'HISTORY' },
]);

// ────────────────────────────────────────────────────────────────────────────
// 1. 팩토리 메서드
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection — 팩토리', () => {
    it('[TC-COL-001] create()는 빈 컬렉션을 생성해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);

        expect(certs.getCount()).toBe(0);
        expect(certs.getItems()).toEqual([]);
        expect(certs._isNew).toBe(true);
    });

    it('[TC-COL-002] create()의 _initialSnapshot은 null이어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        expect(certs._initialSnapshot).toBeNull();
    });

    it('[TC-COL-003] fromJSONArray()는 배열 길이만큼 DomainState 항목을 생성해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        expect(certs.getCount()).toBe(2);
        expect(certs._isNew).toBe(false);
    });

    it('[TC-COL-004] fromJSONArray()로 생성한 각 항목은 DomainState 인스턴스여야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        for (const item of certs.getItems()) {
            expect(item).toBeInstanceOf(DomainState);
        }
    });

    it('[TC-COL-005] fromJSONArray()로 생성한 항목의 데이터는 원본 JSON과 일치해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);
        const items = certs.getItems();

        expect(items[0]._getTarget()).toMatchObject({ certId: 1, certName: '정보처리기사' });
        expect(items[1]._getTarget()).toMatchObject({ certId: 2, certName: '한국사능력' });
    });

    it('[TC-COL-006] fromJSONArray()에 배열이 아닌 JSON 전달 시 Error를 throw해야 한다', () => {
        const { handler } = createHandler();
        expect(() =>
            DomainCollection.fromJSONArray(JSON.stringify({ data: [] }), handler)
        ).toThrow(/배열이어야 합니다/);
    });

    it('[TC-COL-007] fromJSONArray()에 유효하지 않은 JSON 전달 시 SyntaxError를 throw해야 한다', () => {
        const { handler } = createHandler();
        expect(() =>
            DomainCollection.fromJSONArray('NOT_VALID_JSON', handler)
        ).toThrow(SyntaxError);
    });

    it('[TC-COL-008] fromJSONArray()에 빈 배열 JSON 전달 시 항목 수가 0이어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray('[]', handler);
        expect(certs.getCount()).toBe(0);
    });

    it('[TC-COL-009] lazy 모드에서 fromJSONArray()는 _initialSnapshot을 저장해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler, { trackingMode: 'lazy' });

        expect(certs._initialSnapshot).not.toBeNull();
        expect(certs._initialSnapshot).toHaveLength(2);
        expect(certs._initialSnapshot[0]).toMatchObject({ certId: 1 });
    });

    it('[TC-COL-010] realtime 모드에서 fromJSONArray()의 _initialSnapshot은 null이어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler, { trackingMode: 'realtime' });
        expect(certs._initialSnapshot).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. add() / remove() 항목 조작
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection — add() / remove()', () => {
    it('[TC-COL-020] add()는 컬렉션에 항목을 추가하고 getCount()를 증가시켜야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);

        certs.add({ certName: '정보처리기사' });
        expect(certs.getCount()).toBe(1);

        certs.add({ certName: '한국사' });
        expect(certs.getCount()).toBe(2);
    });

    it('[TC-COL-021] add()는 DomainState 인스턴스를 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        const state = certs.add({ certName: '정보처리기사' });
        expect(state).toBeInstanceOf(DomainState);
    });

    it('[TC-COL-022] add()로 생성된 항목의 isNew는 true여야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        const state = certs.add({ certName: '정보처리기사' });
        expect(state._isNew).toBe(true);
    });

    it('[TC-COL-023] add()에 인자 없이 호출해도 에러 없이 빈 항목이 추가되어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        expect(() => certs.add()).not.toThrow();
        expect(certs.getCount()).toBe(1);
    });

    it('[TC-COL-024] remove(index)는 해당 인덱스 항목을 제거해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        const result = certs.remove(0);
        expect(result).toBe(true);
        expect(certs.getCount()).toBe(1);
        expect(certs.getItems()[0]._getTarget()).toMatchObject({ certId: 2 });
    });

    it('[TC-COL-025] remove(DomainState)는 참조 인스턴스를 제거해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);
        const target = certs.getItems()[0];

        const result = certs.remove(target);
        expect(result).toBe(true);
        expect(certs.getCount()).toBe(1);
        expect(certs.getItems()).not.toContain(target);
    });

    it('[TC-COL-026] 존재하지 않는 인덱스로 remove() 시 false를 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        expect(certs.remove(99)).toBe(false);
    });

    it('[TC-COL-027] 존재하지 않는 인스턴스로 remove() 시 false를 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        const orphanState = DomainState.fromJSON('{}', handler);
        expect(certs.remove(orphanState)).toBe(false);
    });

    it('[TC-COL-028] 빈 컬렉션에서 remove()는 false를 반환하고 에러가 없어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        expect(() => certs.remove(0)).not.toThrow();
        expect(certs.remove(0)).toBe(false);
    });

    // ── 역순(LIFO) splice 정확성 ────────────────────────────────────────────

    it('[TC-COL-029] 복수 항목 역순 제거 — 올바른 항목이 삭제되어야 한다', () => {
        const { handler } = createHandler();
        const json = JSON.stringify([
            { id: 0, v: 'A' },
            { id: 1, v: 'B' },
            { id: 2, v: 'C' },
            { id: 3, v: 'D' },
        ]);
        const certs = DomainCollection.fromJSONArray(json, handler);

        // 인덱스 0, 2 제거 — 반드시 내림차순(LIFO)으로 호출
        [2, 0].forEach((i) => certs.remove(i));

        expect(certs.getCount()).toBe(2);
        expect(certs.getItems()[0]._getTarget()).toMatchObject({ v: 'B' });
        expect(certs.getItems()[1]._getTarget()).toMatchObject({ v: 'D' });
    });

    it('[TC-COL-030] 정방향 제거 시 인덱스 밀림 현상 재현 — 역순 제거의 필요성 확인', () => {
        const { handler } = createHandler();
        const json = JSON.stringify([
            { id: 0, v: 'A' },
            { id: 1, v: 'B' },
            { id: 2, v: 'C' },
        ]);
        const certs = DomainCollection.fromJSONArray(json, handler);

        // 정방향: [0, 2] — 버그: 0 제거 후 C가 index 1로 밀려 index 2 제거 실패
        [0, 2].forEach((i) => certs.remove(i));

        // 정방향으로 하면 A와 (원래 C가 아닌) 이미 밀린 인덱스의 항목이 제거됨
        // 이 TC는 역순 제거가 왜 필요한지 재현하는 것이 목적이므로
        // "잘못된 결과"가 나오는 것을 확인한다
        expect(certs.getCount()).toBe(1); // 예상: 1개 남음 (B가 남아야 하지만...)
        // 정방향으로 0, 2 제거: [A,B,C] → remove(0) → [B,C] → remove(2) → no-op (길이 초과)
        // 실제로 [B,C]가 남는 것이 아니라 remove(2)가 범위 밖이라 [B,C]가 됨
        // 즉, C가 남아있는 버그 — 이것이 LIFO가 필요한 이유
        // (이 TC는 단순히 동작을 문서화하는 용도)
        expect(certs.getItems()[0]._getTarget()).toMatchObject({ v: 'B' });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. 상태 조회
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection — getItems() / getCount() / toJSON()', () => {
    it('[TC-COL-040] getItems()는 내부 배열의 얕은 복사본을 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        const items1 = certs.getItems();
        const items2 = certs.getItems();

        // 두 호출이 동일한 DomainState 참조를 담지만 배열 자체는 다른 참조
        expect(items1).not.toBe(items2);
        expect(items1[0]).toBe(items2[0]); // 내부 인스턴스는 같은 참조
    });

    it('[TC-COL-041] getCount()는 현재 항목 수를 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        expect(certs.getCount()).toBe(0);
        certs.add({ v: 'A' });
        expect(certs.getCount()).toBe(1);
        certs.remove(0);
        expect(certs.getCount()).toBe(0);
    });

    it('[TC-COL-042] toJSON()은 현재 상태의 순수 객체 배열을 반환해야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        const json = certs.toJSON();
        expect(Array.isArray(json)).toBe(true);
        expect(json).toHaveLength(2);
        expect(json[0]).toMatchObject({ certId: 1, certName: '정보처리기사' });
    });

    it('[TC-COL-043] toJSON()이 반환하는 항목은 Proxy가 아닌 순수 객체여야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);
        const json = certs.toJSON();
        // Proxy가 아닌 순수 객체는 JSON.stringify가 정상 동작해야 함
        expect(() => JSON.stringify(json)).not.toThrow();
    });

    it('[TC-COL-044] add() 후 data 변경이 toJSON()에 반영되어야 한다', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        const state = certs.add({ certName: 'Init' });

        state.data.certName = 'Updated';
        const json = certs.toJSON();
        expect(json[0].certName).toBe('Updated');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. saveAll() — batch 전략
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection.saveAll() — batch', () => {
    it('[TC-COL-050] create()로 생성한 컬렉션의 saveAll()은 POST를 전송해야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.create(handler);
        certs.add({ certName: '정보처리기사' });

        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('POST');
    });

    it('[TC-COL-051] fromJSONArray()로 생성한 컬렉션의 saveAll()은 PUT을 전송해야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PUT');
    });

    it('[TC-COL-052] saveAll() body에 현재 배열 전체가 직렬화되어야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        const [, options] = fetchSpy.mock.calls[0];
        const body = JSON.parse(/** @type {string} */ (options?.body));
        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(2);
        expect(body[0]).toMatchObject({ certId: 1 });
    });

    it('[TC-COL-053] POST 성공 후 _isNew가 false로 전환되어야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        certs.add({ certName: '정보처리기사' });

        expect(certs._isNew).toBe(true);
        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
        expect(certs._isNew).toBe(false);
    });

    it('[TC-COL-054] saveAll() 성공 후 각 항목의 changeLog가 초기화되어야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        // 항목 데이터 변경 → changeLog 쌓임 (realtime 모드)
        certs.getItems()[0].data.certName = 'Changed';

        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        // 성공 후 changeLog 초기화
        expect(certs.getItems()[0]._getChangeLog()).toHaveLength(0);
    });

    it('[TC-COL-055] saveAll() 성공 후 각 항목의 isNew가 false여야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        certs.add({ certName: '정보처리기사' });
        certs.add({ certName: '한국사' });

        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        for (const item of certs.getItems()) {
            expect(item._isNew).toBe(false);
        }
    });

    it('[TC-COL-056] add()로 항목 추가 후 saveAll() — 추가된 항목이 body에 포함되어야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        certs.add({ certName: '신규자격증', certType: 'NEW' });
        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        const [, options] = fetchSpy.mock.calls[0];
        const body = JSON.parse(/** @type {string} */ (options?.body));
        expect(body).toHaveLength(3); // 기존 2 + 신규 1
        expect(body[2]).toMatchObject({ certName: '신규자격증' });
    });

    it('[TC-COL-057] remove() 후 saveAll() — 제거된 항목이 body에 없어야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);

        certs.remove(0); // certId: 1 제거
        await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });

        const [, options] = fetchSpy.mock.calls[0];
        const body = JSON.parse(/** @type {string} */ (options?.body));
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({ certId: 2 });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. saveAll() — 실패 롤백
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection.saveAll() — 실패 롤백', () => {
    it('[TC-COL-060] saveAll() HTTP 오류 시 _isNew가 복원되어야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        fetchSpy.mockRejectedValueOnce({ status: 500, statusText: 'Error', body: '' });

        const certs = DomainCollection.create(handler);
        certs.add({ certName: '정보처리기사' });

        try {
            await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
        } catch {
            expect(certs._isNew).toBe(true); // 롤백 후 원래 true 유지
        }
    });

    it('[TC-COL-061] saveAll() 실패 후 각 항목 데이터가 복원되어야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        fetchSpy.mockRejectedValueOnce({ status: 409, statusText: 'Conflict', body: '' });

        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);
        certs.getItems()[0].data.certName = 'Changed'; // 변경 후 실패

        try {
            await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
        } catch {
            // 롤백 후 원래 값으로 복원
            expect(certs.getItems()[0]._getTarget()).toMatchObject({ certName: '정보처리기사' });
        }
    });

    it('[TC-COL-062] saveAll() 실패는 에러를 re-throw해야 한다', async () => {
        const { handler, fetchSpy } = createHandler();
        fetchSpy.mockRejectedValueOnce({ status: 500, statusText: 'Error', body: '' });

        const certs = DomainCollection.create(handler);
        certs.add({ certName: '정보처리기사' });

        await expect(
            certs.saveAll({ strategy: 'batch', path: '/api/certificates' })
        ).rejects.toMatchObject({ status: 500 });
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. saveAll() — 에러 케이스
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection.saveAll() — 에러 케이스', () => {
    it('[TC-COL-070] path 없이 saveAll() 호출 시 Error를 throw해야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);

        await expect(
            certs.saveAll(/** @type {any} */ ({ strategy: 'batch' }))
        ).rejects.toThrow(/path/i);
    });

    it('[TC-COL-071] 미지원 strategy 전달 시 Error를 throw해야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);

        await expect(
            certs.saveAll(/** @type {any} */ ({ strategy: 'sequential', path: '/api/certs' }))
        ).rejects.toThrow(/sequential/);
    });

    it('[TC-COL-072] handler 없이 saveAll() 호출 시 Error를 throw해야 한다', async () => {
        // handler를 null로 강제 설정
        const { handler } = createHandler();
        const certs = DomainCollection.create(handler);
        /** @type {any} */ (certs)._handler = null;

        await expect(
            certs.saveAll({ strategy: 'batch', path: '/api/certs' })
        ).rejects.toThrow(/ApiHandler/);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. lazy trackingMode 상호작용
// ────────────────────────────────────────────────────────────────────────────
describe('DomainCollection — lazy trackingMode', () => {
    it('[TC-COL-080] lazy 모드에서 saveAll() 성공 후 _initialSnapshot이 갱신되어야 한다', async () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler, { trackingMode: 'lazy' });

        // 항목 추가 후 saveAll
        certs.add({ certName: '신규' });
        await certs.saveAll({ strategy: 'batch', path: '/api/certs' });

        // 성공 후 _initialSnapshot은 현재 toJSON() 결과와 같아야 함
        expect(certs._initialSnapshot).toHaveLength(3);
        expect(certs._initialSnapshot?.[2]).toMatchObject({ certName: '신규' });
    });

    it('[TC-COL-081] lazy 모드에서 각 항목의 changeLog는 항상 비어있어야 한다 (set 트랩 건너뜀)', () => {
        const { handler } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler, { trackingMode: 'lazy' });

        certs.getItems()[0].data.certName = 'Changed';

        // lazy 모드: set 트랩이 changeLog 기록을 건너뜀
        expect(certs.getItems()[0]._getChangeLog()).toHaveLength(0);
    });

    it('[TC-COL-082] realtime 모드(기본) 하위 호환 — trackingMode 미지정 시 정상 동작', async () => {
        const { handler, fetchSpy } = createHandler();
        const certs = DomainCollection.fromJSONArray(CERT_JSON, handler);
        // realtime 기본값 확인
        expect(certs._trackingMode).toBe('realtime');

        await certs.saveAll({ strategy: 'batch', path: '/api/certs' });
        expect(fetchSpy).toHaveBeenCalledOnce();
    });
});
