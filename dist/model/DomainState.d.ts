/**
 * `DomainState` 생성자에 전달하는 옵션 객체.
 *
 * @typedef {object} DomainStateOptions
 * @property {import('../src/handler/api-handler.js').ApiHandler|null}  [handler]      - `ApiHandler` 인스턴스. `save()` / `remove()` 호출에 필수.
 * @property {NormalizedUrlConfig|null} [urlConfig] - 정규화된 URL 설정. 미입력 시 `handler.getUrlConfig()` 폴백.
 * @property {boolean}      [isNew=false]  - `true`이면 `save()` 시 POST, `false`이면 PATCH/PUT.
 * @property {boolean}      [debug=false]  - `true`이면 `log()` / `openDebugger()` 활성화 및 디버그 채널 연결.
 * @property {string}       [label]        - 디버그 팝업에 표시될 식별 레이블. 미입력 시 `ds_{timestamp}` 자동 생성.
 * @property {ValidatorMap} [validators]   - 필드별 유효성 검사 함수 맵. `DomainVO.getValidators()` 결과.
 * @property {TransformerMap} [transformers] - 필드별 타입 변환 함수 맵. `DomainVO.getTransformers()` 결과.
 */
/**
 * `fromJSON()` 팩토리의 `options` 파라미터.
 *
 * @typedef {object} FromJsonOptions
 * @property {NormalizedUrlConfig|null} [urlConfig=null] - URL 설정 오버라이드.
 * @property {boolean}                  [debug=false]    - 디버그 모드 활성화.
 * @property {string|null}              [label=null]     - 디버그 팝업 표시 이름. 미입력 시 `json_{timestamp}`.
 * @property {DomainVO|null}            [vo=null]        - DomainVO 인스턴스. 스키마 검증 + validators/transformers 주입.
 */
/**
 * `fromVO()` 팩토리의 `options` 파라미터.
 *
 * @typedef {object} FromVoOptions
 * @property {NormalizedUrlConfig|null} [urlConfig=null] - URL 설정 오버라이드. 미입력 시 `vo.getBaseURL()` 폴백.
 * @property {boolean}                  [debug=false]    - 디버그 모드 활성화.
 * @property {string|null}              [label=null]     - 디버그 팝업 표시 이름. 미입력 시 `vo.constructor.name`.
 */
/**
 * `DomainState.all()` 의 `options` 파라미터.
 *
 * @typedef {object} PipelineOptions
 * @property {boolean} [strict=false] - `true`이면 첫 실패에서 즉시 reject. `false`이면 `_errors`에 기록 후 계속.
 */
/**
 * 정규화된 URL 설정 객체. `normalizeUrlConfig()`의 반환값.
 *
 * @typedef {object} NormalizedUrlConfig
 * @property {string} protocol - 확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`)
 * @property {string} host     - 프로토콜을 제외한 호스트 (예: `'api.example.com'`)
 * @property {string} basePath - 공통 경로 접두사 (예: `'/app/api'`)
 */
/**
 * 필드별 유효성 검사 함수 맵.
 * `DomainVO.getValidators()`가 반환하는 형태와 동일하다.
 *
 * @typedef {Record<string, (value: *) => boolean>} ValidatorMap
 */
/**
 * 필드별 타입 변환 함수 맵.
 * `DomainVO.getTransformers()`가 반환하는 형태와 동일하다.
 *
 * @typedef {Record<string, (value: *) => *>} TransformerMap
 */
/**
 * `DomainState.all()`에 전달하는 리소스 맵.
 * 키는 리소스 식별자, 값은 `api.get()` 등이 반환하는 `Promise<DomainState>`.
 *
 * @typedef {Record<string, Promise<DomainState>>} ResourceMap
 */
/**
 * `DomainPipeline.run()`이 반환하는 결과 객체.
 *
 * @typedef {Record<string, DomainState> & { _errors?: Array<{ key: string, error: * }> }} PipelineResult
 */
/**
 * 플러그인 객체가 반드시 구현해야 하는 계약 인터페이스.
 * `DomainState.use(plugin)` 호출 시 `install` 함수의 존재 여부를 검사한다.
 *
 * @typedef {object} DsmPlugin
 * @property {(DomainStateClass: typeof DomainState) => void} install
 *   `DomainState` 클래스를 인자로 받아 `prototype` 또는 정적 멤버를 확장하는 함수.
 */
