import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { DomainPipeline } from '../../src/domain/DomainPipeline.js';
import { makeUserDto } from '../fixtures/index.js';

// DomainState.PipelineConstructor 주입 (진입점 없이 직접 테스트 시 필요)
DomainState.PipelineConstructor = DomainPipeline;

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
