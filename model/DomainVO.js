/**
 * @fileoverview DomainVO — 신규 INSERT 도메인 구조 선언 베이스 클래스
 *
 * DomainState.fromVO()의 인자로 사용하며,
 * static fields를 통해 기본값 골격, 필드 검증, 타입 변환을 선언한다.
 *
 * @example
 * class UserVO extends DomainVO {
 *   // static baseURL: DomainVO 레벨에서 엔드포인트를 고정할 때 사용 (선택)
 *   static baseURL = 'localhost:8080/api/users';
 *
 *   static fields = {
 *     name:  { default: '',  validate: v => v.length > 0 },
 *     age:   { default: 0,   validate: v => v >= 0,  transform: Number },
 *     address: {
 *       default: { city: '', zip: '' }
 *     }
 *   };
 * }
 *
 * const user = DomainState.fromVO(new UserVO(), api, { debug: true });
 *
 * @module model/DomainVO
 */

import { ERR } from '../src/constants/error.messages.js';


export class DomainVO {

    /**
     * 서브클래스에서 선언한 static fields 또는 인스턴스 own property를 기반으로
     * 기본값 골격 객체를 생성한다.
     *
     * default 값이 객체/배열인 경우 JSON deep copy로 참조 공유를 방지한다.
     *
     * @returns {object}
     */
    toSkeleton() {
        const schema = this.constructor.fields;

        if (!schema) {
            // static fields 미선언 → 인스턴스 own property를 그대로 사용
            return { ...this };
        }

        return Object.fromEntries(
            Object.entries(schema).map(([key, def]) => {
                const val = def.default ?? '';
                return [
                    key,
                    (val !== null && typeof val === 'object')
                        ? JSON.parse(JSON.stringify(val))
                        : val,
                ];
            })
        );
    }

    /**
     * static fields에서 validate 함수를 추출한다.
     * DomainState의 _validators 필드에 주입된다.
     *
     * @returns {Record<string, (value: *) => boolean>}
     */
    getValidators() {
        const schema = this.constructor.fields;
        if (!schema) return {};
        return Object.fromEntries(
            Object.entries(schema)
                .filter(([, def]) => typeof def.validate === 'function')
                .map(([key, def]) => [key, def.validate])
        );
    }

    /**
     * static fields에서 transform 함수를 추출한다.
     * toPayload() 직렬화 전 커스텀 타입 변환에 사용된다.
     *
     * @returns {Record<string, (value: *) => *>}
     */
    getTransformers() {
        const schema = this.constructor.fields;
        if (!schema) return {};
        return Object.fromEntries(
            Object.entries(schema)
                .filter(([, def]) => typeof def.transform === 'function')
                .map(([key, def]) => [key, def.transform])
        );
    }

    /**
     * 서브클래스에 선언된 static baseURL을 반환한다.
     * 미선언이면 null을 반환한다.
     *
     * DomainState.fromVO()에서 options.urlConfig가 없을 때 폴백으로 사용한다.
     *
     * @returns {string | null}
     */
    getBaseURL() {
        return this.constructor.baseURL ?? null;
    }

    /**
     * 응답 데이터가 VO 스키마와 일치하는지 검증한다.
     * 불일치 시 ERR 메시지를 콘솔에 출력하고 세부 결과를 반환한다.
     *
     * @param {object} data - REST API 응답 데이터
     * @returns {{ valid: boolean, missingKeys: string[], extraKeys: string[] }}
     */
    checkSchema(data) {
        const schema = this.constructor.fields;
        if (!schema) return { valid: true, missingKeys: [], extraKeys: [] };

        const schemaKeys = Object.keys(schema);
        const dataKeys   = Object.keys(data);

        const missingKeys = schemaKeys.filter(k => !dataKeys.includes(k));
        const extraKeys   = dataKeys.filter(k => !schemaKeys.includes(k));

        missingKeys.forEach(k => console.error(ERR.VO_SCHEMA_MISSING_KEY(k)));
        extraKeys.forEach(k   => console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k)));

        return {
            valid: missingKeys.length === 0,
            missingKeys,
            extraKeys,
        };
    }
}