/**
 * `createProxy()`가 반환하는 도개교 세트.
 * 외부에서는 `proxy`만 접근하고, 나머지는 `DomainState` 내부에서만 사용한다.
 *
 * @typedef {import('../src/core/api-proxy.js').ProxyWrapper} ProxyWrapper
 */
export class DomainState {
    /**
     * 등록된 플러그인 집합. 중복 등록 방지용.
     * Private class field로 외부 변조를 차단한다.
     *
     * @type {Set<DsmPlugin>}
     */
    static "__#private@#installedPlugins": Set<DsmPlugin>;
    /**
     * 플러그인을 `DomainState`에 등록한다.
     *
     * `plugin.install(DomainState)`를 호출하여 `prototype` 또는 정적 멤버를 확장한다.
     * 동일한 플러그인 객체(참조 기준)를 여러 번 `use()`해도 `install()`은 1회만 실행된다.
     * `use()` 자체가 `DomainState` 클래스를 반환하므로 체이닝이 가능하다.
     *
     * @param {DsmPlugin} plugin - `{ install(DomainState): void }` 계약을 가진 플러그인 객체
     * @returns {typeof DomainState} 체이닝용 `DomainState` 클래스 반환
     * @throws {TypeError} `plugin.install`이 함수가 아닐 때
     *
     * @example
     * DomainState.use(DomainRenderer).use(FormBinder);
     *
     * @example <caption>커스텀 플러그인</caption>
     * const CsvPlugin = {
     *     install(DomainStateClass) {
     *         DomainStateClass.prototype.toCSV = function () {
     *             return Object.values(this._getTarget()).join(',');
     *         };
     *     }
     * };
     * DomainState.use(CsvPlugin);
     */
    static use(plugin: DsmPlugin): typeof DomainState;
    /**
     * `DomainPipeline` 클래스 생성자.
     * 진입점(`rest-domain-state-manager.js`)에서 주입된다.
     *
     * `DomainState`와 `DomainPipeline`의 상호 참조를 피하기 위해
     * 직접 import 대신 생성자 주입(Constructor Injection) 패턴을 사용한다.
     *
     * @type {typeof import('./DomainPipeline.js').DomainPipeline | null}
     */
    static PipelineConstructor: typeof import("./DomainPipeline.js").DomainPipeline | null;
    /**
     * 여러 `DomainState`를 병렬로 fetch하고, 후처리 핸들러를 순서대로 체이닝하는
     * `DomainPipeline` 인스턴스를 반환한다.
     *
     * 내부적으로 `DomainState.PipelineConstructor`를 통해 `DomainPipeline`을 생성한다.
     * `rest-domain-state-manager.js` 진입점을 통해 `PipelineConstructor`가 주입되지 않으면
     * 즉시 `Error`를 throw한다.
     *
     * @param {ResourceMap}    resourceMap - 키: 리소스 식별자, 값: `Promise<DomainState>`
     * @param {PipelineOptions} [options]  - 파이프라인 실행 옵션
     * @returns {import('./DomainPipeline.js').DomainPipeline} 체이닝 가능한 파이프라인 인스턴스
     * @throws {Error} `PipelineConstructor`가 주입되지 않은 경우
     *
     * @example
     * const result = await DomainState.all({
     *     roles: api.get('/api/roles'),
     *     user:  api.get('/api/users/1'),
     * }, { strict: false })
     * .after('roles', async roles => { roles.renderTo('#roleDiv', { type: 'select', ... }); })
     * .after('user',  async user  => { user.bindForm('#userForm'); })
     * .run();
     *
     * if (result._errors?.length) console.warn(result._errors);
     */
    static all(resourceMap: ResourceMap, options?: PipelineOptions): import("./DomainPipeline.js").DomainPipeline;
    /**
     * REST API GET 응답 JSON 문자열로부터 `DomainState`를 생성한다. (`isNew: false`)
     *
     * 주로 `ApiHandler.get()` 내부에서 호출된다.
     * 직접 호출 시 이미 가진 JSON 문자열을 `DomainState`로 변환할 때 사용한다.
     *
     * ## 처리 흐름
     * 1. `toDomain(jsonText, onMutate)`로 JSON 파싱 및 Proxy 생성.
     * 2. `DomainState` 인스턴스 생성 (`isNew: false`).
     * 3. `options.vo`가 주어진 경우: 스키마 검증 후 `validators` / `transformers` 주입.
     *
     * ## `onMutate` 콜백 클로저 패턴
     * `state` 변수를 `null`로 먼저 선언한 뒤 `createProxy`의 `onMutate`에서 참조한다.
     * 이렇게 하면 `DomainState` 생성 전에 Proxy가 먼저 만들어지는 순서 문제를
     * 클로저를 통해 자연스럽게 해소할 수 있다.
     *
     * @param {string}          jsonText          - `response.text()`로 읽은 JSON 문자열
     * @param {import('../src/handler/api-handler.js').ApiHandler}          handler           - `ApiHandler` 인스턴스
     * @param {FromJsonOptions} [options]          - 추가 옵션
     * @returns {DomainState} `isNew: false`인 새 `DomainState` 인스턴스
     * @throws {SyntaxError} `jsonText`가 유효하지 않은 JSON일 때
     *
     * @example <caption>기본 사용 (ApiHandler.get() 내부에서 자동 호출)</caption>
     * const user = await api.get('/api/users/1');
     * user.data.name = 'Davi'; // → changeLog에 replace 기록
     * await user.save('/api/users/1'); // → PATCH 전송
     *
     * @example <caption>DomainVO 스키마 검증과 함께 사용</caption>
     * const user = DomainState.fromJSON(jsonText, api, { vo: new UserVO(), debug: true });
     *
     * @example <caption>GET 응답을 폼에 자동 채우기 (FormBinder 플러그인 필요)</caption>
     * const user = DomainState.fromJSON(jsonText, api);
     * user.bindForm('userForm'); // FormBinder.bindForm() 호출
     */
    static fromJSON(jsonText: string, handler: import("../src/handler/api-handler.js").ApiHandler, { urlConfig, debug, label, vo, }?: FromJsonOptions): DomainState;
    /**
     * `DomainVO` 인스턴스로부터 기본값 골격 `DomainState`를 생성한다. (`isNew: true`)
     *
     * `DomainVO.toSkeleton()`으로 기본값 객체를 생성하고 Proxy로 감싼다.
     * `validators` / `transformers`가 자동으로 주입되며, `save()` 시 POST를 전송한다.
     *
     * ## `urlConfig` 결정 순서
     * 1. `options.urlConfig` 명시 → 그대로 사용
     * 2. `options.urlConfig` 없음 + `vo.getBaseURL()` 있음 → `normalizeUrlConfig({ baseURL })` 적용
     * 3. 둘 다 없음 → `null` (save() 시 `handler.getUrlConfig()` 폴백)
     *
     * @param {DomainVO}      vo        - 기본값 / 검증 / 변환 규칙을 선언한 `DomainVO` 인스턴스
     * @param {import('../src/handler/api-handler.js').ApiHandler}        handler   - `ApiHandler` 인스턴스
     * @param {FromVoOptions} [options] - 추가 옵션
     * @returns {DomainState} `isNew: true`인 새 `DomainState` 인스턴스
     * @throws {TypeError} `vo`가 `DomainVO` 인스턴스가 아닐 때
     *
     * @example <caption>기본 사용</caption>
     * class UserVO extends DomainVO {
     *     static baseURL = 'localhost:8080/api/users';
     *     static fields  = {
     *         userId: { default: '' },
     *         name:   { default: '', validate: v => v.trim().length > 0 },
     *     };
     * }
     * const newUser = DomainState.fromVO(new UserVO(), api, { debug: true });
     * newUser.data.userId = 'user_' + Date.now();
     * newUser.data.name   = 'Davi';
     * await newUser.save(); // → POST to static baseURL
     *
     * @example <caption>urlConfig 명시 오버라이드</caption>
     * const newUser = DomainState.fromVO(new UserVO(), api, {
     *     urlConfig: { host: 'staging.server.com', basePath: '/api' },
     * });
     */
    static fromVO(vo: DomainVO, handler: import("../src/handler/api-handler.js").ApiHandler, { urlConfig, debug, label, }?: FromVoOptions): DomainState;
    /**
     * `DomainState` 인스턴스를 생성한다.
     *
     * **직접 호출 금지.** `fromJSON()` / `fromVO()` 팩토리 메서드를 사용한다.
     * `FormBinder` 플러그인 설치 후 `fromForm()`도 사용 가능하다.
     *
     * 생성 직후 `debug: true`이면 디버그 채널로 초기 상태를 broadcast한다.
     *
     * @param {ProxyWrapper}       proxyWrapper - `createProxy()`의 반환값 (도개교 세트)
     * @param {DomainStateOptions} [options]    - 메타데이터 및 설정 옵션
     */
    constructor(proxyWrapper: ProxyWrapper, options?: DomainStateOptions);
    /** @type {object} — 변경 추적 Proxy 객체 */
    _proxy: object;
    /** @type {() => import('../src/core/api-proxy.js').ChangeLogEntry[]} */
    _getChangeLog: () => import("../src/core/api-proxy.js").ChangeLogEntry[];
    /** @type {() => object} */
    _getTarget: () => object;
    /** @type {() => void} */
    _clearChangeLog: () => void;
    /** @type {() => Set<string>} */
    _getDirtyFields: () => Set<string>;
    /** @type {() => void} */
    _clearDirtyFields: () => void;
    /** @type {import('../src/handler/api-handler.js').ApiHandler|null} */
    _handler: import("../src/handler/api-handler.js").ApiHandler | null;
    /** @type {NormalizedUrlConfig|null} */
    _urlConfig: NormalizedUrlConfig | null;
    /** @type {boolean} — true이면 save() 시 POST로 분기 */
    _isNew: boolean;
    /** @type {boolean} — true이면 log() / openDebugger() 활성화 */
    _debug: boolean;
    /** @type {string} — 디버그 팝업 식별 레이블 */
    _label: string;
    /** @type {ValidatorMap} */
    _validators: ValidatorMap;
    /** @type {TransformerMap} */
    _transformers: TransformerMap;
    /** @type {Array<*>} — 인스턴스 수준 에러 목록 */
    _errors: Array<any>;
    /**
     * 변경 추적이 활성화된 Proxy 객체.
     *
     * 외부 개발자가 도메인 데이터에 접근하고 수정하는 **유일한 공개 진입점**이다.
     * 이 Proxy를 통한 모든 필드 읽기/쓰기/삭제는 `changeLog`에 자동으로 기록된다.
     *
     * @type {object}
     * @readonly
     *
     * @example
     * const user = await api.get('/api/users/1');
     * console.log(user.data.name);        // 읽기
     * user.data.name = 'Davi';            // 쓰기 → changeLog: [{ op: 'replace', path: '/name', ... }]
     * user.data.address.city = 'Seoul';   // 중첩 쓰기 → path: '/address/city'
     * delete user.data.phone;             // 삭제 → op: 'remove'
     */
    readonly get data(): object;
    /**
         * 도메인 상태를 서버(DB)와 동기화한다.
         *
         * ## HTTP 메서드 분기 전략 (Dirty Checking 기반)
         *
         * ```
         * isNew === true
         *     → POST  (toPayload — 전체 객체 직렬화)
         *
         * isNew === false
         *     dirtyRatio = dirtyFields.size / Object.keys(target).length
         *
         *     dirtyFields.size === 0            → PUT   (변경 없는 의도적 재저장)
         *     dirtyRatio >= DIRTY_THRESHOLD     → PUT   (변경 비율 70% 이상 — 전체 교체가 효율적)
         *     dirtyRatio <  DIRTY_THRESHOLD     → PATCH (변경 부분만 RFC 6902 Patch 배열로 전송)
         * ```
         *
         * ## 기존 분기(changeLog.length 기반)와의 차이
         * 이전 구현은 `changeLog.length === 0`이면 PUT을 선택했다.
         * 이는 "이력 없음 = 전체 교체"라는 잘못된 의미론적 매핑이었다.
         * 새 구현은 "변경된 필드의 비율"이라는 데이터 의미론에 기반한다.
         *
         * ## 동기화 성공 후 처리
         * - PUT / PATCH 성공 → `clearChangeLog()` + `clearDirtyFields()` 동시 초기화
         * - POST 성공        → `isNew = false` 전환 후 동일하게 초기화
         * - `debug: true`    → `_broadcast()` 호출
         *
         * ## `requestPath` 결정 순서
         * 1. `requestPath` 인자 명시 → 그대로 사용
         * 2. 없음 → `this._urlConfig` 또는 `handler.getUrlConfig()` 사용
         * 3. 둘 다 없음 → `buildURL` 내부에서 `Error` throw
         *
         * @param {string} [requestPath] - 엔드포인트 경로 (예: `'/api/users/1'`). `urlConfig`와 조합된다.
         * @returns {Promise<void>}
         * @throws {Error} `handler`가 주입되지 않은 경우 (`_assertHandler`)
         * @throws {Error} URL을 확정할 수 없는 경우 (`buildURL`)
         * @throws {{ status: number, statusText: string, body: string }} HTTP 에러 (서버가 `4xx` / `5xx` 반환 시)
         *
         * @example <caption>경로 명시</caption>
         * await user.save('/api/users/user_001');
         *
         * @example <caption>urlConfig 사용 (DomainVO.baseURL 자동 폴백)</caption>
         * const newUser = DomainState.fromVO(new UserVO(), api);
         * await newUser.save(); // → POST to UserVO.baseURL
         *
         * @example <caption>에러 처리</caption>
         * try {
         *     await user.save('/api/users/1');
         * } catch (err) {
         *     if (err.status === 409) console.error('충돌 발생:', err.body);
         * }
         */
    save(requestPath?: string): Promise<void>;
    /**
     * 해당 리소스를 서버에서 삭제한다. (HTTP DELETE)
     *
     * 응답 본문은 사용하지 않는다. 성공/실패는 `response.ok`로만 판단한다.
     *
     * @param {string} [requestPath] - 엔드포인트 경로. 미입력 시 `urlConfig` 사용.
     * @returns {Promise<void>}
     * @throws {Error} `handler`가 주입되지 않은 경우
     * @throws {{ status: number, statusText: string, body: string }} HTTP 에러
     *
     * @example
     * await user.remove('/api/users/user_001');
     */
    remove(requestPath?: string): Promise<void>;
    /**
     * 현재 `changeLog`를 콘솔 테이블로 출력한다.
     *
     * `debug: false`이면 아무 동작도 하지 않는다.
     * 변경 이력이 없으면 `'(변경 이력 없음)'`을 출력한다.
     *
     * @returns {void}
     *
     * @example
     * const user = await api.get('/api/users/1', { debug: true });
     * user.data.name = 'Davi';
     * user.log(); // 콘솔 테이블에 changeLog 출력
     */
    log(): void;
    /**
     * 디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.
     *
     * `debug: false`이면 아무 동작도 하지 않는다.
     * 브라우저 팝업 차단이 활성화된 경우 콘솔 경고를 출력한다.
     *
     * @returns {void}
     *
     * @example
     * const user = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'UserVO' });
     * user.openDebugger();
     */
    openDebugger(): void;
    /**
     * `handler`가 주입되어 있는지 검사하고, 없으면 `Error`를 throw한다.
     *
     * @param {string} method - 호출한 메서드명 (에러 메시지 생성용)
     * @returns {import('../src/handler/api-handler.js').ApiHandler} - 안전한 핸들러 반환!
     */
    _assertHandler(method: string): import("../src/handler/api-handler.js").ApiHandler;
    /**
     * `_urlConfig`와 `requestPath`를 조합하여 최종 요청 URL을 생성한다.
     *
     * ## URL 결정 우선순위
     * 1. `this._urlConfig` 사용
     * 2. `this._urlConfig`가 없으면 `handler.getUrlConfig()` 폴백
     * 3. 둘 다 없으면 빈 객체 `{}` → `buildURL` 내부에서 `Error` throw
     *
     * @param {string|undefined} requestPath - `save()` / `remove()`에서 전달된 경로
     * @returns {string} 최종 완성된 요청 URL
     * @throws {Error} URL을 확정할 수 없는 경우 (`buildURL` 내부에서 throw)
     */
    _resolveURL(requestPath: string | undefined): string;
    /**
     * 현재 `DomainState`의 스냅샷을 디버그 `BroadcastChannel`에 전파한다.
     *
     * 디버그 팝업이 열려있는 모든 탭이 이 메시지를 수신하여
     * `data` / `changeLog` / `isNew` / `errors`를 실시간으로 갱신한다.
     *
     * `debug: false`이면 호출해도 `broadcastUpdate`가 채널을 초기화하지 않으므로
     * 실질적으로 아무 동작도 하지 않는다.
     *
     * @returns {void}
     */
    _broadcast(): void;
}
/**
 * `DomainState` 생성자에 전달하는 옵션 객체.
 */
