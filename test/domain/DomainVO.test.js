import { describe, it, expect } from 'vitest';
import { DomainVO } from '../../src/domain/DomainVO.js';

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
