import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { DomainVO } from '../../src/domain/DomainVO.js';
import { makeUserDto, makeHttpError } from '../fixtures/index.js';
import { isSilent, setSilent } from '../../src/common/logger.js';

it('isSilent()는 setSilent() 설정값을 반환해야 한다', () => {
    setSilent(true);
    expect(isSilent()).toBe(true);
    setSilent(false); // 복원
    expect(isSilent()).toBe(false);
});

afterEach(() => {
    // _pipelineFactory는 모듈 클로저 변수라 외부 리셋 불가.
    // 각 beforeEach에서 configure()로 새 mock이 주입되므로 오염 없음.
});

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

// ══════════════════════════════════════════════════════════════════════════════
// Shadow State — subscribe / getSnapshot / Structural Sharing
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState — Shadow State (subscribe / getSnapshot)', () => {
    // ── getSnapshot 초기 상태 ──────────────────────────────────────────────────

    it('SS-001: 인스턴스 생성 직후 getSnapshot()이 초기 데이터를 담은 객체를 반환한다', () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const snap = state.getSnapshot();
        expect(snap).toBeDefined();
        expect(snap.name).toBe(makeUserDto().name);
    });

    it('SS-002: 변경 없이 getSnapshot() 두 번 호출 시 동일 참조를 반환한다 (무한루프 방지)', () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const snap1 = state.getSnapshot();
        const snap2 = state.getSnapshot();
        expect(snap1).toBe(snap2); // Object.is() 기준 동일 참조
    });

    // ── 변경 후 새 참조 ──────────────────────────────────────────────────────

    it('SS-003: data 변경 후 microtask flush 완료 시 getSnapshot()이 새 참조를 반환한다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const snap1 = state.getSnapshot();

        state.data.name = 'Lee';

        // microtask flush 대기
        await Promise.resolve();
        await Promise.resolve();

        const snap2 = state.getSnapshot();
        expect(snap1).not.toBe(snap2); // 새 참조
        expect(snap2.name).toBe('Lee'); // 값 반영 확인
    });

    // ── Structural Sharing ───────────────────────────────────────────────────

    it('SS-004: 변경된 키는 새 참조, 변경 없는 키는 이전 스냅샷 참조를 재사용한다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const snap1 = state.getSnapshot();

        // name만 변경 (address는 미변경)
        state.data.name = 'Lee';

        await Promise.resolve();
        await Promise.resolve();

        const snap2 = state.getSnapshot();

        // 변경된 키: 새 값
        expect(snap2.name).toBe('Lee');

        // 변경 없는 중첩 객체: 참조 재사용 (Structural Sharing)
        expect(snap2.address).toBe(snap1.address);
    });

    // ── subscribe / 구독 해제 ────────────────────────────────────────────────

    it('SS-005: subscribe()로 등록한 리스너가 data 변경 후 microtask flush 시 호출된다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const listener = vi.fn();

        state.subscribe(listener);
        state.data.name = 'Lee';

        await Promise.resolve();
        await Promise.resolve();

        expect(listener).toHaveBeenCalledOnce();
    });

    it('SS-006: subscribe()가 반환한 cleanup 함수 호출 후 리스너가 해제된다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const listener = vi.fn();

        const unsubscribe = state.subscribe(listener);
        unsubscribe(); // 즉시 해제

        state.data.name = 'Lee';

        await Promise.resolve();
        await Promise.resolve();

        expect(listener).not.toHaveBeenCalled();
    });

    it('SS-007: 변경 없으면 리스너가 호출되지 않는다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        const listener = vi.fn();

        state.subscribe(listener);
        // data 변경 없음

        await Promise.resolve();
        await Promise.resolve();

        expect(listener).not.toHaveBeenCalled();
    });

    // ── 리스너 에러 격리 ─────────────────────────────────────────────────────

    it('SS-008: 하나의 리스너 에러가 다른 리스너 실행을 막지 않는다', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());

        const failingListener = vi.fn(() => {
            throw new Error('listener error');
        });
        const successListener = vi.fn();

        state.subscribe(failingListener);
        state.subscribe(successListener);

        state.data.name = 'Lee';

        await Promise.resolve();
        await Promise.resolve();

        expect(failingListener).toHaveBeenCalledOnce();
        expect(successListener).toHaveBeenCalledOnce(); // 에러에 영향받지 않음
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// DomainState.restore() — 보상 트랜잭션
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainState.restore() — 보상 트랜잭션', () => {
    // ── RT-DS-001: 정상 복원 ─────────────────────────────────────────────────

    it('RT-DS-001: save() 후 restore() → save() 진입 이전 상태로 복원된다', async () => {
        const handler = mockHandler();
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), handler);

        state.data.name = 'Lee';
        const changeLogBeforeSave = state._getChangeLog().length; // 1

        await state.save('/api/users/1');

        // save() 성공 후 changeLog는 비워짐
        expect(state._getChangeLog()).toHaveLength(0);

        // restore() 호출
        const result = state.restore();

        expect(result).toBe(true);
        // save() 진입 이전 값으로 복원: name = 'Lee', changeLog = 1개
        expect(state._getTarget().name).toBe('Lee');
        expect(state._getChangeLog()).toHaveLength(changeLogBeforeSave);
    });

    // ── RT-DS-002: 멱등성 — 스냅샷 없음 ─────────────────────────────────────

    it('RT-DS-002: save() 미호출 시 restore() → false 반환, no-op', () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        // save() 한 번도 호출 안 함

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = state.restore();

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledOnce();
        warnSpy.mockRestore();
    });

    // ── RT-DS-003: 멱등성 — 2회 연속 호출 ───────────────────────────────────

    it('RT-DS-003: restore() 2회 연속 호출 시 두 번째는 false 반환', async () => {
        const state = DomainState.fromJSON(JSON.stringify(makeUserDto()), mockHandler());
        state.data.name = 'Lee';
        await state.save('/api/users/1');

        const first = state.restore();
        const second = state.restore(); // #snapshot이 이미 undefined

        expect(first).toBe(true);
        expect(second).toBe(false);
    });

    // ── RT-DS-004: dsm:rollback 이벤트 (jsdom 환경 필요) ─────────────────────
    // jsdom 환경에서만 window.dispatchEvent가 동작한다.
    // DomainState.test.js는 node 환경이므로 이벤트 검증은 pipeline 통합 테스트에서 수행한다.
});
