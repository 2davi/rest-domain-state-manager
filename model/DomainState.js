/**
 * DomainState — REST API 연동 도메인 상태 관리자
 *
 * REST 리소스(또는 Aggregate Root) 단위로 인스턴스 하나를 생성한다.
 * `DomainState` 인스턴스는 **현재 상태(Proxy) + 변경 이력(changeLog) + 동기화 단위**의 세 역할을 동시에 수행한다.
 *
 * ## 생성 경로 (팩토리 메서드)
 *
 * | 팩토리               | 입력            | `isNew` | 주 용도                                        |
 * |---------------------|-----------------|---------|------------------------------------------------|
 * | `fromJSON()`        | JSON 문자열     | `false` | GET 응답 수신 후 변경·저장                      |
 * | `fromVO()`          | `DomainVO` 인스턴스 | `true` | 신규 리소스 생성(POST)                        |
 * | `fromForm()` ¹      | HTML Form 요소  | `true`  | FormBinder 플러그인 설치 후 사용 가능           |
 *
 * ¹ `fromForm()`은 `FormBinder` 플러그인이 `DomainState.use(FormBinder)` 호출 후
 *   `DomainState.fromForm`으로 동적 주입된다.
 *
 * ## 외부 인터페이스
 *
 * | 멤버              | 종류            | 설명                                                  |
 * |------------------|-----------------|-------------------------------------------------------|
 * | `.data`          | getter (Proxy)  | 변경 추적 Proxy 객체. 유일한 외부 데이터 진입점.        |
 * | `.save(path?)`   | async method    | `isNew` + `changeLog` 기반 POST / PATCH / PUT 자동 분기 |
 * | `.remove(path?)` | async method    | DELETE 요청 전송                                      |
 * | `.log()`         | method          | changeLog를 콘솔 테이블로 출력 (`debug: true` 시만)    |
 * | `.openDebugger()`| method          | 디버그 팝업 열기 (`debug: true` 시만)                  |
 *
 * ## 플러그인 시스템
 * `DomainState.use(plugin)` 호출 시 `plugin.install(DomainState)`가 실행되어
 * `prototype` 또는 클래스 레벨에 기능을 동적으로 주입할 수 있다.
 *
 * ## 의존성 주입 (순환 참조 해소)
 * `DomainState`와 `DomainPipeline`의 상호 참조를 막기 위해
 * 진입점(`rest-domain-state-manager.js`)에서
 * `DomainState.PipelineConstructor = DomainPipeline`으로 생성자를 주입한다.
 *
 * @module model/DomainState
 * @see {@link module:model/DomainVO DomainVO}
 * @see {@link module:model/DomainPipeline DomainPipeline}
 * @see {@link module:handler/api-handler ApiHandler}
 */

import { toDomain, toPayload, toPatch }          from '../src/core/api-mapper.js';
import { createProxy }                           from '../src/core/api-proxy.js';
import { normalizeUrlConfig, buildURL }          from '../src/core/url-resolver.js';
import { ERR }                                   from '../src/constants/error.messages.js';
import { broadcastUpdate, openDebugPopup }       from '../src/debug/debug-channel.js';
import { DomainVO }                              from './DomainVO.js';
import { DIRTY_THRESHOLD }                       from '../src/constants/dirty.const.js';


// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

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


// ════════════════════════════════════════════════════════════════════════════════
// DomainState 클래스
// ════════════════════════════════════════════════════════════════════════════════

export class DomainState {

    // ── 플러그인 레지스트리 ────────────────────────────────────────────────────
    /**
     * 등록된 플러그인 집합. 중복 등록 방지용.
     * Private class field로 외부 변조를 차단한다.
     *
     * @type {Set<DsmPlugin>}
     */
    static #installedPlugins = new Set();

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
    static use(plugin) {
        if (typeof plugin?.install !== 'function') {
            throw new TypeError(ERR.PLUGIN_NO_INSTALL);
        }
        if (!DomainState.#installedPlugins.has(plugin)) {
            plugin.install(DomainState);
            DomainState.#installedPlugins.add(plugin);
        }
        return DomainState;
    }

