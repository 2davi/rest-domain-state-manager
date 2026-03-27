import { describe, it, expect, vi } from 'vitest';
import { DomainVO } from '../../src/domain/DomainVO.js';
import { DomainState } from '../../src/domain/DomainState.js';

// ── 테스트용 서브클래스 정의 ──────────────────────────────────────────────────
class UserVO extends DomainVO {
    static baseURL = 'localhost:8080/api/users';
    static fields = {
        userId: { default: '' },
        name: { default: '', validate: (v) => v.trim().length > 0 },
        age: { default: 0, validate: (v) => v >= 0, transform: Number },
        address: { default: { city: '', zip: '' } },
    };
}

class EmptyVO extends DomainVO {} // static fields 없음

// ══════════════════════════════════════════════════════════════════════════════
// TC-V-001 ~ TC-V-002  toSkeleton()
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainVO — toSkeleton()', () => {
    it('TC-V-001: static fields default 값으로 골격 객체 생성', () => {
        const skeleton = new UserVO().toSkeleton();
        expect(skeleton).toMatchObject({ userId: '', name: '', age: 0 });
        expect(skeleton.address).toMatchObject({ city: '', zip: '' });
    });

    it('TC-V-002: 객체 default → 인스턴스마다 독립 참조 (deep copy)', () => {
        const a = new UserVO().toSkeleton();
        const b = new UserVO().toSkeleton();
        expect(a.address).not.toBe(b.address); // 다른 참조
    });

    it('default 미선언 필드 → 빈 문자열로 초기화', () => {
        class MinVO extends DomainVO {
            static fields = { title: {} };
        }
        expect(new MinVO().toSkeleton()).toMatchObject({ title: '' });
    });

    it('TC-V-001 확장: static fields 미선언 → own property 얕은 복사 반환', () => {
        const vo = new EmptyVO();
        vo.customProp = 'test';
        expect(new EmptyVO().toSkeleton()).toEqual({});
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-V-003 ~ TC-V-004  checkSchema()
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainVO — checkSchema()', () => {
    it('TC-V-003: 응답 데이터에 VO 키 누락 → valid:false, missingKeys 포함', () => {
        const result = new UserVO().checkSchema({ userId: 'u1', name: 'Davi', age: 30 });
        // address 누락
        expect(result.valid).toBe(false);
        expect(result.missingKeys).toContain('address');
    });

    it('TC-V-004: 응답에 VO에 없는 키 존재 → valid:true, extraKeys 포함', () => {
        const data = { userId: 'u1', name: 'Davi', age: 30, address: {}, extra: 'unknown' };
        const result = new UserVO().checkSchema(data);
        expect(result.valid).toBe(true);
        expect(result.extraKeys).toContain('extra');
    });

    it('완전 일치 → valid:true, 두 배열 모두 빈 배열', () => {
        const data = { userId: 'u1', name: 'Davi', age: 30, address: {} };
        const result = new UserVO().checkSchema(data);
        expect(result.valid).toBe(true);
        expect(result.missingKeys).toHaveLength(0);
        expect(result.extraKeys).toHaveLength(0);
    });

    it('static fields 미선언 → 항상 valid:true 반환', () => {
        const result = new EmptyVO().checkSchema({ anything: 1 });
        expect(result.valid).toBe(true);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// getValidators / getTransformers / getBaseURL
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainVO — getValidators()', () => {
    it('validate 함수 있는 필드만 맵에 포함', () => {
        const validators = new UserVO().getValidators();
        expect(validators).toHaveProperty('name');
        expect(validators).toHaveProperty('age');
        expect(validators).not.toHaveProperty('userId'); // validate 없음
        expect(validators).not.toHaveProperty('address');
    });

    it('static fields 미선언 → 빈 객체 반환', () => {
        expect(new EmptyVO().getValidators()).toEqual({});
    });
});

describe('DomainVO — getTransformers()', () => {
    it('transform 함수 있는 필드만 맵에 포함', () => {
        const transformers = new UserVO().getTransformers();
        expect(transformers).toHaveProperty('age'); // transform: Number
        expect(transformers).not.toHaveProperty('name');
    });
});

describe('DomainVO — getBaseURL()', () => {
    it('static baseURL 선언 → 해당 값 반환', () => {
        expect(new UserVO().getBaseURL()).toBe('localhost:8080/api/users');
    });

    it('static baseURL 미선언 → null 반환', () => {
        expect(new EmptyVO().getBaseURL()).toBeNull();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// DomainVO.toSkeleton() — safeClone 교체 검증
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainVO.toSkeleton() — safeClone deep copy', () => {

    it('SC-V-001: Date 기본값이 Date 인스턴스로 복사된다', () => {
        class EventVO extends DomainVO {
            static fields = {
                title:     { default: '' },
                startDate: { default: new Date('2026-01-01') },
            };
        }
        const skeleton = new EventVO().toSkeleton();
        expect(skeleton.startDate).toBeInstanceOf(Date);
        expect(skeleton.startDate.getFullYear()).toBe(2026);
    });

    it('SC-V-002: 객체 기본값이 인스턴스 간 독립적인 참조를 갖는다', () => {
        class AddressVO extends DomainVO {
            static fields = {
                address: { default: { city: 'Seoul', zip: '04524' } },
            };
        }
        const s1 = new AddressVO().toSkeleton();
        const s2 = new AddressVO().toSkeleton();

        s1.address.city = 'Busan';
        expect(s2.address.city).toBe('Seoul');  // 오염 없음
        expect(s1.address).not.toBe(s2.address);  // 다른 참조
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// DomainVO.checkSchema() — 로그 레벨 분류 검증
// ══════════════════════════════════════════════════════════════════════════════

describe('DomainVO.checkSchema() — 로그 레벨 분류', () => {

    it('SC-V-003: extraKeys 감지 시 프로덕션 환경에서 console.warn이 발화하지 않는다', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const data = { userId: 'u1', name: 'Davi', age: 30, address: {}, extra: 'unknown' };
        new UserVO().checkSchema(data);

        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
    });

    it('SC-V-004: missingKeys 감지 시 프로덕션 환경에서도 console.error가 발화한다', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // address 누락
        new UserVO().checkSchema({ userId: 'u1', name: 'Davi', age: 30 });

        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
        process.env.NODE_ENV = originalEnv;
    });

    it('SC-V-005: configure({ silent: true }) 후 missing/extra 모두 콘솔 출력 억제된다', () => {
        DomainState.configure({ silent: true });

        const warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // missing + extra 동시 유발
        new UserVO().checkSchema({ userId: 'u1', extra: 'x' });

        expect(warnSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
        errorSpy.mockRestore();

        // silent 해제 — 다른 테스트에 영향 없도록
        DomainState.configure({ silent: false });
    });
});