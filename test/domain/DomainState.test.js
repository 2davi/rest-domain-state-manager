import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { DomainVO } from '../../src/domain/DomainVO.js';
import { makeUserDto, makeHttpError } from '../fixtures/index.js';

// ── Mock ApiHandler 팩토리 ─────────────────────────────────────────────────────
/**
 * vi.fn()으로 _fetch를 제어하는 Mock handler.
 * @param {object} [fetchResult]  - _fetch가 resolve할 값 (기본: null → 성공)
 * @param {object} [fetchError]   - _fetch가 reject할 에러 (지정 시 throw)
 */
function mockHandler({ fetchResult = null, fetchError = null } = {}) {
    return {
        _fetch: fetchError
            ? vi.fn().mockRejectedValue(fetchError)
            : vi.fn().mockResolvedValue(fetchResult),
        getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
        isDebug: () => false,
    };
}

// ── 테스트용 DomainVO ──────────────────────────────────────────────────────────
class UserVO extends DomainVO {
    static fields = {
        userId: { default: '' },
        name: { default: '' },
        email: { default: '' },
        role: { default: '' },
        address: { default: { city: '', zip: '' } },
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// 팩토리 메서드
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState.fromJSON()', () => {
    it('isNew가 false로 생성된다', () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        expect(state._isNew).toBe(false);
    });

    it('data getter가 Proxy 객체를 반환한다', () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        expect(state.data).toBeDefined();
        // Proxy 여부는 변경 추적으로 간접 확인
        state.data.name = 'Test';
        expect(state._getChangeLog()).toHaveLength(1);
    });
});