    // ── 의존성 주입 (순환 참조 해소) ──────────────────────────────────────────
    /**
     * `DomainPipeline` 클래스 생성자.
     * 진입점(`rest-domain-state-manager.js`)에서 주입된다.
     *
     * `DomainState`와 `DomainPipeline`의 상호 참조를 피하기 위해
     * 직접 import 대신 생성자 주입(Constructor Injection) 패턴을 사용한다.
     *
     * @type {typeof import('./DomainPipeline.js').DomainPipeline | null}
     */
    static PipelineConstructor = null;

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
    static all(resourceMap, options = {}) {
        if(!DomainState.PipelineConstructor) {
            throw new Error('[DSM] DomainPipeline이 주입되지 않았습니다. rest-domain-state-manager.js 진입점을 사용하세요.');
        }
        return new DomainState.PipelineConstructor(resourceMap, options);
    }


    // ════════════════════════════════════════════════════════════════════════════
    // 생성자 (직접 호출 금지 — 팩토리 메서드 사용)
    // ════════════════════════════════════════════════════════════════════════════

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
    constructor(proxyWrapper, options = {}) {
        // ── 도개교 세트 — 클로저 세계의 출입문 네 개 ─────────────────────────
        /** @type {object} — 변경 추적 Proxy 객체 */
        this._proxy          = proxyWrapper.proxy;
        /** @type {() => import('../src/core/api-proxy.js').ChangeLogEntry[]} */
        this._getChangeLog   = proxyWrapper.getChangeLog;
        /** @type {() => object} */
        this._getTarget      = proxyWrapper.getTarget;
        /** @type {() => void} */
        this._clearChangeLog = proxyWrapper.clearChangeLog;

        // ── Batching Scheduler ────────────────────────────────────────────────
        // 동일한 동기 블록(synchronous block) 안에서 Proxy 변경이 여러 번 발생해도
        // _broadcast() → postMessage()가 단 한 번만 실행되도록 보장하는 플래그.
        //
        // true  : 이번 microtask tick에 이미 flush가 예약됨 → 추가 예약 차단
        // false : 예약 없음 → 다음 onMutate 호출 시 새로 예약
        /** @type {boolean} */
        this._pendingFlush = false;
        // ──────────────────────────────────────────────────────────────────────

        // ── Dirty Tracking 클로저 연결 ────────────────────────────────────────
        /** @type {() => Set<string>} */
        this._getDirtyFields   = proxyWrapper.getDirtyFields;
        /** @type {() => void} */
        this._clearDirtyFields = proxyWrapper.clearDirtyFields;
        // ──────────────────────────────────────────────────────────────────────
        
        // ── 메타데이터 ────────────────────────────────────────────────────────
        /** @type {import('../src/handler/api-handler.js').ApiHandler|null} */
        this._handler      = options.handler      ?? null;
        /** @type {NormalizedUrlConfig|null} */
        this._urlConfig    = options.urlConfig     ?? null;
        /** @type {boolean} — true이면 save() 시 POST로 분기 */
        this._isNew        = options.isNew         ?? false;
        /** @type {boolean} — true이면 log() / openDebugger() 활성화 */
        this._debug        = options.debug         ?? false;
        /** @type {string} — 디버그 팝업 식별 레이블 */
        this._label        = options.label         ?? `ds_${Date.now()}`;
        /** @type {ValidatorMap} */
        this._validators   = options.validators    ?? {};
        /** @type {TransformerMap} */
        this._transformers = options.transformers  ?? {};
        /** @type {Array<*>} — 인스턴스 수준 에러 목록 */
        this._errors       = [];

        // 생성 직후 디버그 채널에 초기 상태를 broadcast한다
        if (this._debug) this._broadcast();
    }