export type DomainStateOptions = {
    /**
     * - `ApiHandler` 인스턴스. `save()` / `remove()` 호출에 필수.
     */
    handler?: import("../src/handler/api-handler.js").ApiHandler | null | undefined;
    /**
     * - 정규화된 URL 설정. 미입력 시 `handler.getUrlConfig()` 폴백.
     */
    urlConfig?: NormalizedUrlConfig | null | undefined;
    /**
     * - `true`이면 `save()` 시 POST, `false`이면 PATCH/PUT.
     */
    isNew?: boolean | undefined;
    /**
     * - `true`이면 `log()` / `openDebugger()` 활성화 및 디버그 채널 연결.
     */
    debug?: boolean | undefined;
    /**
     * - 디버그 팝업에 표시될 식별 레이블. 미입력 시 `ds_{timestamp}` 자동 생성.
     */
    label?: string | undefined;
    /**
     * - 필드별 유효성 검사 함수 맵. `DomainVO.getValidators()` 결과.
     */
    validators?: ValidatorMap | undefined;
    /**
     * - 필드별 타입 변환 함수 맵. `DomainVO.getTransformers()` 결과.
     */
    transformers?: TransformerMap | undefined;
};
/**
 * `fromJSON()` 팩토리의 `options` 파라미터.
 */
