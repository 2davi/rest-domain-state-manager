/**
 * `DomainVO`의 `static fields`에 선언하는 단일 필드 스키마 객체.
 *
 * @typedef {object} FieldSchema
 *
 * @property {*}                    [default='']
 *   필드의 기본값. `toSkeleton()`이 초기 객체를 생성할 때 사용한다.
 *   `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy하여
 *   인스턴스 간 참조 공유를 방지한다.
 *
 * @property {(value: *) => boolean} [validate]
 *   필드 유효성 검사 함수. 반환값이 `false`이면 유효하지 않은 값으로 간주한다.
 *   `DomainState._validators`에 주입되어 `save()` 직전에 실행될 예정이다.
 *   예: `v => v.trim().length > 0`, `v => v >= 0`
 *
 * @property {(value: *) => *}       [transform]
 *   타입 변환 함수. `toPayload()` 직렬화 전에 실행되어 값을 변환한다.
 *   `DomainState._transformers`에 주입된다.
 *   예: `Number` (문자열 입력을 숫자로 변환), `v => v.trim()` (공백 제거)
 */
/**
 * `DomainVO` 서브클래스의 `static fields` 선언 형태.
 * 키는 필드명, 값은 `FieldSchema` 객체다.
 *
 * @typedef {Record<string, FieldSchema>} FieldsSchema
 */
/**
 * `checkSchema()`의 반환값.
 *
 * @typedef {object} SchemaCheckResult
 * @property {boolean}  valid       - `missingKeys`가 없으면 `true` (extraKeys는 valid에 영향 없음)
 * @property {string[]} missingKeys - VO에 선언됐지만 응답 데이터에 없는 키 목록
 * @property {string[]} extraKeys   - 응답 데이터에 있지만 VO에 선언되지 않은 키 목록
 */
/**
 * `getValidators()`의 반환값.
 * 키는 필드명, 값은 `(value) => boolean` 검증 함수다.
 *
 * @typedef {Record<string, (value: *) => boolean>} ValidatorMap
 */
/**
 * `getTransformers()`의 반환값.
 * 키는 필드명, 값은 `(value) => *` 변환 함수다.
 *
 * @typedef {Record<string, (value: *) => *>} TransformerMap
 */