describe('DomainState.fromVO()', () => {
    it('isNew가 true로 생성된다', () => {
        const state = DomainState.fromVO(new UserVO(), mockHandler());
        expect(state._isNew).toBe(true);
    });

    it('validators/transformers가 주입된다', () => {
        const state = DomainState.fromVO(new UserVO(), mockHandler());
        // UserVO에는 필드가 5개인데 validate는 없으므로 validators는 빈 객체
        expect(state._validators).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-DS-001 ~ TC-DS-005  save() HTTP 메서드 분기 (1-A / 1-B)
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState.save() — HTTP 메서드 분기', () => {
    it('TC-DS-001: isNew===true → POST', async () => {
        const handler = mockHandler();
        const state = DomainState.fromVO(new UserVO(), handler);
        await state.save('/api/users');
        expect(handler._fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('TC-DS-002: POST 성공 후 isNew가 false로 전환', async () => {
        const handler = mockHandler();
        const state = DomainState.fromVO(new UserVO(), handler);
        await state.save('/api/users');
        expect(state._isNew).toBe(false);
    });

    it('TC-DS-003: dirtyFields.size===0 → PUT (변경 없음)', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        // 아무 변경 없이 save
        await state.save('/api/users/1');
        expect(handler._fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ method: 'PUT' })
        );
    });

    it('TC-DS-004: dirtyRatio >= 0.7 → PUT (5개 중 4개 = 80% 변경)', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        // 5개 필드 중 4개 변경 (80%)
        state.data.name = 'Lee';
        state.data.email = 'lee@example.com';
        state.data.role = 'user';
        state.data.address = { city: 'Busan', zip: '12345' };
        await state.save('/api/users/1');
        expect(handler._fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ method: 'PUT' })
        );
    });

    it('TC-DS-005: dirtyRatio < 0.7 → PATCH + RFC 6902 형식 payload', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        // 5개 필드 중 1개 변경 (20%)
        state.data.name = 'Lee';
        await state.save('/api/users/1');

        const call = handler._fetch.mock.calls[0];
        expect(call[1].method).toBe('PATCH');

        const body = JSON.parse(call[1].body);
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toMatchObject({ op: expect.any(String), path: expect.any(String) });
    });

    it('성공 후 changeLog가 비워진다', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        state.data.name = 'Lee';
        await state.save('/api/users/1');
        expect(state._getChangeLog()).toHaveLength(0);
    });

    it('성공 후 dirtyFields가 비워진다', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        state.data.name = 'Lee';
        await state.save('/api/users/1');
        expect(state._getDirtyFields().size).toBe(0);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-DS-006 ~ TC-DS-009  Optimistic Update 롤백 (1-D)
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState.save() — Optimistic Update 롤백 (1-D)', () => {
    let state, handler;

    beforeEach(() => {
        handler = mockHandler({ fetchError: makeHttpError(409) });
        state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
    });

    it('TC-DS-006: HTTP 4xx → save() 진입 시점 상태가 오염되지 않음', async () => {
        // ── Arrange: 복수 필드 mutation (2/5 = 40% → PATCH 분기)
        state.data.name = 'Lee';
        state.data.email = 'lee@example.com';

        // save() 진입 직전 상태를 기준점으로 캡처
        const changeLogCountBefore = state._getChangeLog().length; // 2
        const dirtyFieldsCountBefore = state._getDirtyFields().size; // 2

        // ── Act: save() 실패
        await expect(state.save('/api/users/1')).rejects.toBeDefined();

        // ── Assert ①: domainObject — mutation 값이 그대로 살아있음
        // (rollback은 save() 진입 시점으로 복원. mutation은 그 이전이므로 유지됨)
        expect(state._getTarget().name).toBe('Lee');
        expect(state._getTarget().email).toBe('lee@example.com');

        // ── Assert ②: changeLog — save() 진입 시점 이력 intact (2건)
        expect(state._getChangeLog()).toHaveLength(changeLogCountBefore);

        // ── Assert ③: dirtyFields — save() 진입 시점 집합 intact (2개)
        expect(state._getDirtyFields().size).toBe(dirtyFieldsCountBefore);
    });

    it('TC-DS-007: HTTP 오류 → changeLog가 save() 이전 상태로 복원', async () => {
        state.data.name = 'Lee';
        const logBefore = state._getChangeLog().length; // 1

        await expect(state.save('/api/users/1')).rejects.toBeDefined();
        expect(state._getChangeLog()).toHaveLength(logBefore);
    });

    it('TC-DS-008: HTTP 오류 → 에러가 re-throw됨 (호출자 catch 가능)', async () => {
        state.data.name = 'Lee';
        let caught;
        try {
            await state.save('/api/users/1');
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeDefined();
        expect(caught.status).toBe(409);
    });

    it('TC-DS-009: 롤백 후 재시도 → 올바른 메서드로 전송됨', async () => {
        state.data.name = 'Lee';

        // 첫 번째 시도 — 실패
        await expect(state.save('/api/users/1')).rejects.toBeDefined();

        // 두 번째 시도 — 성공 mock으로 교체
        handler._fetch.mockResolvedValue(null);
        await state.save('/api/users/1');

        const lastCall = handler._fetch.mock.calls.at(-1);
        expect(['PATCH', 'PUT']).toContain(lastCall[1].method);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-DS-010 ~ TC-DS-011  Batching Scheduler (1-C)
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState — Batching Scheduler (1-C)', () => {
    it('TC-DS-010: 동기 블록 다중 변경 → _broadcast는 microtask 후 단 1회', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler, { debug: true });
        const broadcastSpy = vi.spyOn(state, '_broadcast');

        // 동기 블록 안에서 3개 변경
        state.data.name = 'A';
        state.data.email = 'B';
        state.data.role = 'C';

        // microtask가 아직 실행되기 전 — broadcast 호출 없음
        expect(broadcastSpy).toHaveBeenCalledTimes(0);

        // microtask 처리 대기
        await Promise.resolve();
        await Promise.resolve(); // queueMicrotask는 두 tick 이후 실행될 수 있음

        expect(broadcastSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-DS-011: await 경계 → 각 블록 독립 flush', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler, { debug: true });
        const broadcastSpy = vi.spyOn(state, '_broadcast');

        state.data.name = 'A';
        await Promise.resolve();
        await Promise.resolve();

        state.data.email = 'B';
        await Promise.resolve();
        await Promise.resolve();

        expect(broadcastSpy).toHaveBeenCalledTimes(2);
    });
});

describe('DomainState.remove()', () => {
    it('DELETE 메서드로 요청 전송', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);
        await state.remove('/api/users/1');
        expect(handler._fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ method: 'DELETE' })
        );
    });
});
