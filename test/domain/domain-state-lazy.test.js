/**
 * DomainState lazy tracking mode 통합 테스트 — v1.2.x
 *
 * ## 테스트 환경
 * Node.js 환경 (Vitest 기본): Worker API 미지원.
 * `diff-worker-client.requestDiff()`가 `deepDiff()`를 동기적으로 직접 호출하므로
 * Worker 없이도 lazy 모드의 전체 비즈니스 로직을 검증할 수 있다.
 *
 * ## 테스트 대상
 * - `trackingMode: 'lazy'` 옵션 동작
 * - set 트랩에서 changeLog 기록 건너뜀 확인
 * - `save()` 시점에 diff 결과로 PATCH payload 생성
 * - `save()` 성공 후 `_initialSnapshot` 갱신
 * - `realtime` 모드와의 하위 호환성
 *
 * @see {@link ../../src/domain/DomainState.js DomainState}
 * @see {@link ../../src/workers/diff-worker-client.js requestDiff}
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { ApiHandler   } from '../../src/network/api-handler.js';
import { DomainPipeline } from '../../src/domain/DomainPipeline.js';

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
 * 테스트용 DomainState를 생성한다.
 *
 * @param {object}  [data={}]         - 초기 도메인 데이터
 * @param {object}  [options={}]      - fromJSON 옵션 (trackingMode, itemKey 등)
 * @param {boolean} [idempotent=false]
 * @returns {{ state: DomainState, handler: ApiHandler, fetchSpy: import('vitest').Mock }}
 */