export type FromJsonOptions = {
    /**
     * - URL 설정 오버라이드.
     */
    urlConfig?: NormalizedUrlConfig | null | undefined;
    /**
     * - 디버그 모드 활성화.
     */
    debug?: boolean | undefined;
    /**
     * - 디버그 팝업 표시 이름. 미입력 시 `json_{timestamp}`.
     */
    label?: string | null | undefined;
    /**
     * - DomainVO 인스턴스. 스키마 검증 + validators/transformers 주입.
     */
    vo?: DomainVO | null | undefined;
};
/**
 * `fromVO()` 팩토리의 `options` 파라미터.
 */
export type FromVoOptions = {
    /**
     * - URL 설정 오버라이드. 미입력 시 `vo.getBaseURL()` 폴백.
     */
    urlConfig?: NormalizedUrlConfig | null | undefined;
    /**
     * - 디버그 모드 활성화.
     */
    debug?: boolean | undefined;
    /**
     * - 디버그 팝업 표시 이름. 미입력 시 `vo.constructor.name`.
     */
    label?: string | null | undefined;
};
/**
 * `DomainState.all()` 의 `options` 파라미터.
 */
export type PipelineOptions = {
    /**
     * - `true`이면 첫 실패에서 즉시 reject. `false`이면 `_errors`에 기록 후 계속.
     */
    strict?: boolean | undefined;
};
/**
 * 정규화된 URL 설정 객체. `normalizeUrlConfig()`의 반환값.
 */