export class DomainVO {
    /**
     * 서브클래스에서 선언한 `static fields`를 기반으로 기본값 골격 객체를 생성한다.
     *
     * `DomainState.fromVO()` 내부에서 `createProxy()`의 초기 입력 객체로 사용된다.
     *
     * ## 처리 규칙
     * 1. `static fields`가 없으면 인스턴스의 own property를 얕은 복사(`{ ...this }`)로 반환.
     * 2. `static fields`가 있으면 각 필드의 `default` 값으로 객체를 구성한다.
     * 3. `default`가 없으면 `''` (빈 문자열)을 사용한다.
     * 4. `default`가 `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy.
     *    인스턴스마다 독립적인 참조를 갖도록 하여 상태 공유 버그를 방지한다.
     *
     * @returns {object} `static fields`의 `default` 값으로 구성된 초기 객체
     *
     * @example <caption>기본 사용</caption>
     * class UserVO extends DomainVO {
     *     static fields = {
     *         name:    { default: '' },
     *         age:     { default: 0 },
     *         address: { default: { city: '', zip: '' } },
     *     };
     * }
     * new UserVO().toSkeleton();
     * // → { name: '', age: 0, address: { city: '', zip: '' } }
     * // address는 deep copy이므로 인스턴스마다 독립적인 객체
     *
     * @example <caption>static fields 미선언 시</caption>
     * class SimpleVO extends DomainVO {}
     * const vo = new SimpleVO();
     * vo.userId = 'u1';
     * vo.toSkeleton(); // → { userId: 'u1' }  (own property 얕은 복사)
     */
    toSkeleton(): object;
    /**
     * `static fields`에서 `validate` 함수를 추출하여 필드명 → 함수 맵으로 반환한다.
     *
     * `DomainState.fromVO()` 내부에서 호출되어 `DomainState._validators`에 주입된다.
     * `validate` 없는 필드는 포함되지 않는다.
     *
     * @returns {ValidatorMap} `{ 필드명: (value) => boolean }` 맵. `static fields` 미선언 시 빈 객체.
     *
     * @example
     * class ProductVO extends DomainVO {
     *     static fields = {
     *         name:  { default: '', validate: v => v.trim().length > 0 },
     *         price: { default: 0,  validate: v => v >= 0 },
     *         tags:  { default: [] },  // validate 없음 → 맵에 포함되지 않음
     *     };
     * }
     * new ProductVO().getValidators();
     * // → { name: [Function], price: [Function] }
     */
    getValidators(): ValidatorMap;
    /**
     * `static fields`에서 `transform` 함수를 추출하여 필드명 → 함수 맵으로 반환한다.
     *
     * `DomainState.fromVO()` 내부에서 호출되어 `DomainState._transformers`에 주입된다.
     * `toPayload()` 직렬화 직전에 실행되어 각 필드 값을 변환한다.
     * `transform` 없는 필드는 포함되지 않는다.
     *
     * @returns {TransformerMap} `{ 필드명: (value) => * }` 맵. `static fields` 미선언 시 빈 객체.
     *
     * @example
     * class OrderVO extends DomainVO {
     *     static fields = {
     *         quantity: { default: '0', transform: Number },  // 문자열 입력 → 숫자 변환
     *         note:     { default: '' , transform: v => v.trim() }, // 공백 제거
     *         orderId:  { default: '' }, // transform 없음 → 맵에 포함되지 않음
     *     };
     * }
     * new OrderVO().getTransformers();
     * // → { quantity: [Function: Number], note: [Function] }
     */
    getTransformers(): TransformerMap;
    /**
     * 서브클래스에 선언된 `static baseURL`을 반환한다.
     * 미선언이면 `null`을 반환한다.
     *
     * `DomainState.fromVO()`에서 `options.urlConfig`가 없을 때 폴백 URL로 사용된다.
     * `normalizeUrlConfig({ baseURL: vo.getBaseURL() })`로 정규화되어 `DomainState._urlConfig`에 저장된다.
     *
     * @returns {string | null} `static baseURL` 값 또는 `null`
     *
     * @example <caption>baseURL 선언 시</caption>
     * class UserVO extends DomainVO {
     *     static baseURL = 'localhost:8080/api/users';
     * }
     * new UserVO().getBaseURL(); // → 'localhost:8080/api/users'
     *
     * // DomainState.fromVO() 내부에서:
     * // urlConfig 미입력 → normalizeUrlConfig({ baseURL: 'localhost:8080/api/users' })
     * // → { protocol: 'http://', host: 'localhost:8080', basePath: '/api/users' }
     *
     * @example <caption>baseURL 미선언 시</caption>
     * class SimpleVO extends DomainVO {}
     * new SimpleVO().getBaseURL(); // → null
     * // → DomainState.fromVO() 에서 urlConfig는 null → handler.getUrlConfig() 폴백
     */
    getBaseURL(): string | null;
    /**
     * REST API 응답 데이터가 이 VO의 스키마(`static fields`)와 일치하는지 검증한다.
     *
     * `DomainState.fromJSON()` 에 `vo` 옵션을 함께 넘기면 내부적으로 호출된다.
     * 불일치 항목은 콘솔에 경고/에러를 출력하지만 실행을 중단하지는 않는다.
     *
     * ## 검증 결과 해석
     * - `missingKeys.length > 0` → VO에 선언됐지만 응답에 없음 → `valid: false`
     *   (서버 API 응답 구조가 변경됐거나, VO 선언이 잘못된 경우)
     * - `extraKeys.length > 0`   → 응답에 있지만 VO에 없음 → `valid: true` (경고만)
     *   (서버가 추가 필드를 내려주는 경우, 무시해도 무방)
     *
     * ## 콘솔 출력
     * - `missingKeys`: `console.error(ERR.VO_SCHEMA_MISSING_KEY(k))` — 각 키마다 에러
     * - `extraKeys`:   `console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k))`   — 각 키마다 경고
     *
     * @param {object} data - `DomainState._getTarget()`으로 읽은 REST API 응답 데이터 객체
     * @returns {SchemaCheckResult} `{ valid, missingKeys, extraKeys }`
     *
     * @example <caption>fromJSON()과 함께 사용</caption>
     * const user = DomainState.fromJSON(jsonText, api, { vo: new UserVO() });
     * // 스키마 불일치 시 콘솔에 에러/경고 출력, 실행은 계속
     *
     * @example <caption>직접 호출</caption>
     * const result = new UserVO().checkSchema({ userId: 'u1', name: 'Davi', extra: 'unknown' });
     * // result.valid        → true  (missingKeys 없음)
     * // result.missingKeys  → []
     * // result.extraKeys    → ['extra']  → 콘솔 경고
     *
     * @example <caption>static fields 미선언 시</caption>
     * class SimpleVO extends DomainVO {}
     * new SimpleVO().checkSchema({ anything: 1 });
     * // → { valid: true, missingKeys: [], extraKeys: [] }  (검증 스킵)
     */
    checkSchema(data: object): SchemaCheckResult;
}
/**
 * `DomainVO`의 `static fields`에 선언하는 단일 필드 스키마 객체.
 */
export type FieldSchema = {
    /**
     * 필드의 기본값. `toSkeleton()`이 초기 객체를 생성할 때 사용한다.
     * `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy하여
     * 인스턴스 간 참조 공유를 방지한다.
     */
    default?: any;
    /**
     * 필드 유효성 검사 함수. 반환값이 `false`이면 유효하지 않은 값으로 간주한다.
     * `DomainState._validators`에 주입되어 `save()` 직전에 실행될 예정이다.
     * 예: `v => v.trim().length > 0`, `v => v >= 0`
     */
    validate?: ((value: any) => boolean) | undefined;
    /**
     * 타입 변환 함수. `toPayload()` 직렬화 전에 실행되어 값을 변환한다.
     * `DomainState._transformers`에 주입된다.
     * 예: `Number` (문자열 입력을 숫자로 변환), `v => v.trim()` (공백 제거)
     */
    transform?: ((value: any) => any) | undefined;
};
/**
 * `DomainVO` 서브클래스의 `static fields` 선언 형태.
 * 키는 필드명, 값은 `FieldSchema` 객체다.
 */
export type FieldsSchema = Record<string, FieldSchema>;
/**
 * `checkSchema()`의 반환값.
 */
export type SchemaCheckResult = {
    /**
     * - `missingKeys`가 없으면 `true` (extraKeys는 valid에 영향 없음)
     */
    valid: boolean;
    /**
     * - VO에 선언됐지만 응답 데이터에 없는 키 목록
     */
    missingKeys: string[];
    /**
     * - 응답 데이터에 있지만 VO에 선언되지 않은 키 목록
     */
    extraKeys: string[];
};
/**
 * `getValidators()`의 반환값.
 * 키는 필드명, 값은 `(value) => boolean` 검증 함수다.
 */
export type ValidatorMap = Record<string, (value: any) => boolean>;
/**
 * `getTransformers()`의 반환값.
 * 키는 필드명, 값은 `(value) => *` 변환 함수다.
 */
export type TransformerMap = Record<string, (value: any) => any>;