    // ════════════════════════════════════════════════════════════════════════════
    // 팩토리 메서드
    // ════════════════════════════════════════════════════════════════════════════

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
    static fromJSON(jsonText, handler, {
        urlConfig   = null,
        debug       = false,
        label       = null,
        vo          = null,
    } = {}) {
        /** @type {DomainState|null} */
        let state = null;
        const wrapper = toDomain(jsonText, () => {
            // _broadcast() 직접 호출 대신 배칭 스케줄러를 거친다.
            // 동일 동기 블록 내 다중 변경이 단일 postMessage로 병합된다.
            state?._scheduleFlush();
        });

        state   = new DomainState(wrapper, {
            handler,
            urlConfig,
            isNew:  false,
            debug,
            label:  label ?? `json_${Date.now()}`,
        });

        // DomainVO 스키마 검증 및 validators / transformers 주입
        if (vo instanceof DomainVO) {
            const { valid } = vo.checkSchema(wrapper.getTarget());
            if (valid) {
                state._validators   = vo.getValidators();
                state._transformers = vo.getTransformers();
            }
        }

        return state;
    }

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
    static fromVO(vo, handler, {
        urlConfig = null,
        debug     = false,
        label     = null,
    } = {}) {
        if (!(vo instanceof DomainVO)) throw new TypeError(ERR.FROM_VO_TYPE);

        const resolvedUrlConfig = urlConfig
            ?? (vo.getBaseURL() ? normalizeUrlConfig({ baseURL: vo.getBaseURL() ?? undefined, debug }) : null);
        
        /** @type {DomainState|null} */
        let state = null;

        const wrapper = createProxy(vo.toSkeleton(), () => {
            state?._scheduleFlush();
        });

        state = new DomainState(wrapper, {
            handler,
            urlConfig:    resolvedUrlConfig,
            isNew:        true,
            debug,
            label:        label ?? vo.constructor.name,
            validators:   vo.getValidators(),
            transformers: vo.getTransformers(),
        });
        return state;
    }


    // ════════════════════════════════════════════════════════════════════════════
    // 외부 인터페이스
    // ════════════════════════════════════════════════════════════════════════════

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
    get data() {
        return this._proxy;
    }

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
    async save(requestPath) {
        const handler = this._assertHandler('save');
        const url     = this._resolveURL(requestPath);

        if (this._isNew) {
            // ── POST: 서버에 아직 존재하지 않는 신규 리소스 ─────────────────
            await handler._fetch(url, {
                method: 'POST',
                body:   toPayload(this._getTarget),
            });
            this._isNew = false;

        } else {
            // ── PUT / PATCH: Dirty Checking 기반 자동 분기 ───────────────────
            //
            // dirtyFields: 이번 save() 사이클에서 변경된 최상위 키 집합
            // totalFields: 현재 도메인 객체의 최상위 키 수 (Object.keys 기준)
            //
            // dirtyRatio가 DIRTY_THRESHOLD(0.7) 이상이면,
            // PATCH 배열을 생성하는 것보다 전체 객체를 PUT으로 보내는 것이 더 효율적이다.
            const dirtyFields  = this._getDirtyFields();
            const totalFields  = Object.keys(this._getTarget()).length;
            const dirtyRatio   = totalFields > 0 ? dirtyFields.size / totalFields : 0;

            if (dirtyFields.size === 0 || dirtyRatio >= DIRTY_THRESHOLD) {
                // PUT — 의도적 재저장이거나 대부분의 필드가 변경된 경우
                await handler._fetch(url, {
                    method: 'PUT',
                    body:   toPayload(this._getTarget),
                });
            } else {
                // PATCH — 변경된 부분만 RFC 6902 JSON Patch 배열로 전송
                await handler._fetch(url, {
                    method: 'PATCH',
                    body:   JSON.stringify(toPatch(this._getChangeLog)),
                });
            }
        }

        // ── 동기화 성공 후 상태 초기화 ──────────────────────────────────────
        // changeLog와 dirtyFields는 반드시 쌍으로 초기화해야 한다.
        // 둘 중 하나만 초기화하면 다음 save() 호출 시 분기 판단이 오염된다.
        this._clearChangeLog();
        this._clearDirtyFields();

        if (this._debug) this._broadcast();
    }

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
    async remove(requestPath) {
        const handler = this._assertHandler('remove');
        const url = this._resolveURL(requestPath);
        await handler._fetch(url, { method: 'DELETE' });
    }

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
    log() {
        if (!this._debug) return;
        const log = this._getChangeLog();
        console.group(`[DSM][${this._label}] changeLog`);
        log.length ? console.table(log) : console.log('(변경 이력 없음)');
        console.groupEnd();
    }

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
    openDebugger() {
        if (this._debug) openDebugPopup();
    }