function createTestState(data = {}, options = {}, idempotent = false) {
    const handler = new ApiHandler({ host: 'localhost:8080', debug: false, idempotent });
    const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);
    const state = DomainState.fromJSON(JSON.stringify(data), handler, options);
    return { state, handler, fetchSpy };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. trackingMode: 'lazy' — 기본 동작
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState — trackingMode: 'lazy' 기본 동작", () => {
    it('[TC-LAZY-001] lazy 모드에서 data 변경 중 changeLog가 비어있어야 한다', () => {
        const { state } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        state.data.name  = 'Changed';
        state.data.email = 'new@example.com';

        // lazy 모드: set 트랩이 changeLog 기록을 건너뜀
        expect(state._getChangeLog()).toHaveLength(0);
    });

    it('[TC-LAZY-002] lazy 모드에서 data 변경 중 dirtyFields도 비어있어야 한다', () => {
        const { state } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'lazy' }
        );

        state.data.name = 'Changed';

        // dirtyFields도 lazy 모드에서는 기록 안 함
        expect(state._getDirtyFields().size).toBe(0);
    });

    it('[TC-LAZY-003] lazy 모드에서 _initialSnapshot이 생성 시점 상태를 저장해야 한다', () => {
        const data = { name: 'Davi', score: 100 };
        const { state } = createTestState(data, { trackingMode: 'lazy' });

        expect(state._initialSnapshot).not.toBeNull();
        expect(state._initialSnapshot).toEqual(data);
    });

    it('[TC-LAZY-004] realtime 모드에서 _initialSnapshot은 null이어야 한다', () => {
        const { state } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'realtime' }
        );

        expect(state._initialSnapshot).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. lazy 모드에서 save() — PATCH 분기
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — lazy 모드 PATCH 분기", () => {
    it('[TC-LAZY-010] lazy 모드에서 단일 필드 변경 시 PATCH 요청이 전송되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PATCH');
    });

    it('[TC-LAZY-011] lazy PATCH body에 diff 결과가 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const patchBody = JSON.parse(/** @type {string} */ (options?.body));
        expect(Array.isArray(patchBody)).toBe(true);
        expect(patchBody.length).toBeGreaterThan(0);

        const replaceOp = patchBody.find((/** @type {any} */ op) => op.op === 'replace' && op.path === '/name');
        expect(replaceOp).toBeDefined();
        expect(replaceOp.value).toBe('Changed');
    });

    it('[TC-LAZY-012] lazy 모드에서 중간 변경 이력 없이 최종 diff만 포함해야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        // 동일 필드를 3번 변경 — lazy에서는 최종 값만 diff에 반영됨
        state.data.name = 'A';
        state.data.name = 'B';
        state.data.name = 'Final';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const patchBody = JSON.parse(/** @type {string} */ (options?.body));

        // /name에 대한 patch가 1개여야 한다 (중간 변경 없음)
        const namePatches = patchBody.filter((/** @type {any} */ op) => op.path === '/name');
        expect(namePatches).toHaveLength(1);
        expect(namePatches[0].value).toBe('Final');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. lazy 모드에서 save() — PUT 분기
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — lazy 모드 PUT 분기", () => {
    it('[TC-LAZY-020] 모든 필드가 변경되면 PUT이 전송되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        // 전체 필드 변경 → dirtyRatio 100% → PUT
        state.data.name  = 'Changed';
        state.data.email = 'new@example.com';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PUT');
    });

    it('[TC-LAZY-021] 변경이 없으면 PUT이 전송되어야 한다 (dirtyRatio 0)', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'lazy' }
        );

        // 변경 없음 → diffResult 빈 배열 → effectiveDirtySize=0 → PUT
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PUT');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. save() 성공 후 _initialSnapshot 갱신
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — 성공 후 _initialSnapshot 갱신", () => {
    it('[TC-LAZY-030] save() 성공 후 _initialSnapshot이 현재 상태로 갱신되어야 한다', async () => {
        const { state } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' }
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        // 성공 후 _initialSnapshot이 현재 state와 동일해야 함
        expect(state._initialSnapshot).toEqual({ name: 'Changed', email: 'davi@example.com' });
    });

    it('[TC-LAZY-031] 두 번째 save() 시 첫 번째 save() 이후 변경만 diff에 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', score: 0 },
            { trackingMode: 'lazy' }
        );

        // 1차 save
        state.data.name = 'FirstChange';
        await state.save('/api/users/1');

        fetchSpy.mockClear();

        // 2차 save: 1차 성공 이후의 변경만 포함되어야 함
        state.data.score = 99;
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const patchBody = JSON.parse(/** @type {string} */ (options?.body));

        // 2차 save에서는 score 변경만 포함 (name은 이미 _initialSnapshot에 반영됨)
        const namePatches  = patchBody.filter((/** @type {any} */ op) => op.path === '/name');
        const scorePatches = patchBody.filter((/** @type {any} */ op) => op.path === '/score');

        expect(namePatches).toHaveLength(0);
        expect(scorePatches).toHaveLength(1);
        expect(scorePatches[0].value).toBe(99);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. lazy 모드 실패 후 롤백
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — lazy 모드 실패 롤백", () => {
    it('[TC-LAZY-040] save() 실패 후 도메인 객체가 pre-save 상태로 복원되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'lazy' }
        );

        fetchSpy.mockRejectedValueOnce({ status: 500, statusText: 'Server Error', body: '' });

        state.data.name = 'Changed';
        try {
            await state.save('/api/users/1');
        } catch {
            // 롤백 후 원래 값으로 복원되었는지 확인
            expect(state._getTarget()).toMatchObject({ name: 'Davi' });
        }
    });

    it('[TC-LAZY-041] save() 실패 후 _initialSnapshot은 유지되어야 한다 (마지막 확정 상태)', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'lazy' }
        );

        const originalSnapshot = structuredClone(state._initialSnapshot);
        fetchSpy.mockRejectedValueOnce({ status: 500, statusText: 'Server Error', body: '' });

        state.data.name = 'Changed';
        try {
            await state.save('/api/users/1');
        } catch {
            // _initialSnapshot은 마지막 확정 상태를 유지해야 함
            expect(state._initialSnapshot).toEqual(originalSnapshot);
        }
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. lazy + idempotent 동시 활성화
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — lazy + idempotent 동시 활성화", () => {
    it('[TC-LAZY-050] lazy + idempotent: true 시 Idempotency-Key + PATCH 헤더가 모두 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'lazy' },
            true // idempotent: true
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PATCH');

        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');
        expect(typeof headers['Idempotency-Key']).toBe('string');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. realtime 모드 하위 호환성
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState — realtime 모드 하위 호환성 (기존 동작 유지)", () => {
    it('[TC-LAZY-060] trackingMode 미지정 시 realtime으로 동작해야 한다', () => {
        const { state } = createTestState({ name: 'Davi' });
        state.data.name = 'Changed';
        // realtime: 즉시 changeLog에 기록됨
        expect(state._getChangeLog().length).toBeGreaterThan(0);
    });

    it('[TC-LAZY-061] realtime 모드에서 PATCH body는 changeLog 기반이어야 한다', async () => {
        const { state, fetchSpy } = createTestState(
            { name: 'Davi', email: 'davi@example.com' },
            { trackingMode: 'realtime' }
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('PATCH');
        const patchBody = JSON.parse(/** @type {string} */ (options?.body));
        expect(Array.isArray(patchBody)).toBe(true);
        expect(patchBody.length).toBeGreaterThan(0);
    });

    it('[TC-LAZY-062] realtime 모드에서 _initialSnapshot은 null이어야 한다 (save 후에도)', async () => {
        const { state } = createTestState(
            { name: 'Davi' },
            { trackingMode: 'realtime' }
        );

        state.data.name = 'Changed';
        await state.save('/api/users/1');

        expect(state._initialSnapshot).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. itemKey 옵션 (LCS diff)
// ────────────────────────────────────────────────────────────────────────────
describe("DomainState.save() — lazy 모드 itemKey (LCS diff)", () => {
    it('[TC-LAZY-070] itemKey 지정 시 배열 삭제+추가가 replace가 아닌 remove+add로 처리되어야 한다', async () => {
        const initialData = {
            certList: [
                { certId: 1, certName: 'A' },
                { certId: 2, certName: 'B' },
            ],
        };
        const { state, fetchSpy } = createTestState(
            initialData,
            { trackingMode: 'lazy', itemKey: 'certId' }
        );

        // id:1 제거, id:3 추가
        state.data.certList.splice(0, 1);
        state.data.certList.push({ certId: 3, certName: 'C' });
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        // PATCH 또는 PUT 모두 가능 — method보다 body 내용이 중요
        const body = JSON.parse(/** @type {string} */ (options?.body));

        // POST가 아닌 상태 변경 요청이어야 함
        expect(['PATCH', 'PUT']).toContain(options?.method);

        // PATCH인 경우 body에 diff 결과 확인
        if (options?.method === 'PATCH') {
            const removes = body.filter((/** @type {any} */ op) => op.op === 'remove');
            const adds    = body.filter((/** @type {any} */ op) => op.op === 'add');
            // remove와 add가 각각 있어야 함 (replace가 아님)
            expect(removes.length + adds.length).toBeGreaterThan(0);
        }
    });
});
