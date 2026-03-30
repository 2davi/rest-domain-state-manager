import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { DomainPipeline } from '../../src/domain/DomainPipeline.js';
import { makeUserDto } from '../fixtures/index.js';

// DomainState.PipelineConstructor 주입 (진입점 없이 직접 테스트 시 필요)
DomainState.configure({ pipelineFactory: (...args) => new DomainPipeline(...args) });

function makeDomainState() {
    return DomainState.fromJSON(JSON.stringify(makeUserDto()), {
        _fetch: vi.fn().mockResolvedValue(null),
        getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
        isDebug: () => false,
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// TC-P-001  after() 유효성 검사
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainPipeline.after()', () => {
    it('TC-P-001: 존재하지 않는 key → 즉시 Error throw', () => {
        const pipeline = new DomainPipeline({ user: Promise.resolve(makeDomainState()) });
        expect(() => pipeline.after('nonExistent', () => {})).toThrow();
    });

    it('handler가 함수가 아닐 때 TypeError throw', () => {
        const pipeline = new DomainPipeline({ user: Promise.resolve(makeDomainState()) });
        expect(() => pipeline.after('user', 'not a function')).toThrow(TypeError);
    });

    it('체이닝 가능 (this 반환)', () => {
        const pipeline = new DomainPipeline({ user: Promise.resolve(makeDomainState()) });
        const result = pipeline.after('user', () => {});
        expect(result).toBe(pipeline);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-P-002  run() — strict:false
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainPipeline.run() — strict:false', () => {
    it('TC-P-002: fetch 실패 → _errors 기록, 나머지 계속 진행', async () => {
        const result = await new DomainPipeline(
            {
                user: Promise.resolve(makeDomainState()),
                role: Promise.reject({ status: 500 }),
            },
            { strict: false }
        ).run();

        expect(result.user).toBeDefined();
        expect(result._errors).toHaveLength(1);
        expect(result._errors[0].key).toBe('role');
    });

    it('TC-P-004: after() 핸들러가 등록 순서대로 실행', async () => {
        const callOrder = [];
        const result = await new DomainPipeline({
            a: Promise.resolve(makeDomainState()),
            b: Promise.resolve(makeDomainState()),
        })
            .after('a', () => {
                callOrder.push('a');
            })
            .after('b', () => {
                callOrder.push('b');
            })
            .run();

        expect(callOrder).toEqual(['a', 'b']);
    });

    it('fetch 실패한 키의 after() 핸들러는 건너뜀', async () => {
        const handler = vi.fn();
        await new DomainPipeline(
            {
                user: Promise.reject({ status: 404 }),
            },
            { strict: false }
        )
            .after('user', handler)
            .run();

        expect(handler).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-P-003  run() — strict:true
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainPipeline.run() — strict:true', () => {
    it('TC-P-003: fetch 실패 시 즉시 reject', async () => {
        await expect(
            new DomainPipeline(
                {
                    user: Promise.reject({ status: 500 }),
                },
                { strict: true }
            ).run()
        ).rejects.toBeDefined();
    });

    it('after() 핸들러 실패 시 즉시 reject', async () => {
        await expect(
            new DomainPipeline(
                {
                    user: Promise.resolve(makeDomainState()),
                },
                { strict: true }
            )
                .after('user', () => {
                    throw new Error('handler error');
                })
                .run()
        ).rejects.toThrow('handler error');
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// DomainPipeline — failurePolicy 보상 트랜잭션
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainPipeline — failurePolicy 보상 트랜잭션', () => {

    function makeState() {
        return DomainState.fromJSON(JSON.stringify(makeUserDto()), {
            _fetch: vi.fn().mockResolvedValue(null),
            getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
            isDebug: () => false,
        });
    }

    // ── RT-P-001: 'ignore' (기본값) — 기존 동작 유지 ─────────────────────────

    it('RT-P-001: failurePolicy 미지정(ignore) 시 restore() 미호출', async () => {
        const stateA = makeState();
        const stateB = makeState();
        const restoreSpy = vi.spyOn(stateA, 'restore');

        const failHandler = vi.fn().mockRejectedValue(new Error('fail'));

        await new DomainPipeline(
            { a: Promise.resolve(stateA), b: Promise.resolve(stateB) },
            { failurePolicy: 'ignore' }
        )
            .after('a', async (s) => { s.data.name = 'Lee'; await s.save('/api/a'); })
            .after('b', failHandler)
            .run();

        expect(restoreSpy).not.toHaveBeenCalled();
    });

    // ── RT-P-002: 'rollback-all' — 전체 restore() ────────────────────────────

    it('RT-P-002: rollback-all 시 에러 발생하면 전체 resolved에 restore() 호출', async () => {
        const stateA = makeState();
        const stateB = makeState();

        const restoreSpyA = vi.spyOn(stateA, 'restore');
        const restoreSpyB = vi.spyOn(stateB, 'restore');

        await new DomainPipeline(
            { a: Promise.resolve(stateA), b: Promise.resolve(stateB) },
            { failurePolicy: 'rollback-all' }
        )
            .after('a', async (s) => { await s.save('/api/a'); })
            .after('b', async () => { throw new Error('b fail'); })
            .run();

        expect(restoreSpyA).toHaveBeenCalledOnce();
        expect(restoreSpyB).toHaveBeenCalledOnce();
    });

    // ── RT-P-003: 'fail-fast' — LIFO restore() ───────────────────────────────

    it('RT-P-003: fail-fast 시 첫 실패 즉시 중단 + 이전 성공 역순 restore()', async () => {
        const stateA = makeState();
        const stateB = makeState();
        const stateC = makeState();

        const callOrder   = [];
        const restoreSpyA = vi.spyOn(stateA, 'restore').mockImplementation(() => { callOrder.push('restore:a'); return true; });
        const restoreSpyB = vi.spyOn(stateB, 'restore').mockImplementation(() => { callOrder.push('restore:b'); return true; });
        const handlerCSpy = vi.fn();

        await new DomainPipeline(
            { a: Promise.resolve(stateA), b: Promise.resolve(stateB), c: Promise.resolve(stateC) },
            { failurePolicy: 'fail-fast' }
        )
            .after('a', async (s) => { callOrder.push('save:a'); await s.save('/api/a'); })
            .after('b', async (s) => { callOrder.push('save:b'); await s.save('/api/b'); })
            .after('c', async () => { callOrder.push('fail:c'); throw new Error('c fail'); })
            .run();

        // c 핸들러 이후 핸들러는 실행되지 않음 (없지만 구조 검증)
        // LIFO 보상: b → a 순서
        expect(callOrder).toEqual(['save:a', 'save:b', 'fail:c', 'restore:b', 'restore:a']);
        expect(restoreSpyA).toHaveBeenCalledOnce();
        expect(restoreSpyB).toHaveBeenCalledOnce();
        // stateC는 save() 미호출 → restore() 호출해도 no-op
    });

    // ── RT-P-004: 정상 경로 — 에러 없으면 보상 없음 ──────────────────────────

    it('RT-P-004: rollback-all 설정에서 에러 없으면 restore() 미호출', async () => {
        const stateA = makeState();
        const restoreSpy = vi.spyOn(stateA, 'restore');

        await new DomainPipeline(
            { a: Promise.resolve(stateA) },
            { failurePolicy: 'rollback-all' }
        )
            .after('a', async (s) => { await s.save('/api/a'); })
            .run();

        expect(restoreSpy).not.toHaveBeenCalled();
    });
});