    // ════════════════════════════════════════════════════════════════════════════
    // 내부 유틸 메서드
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * `handler`가 주입되어 있는지 검사하고, 없으면 `Error`를 throw한다.
     *
     * @param {string} method - 호출한 메서드명 (에러 메시지 생성용)
     * @returns {import('../src/handler/api-handler.js').ApiHandler} - 안전한 핸들러 반환!
     */
    _assertHandler(method) {
        if (!this._handler) throw new Error(ERR.HANDLER_MISSING(method));
        return this._handler;
    }

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
    _resolveURL(requestPath) {
        const config = this._urlConfig ?? this._handler?.getUrlConfig() ?? /** @type {any} */ ({});
        return buildURL(config, requestPath ?? '');
    }

    /**
     * 동일 동기 블록 내 다중 상태 변경을 단일 `_broadcast()` 호출로 병합하는
     * 마이크로태스크(Microtask) 배칭 스케줄러.
     *
     * ## 동작 원리
     * `onMutate` 콜백이 `_broadcast()`를 직접 호출하는 대신 이 메서드를 거친다.
     * `_pendingFlush`가 `false`일 때만 `queueMicrotask()`로 flush를 예약하고
     * 플래그를 `true`로 세운다. 이후 동일 동기 블록에서 발생하는 추가 변경은
     * 플래그 체크에서 걸러져 중복 예약 없이 차단된다.
     * 현재 Call Stack이 비워지면 Microtask Queue가 실행되어 `_broadcast()`가
     * 정확히 한 번 호출되고 플래그가 `false`로 복원된다.
     *
     * ## 이벤트 루프 상의 위치
     * ```
     * [Call Stack 동기 코드]          → proxy.name = 'A', proxy.email = 'B', ...
     *   ↓ Call Stack 비워짐
     * [Microtask Queue]              → flush() → _broadcast() (1회)
     *   ↓
     * [Task Queue (렌더링, setTimeout)]
     * ```
     *
     * ## `queueMicrotask` vs `Promise.resolve().then()`
     * 두 방법 모두 Microtask Queue에 작업을 넣는다. `queueMicrotask()`를 선택한 이유:
     * 1. `Promise` 객체 생성·GC 오버헤드가 없다.
     * 2. 코드 의도("microtask에 작업을 직접 예약한다")가 명시적으로 드러난다.
     *
     * ## 배칭에서 제외되는 두 호출
     * - `constructor` 초기 `_broadcast()` : 인스턴스 초기화 시점의 단발 스냅샷.
     * - `save()` 완료 후 `_broadcast()`   : 서버 동기화 완료 이벤트. 즉시 반영 필요.
     * 이 두 곳은 `onMutate` 경로가 아니므로 이 메서드를 거치지 않는다.
     *
     * @returns {void}
     */
    _scheduleFlush() {
        if (this._pendingFlush) return;
        this._pendingFlush = true;

        queueMicrotask(() => {
            // flush 실행 전 플래그를 먼저 초기화한다.
            // _broadcast() 내부에서 추가 변경이 발생하는 극단적 케이스에서도
            // 다음 flush가 정상적으로 예약될 수 있도록 순서를 보장한다.
            this._pendingFlush = false;
            if (this._debug) this._broadcast();
        });
    }

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
    _broadcast() {
        broadcastUpdate(this._label, {
            data:      this._getTarget(),
            changeLog: this._getChangeLog(),
            isNew:     this._isNew,
            errors:    this._errors,
        });
    }
}