export type NormalizedUrlConfig = {
    /**
     * - 확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`)
     */
    protocol: string;
    /**
     * - 프로토콜을 제외한 호스트 (예: `'api.example.com'`)
     */
    host: string;
    /**
     * - 공통 경로 접두사 (예: `'/app/api'`)
     */
    basePath: string;
};
/**
 * 필드별 유효성 검사 함수 맵.
 * `DomainVO.getValidators()`가 반환하는 형태와 동일하다.
 */
export type ValidatorMap = Record<string, (value: any) => boolean>;
/**
 * 필드별 타입 변환 함수 맵.
 * `DomainVO.getTransformers()`가 반환하는 형태와 동일하다.
 */
export type TransformerMap = Record<string, (value: any) => any>;
/**
 * `DomainState.all()`에 전달하는 리소스 맵.
 * 키는 리소스 식별자, 값은 `api.get()` 등이 반환하는 `Promise<DomainState>`.
 */
export type ResourceMap = Record<string, Promise<DomainState>>;
/**
 * `DomainPipeline.run()`이 반환하는 결과 객체.
 */
export type PipelineResult = Record<string, DomainState> & {
    _errors?: Array<{
        key: string;
        error: any;
    }>;
};
/**
 * 플러그인 객체가 반드시 구현해야 하는 계약 인터페이스.
 * `DomainState.use(plugin)` 호출 시 `install` 함수의 존재 여부를 검사한다.
 */
export type DsmPlugin = {
    /**
     *   `DomainState` 클래스를 인자로 받아 `prototype` 또는 정적 멤버를 확장하는 함수.
     */
    install: (DomainStateClass: typeof DomainState) => void;
};
/**
 * `createProxy()`가 반환하는 도개교 세트.
 * 외부에서는 `proxy`만 접근하고, 나머지는 `DomainState` 내부에서만 사용한다.
 */
export type ProxyWrapper = import("../src/core/api-proxy.js").ProxyWrapper;
import { DomainVO } from './DomainVO.js';
