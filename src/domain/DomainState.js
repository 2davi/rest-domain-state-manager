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
 * | 멤버             | 종류            | 설명                                                    |
 * |------------------|-----------------|---------------------------------------------------------|
 * | `.data`          | getter (Proxy)  | 변경 추적 Proxy 객체. 유일한 외부 데이터 진입점.        |
 * | `.save(path?)`   | async method    | `isNew` + `changeLog` 기반 POST / PATCH / PUT 자동 분기 |
 * | `.remove(path?)` | async method    | DELETE 요청 전송                                        |
 * | `.log()`         | method          | changeLog를 콘솔 테이블로 출력 (`debug: true` 시만)     |
 * | `.openDebugger()`| method          | 디버그 팝업 열기 (`debug: true` 시만)                   |
 * | `.restore()`     | method          | `save()` 이전 상태로 인메모리 복원. 보상 트랜잭션용.    |
 *
 * ## 플러그인 시스템
 * `DomainState.use(plugin)` 호출 시 `plugin.install(DomainState)`가 실행되어
 * `prototype` 또는 클래스 레벨에 기능을 동적으로 주입할 수 있다.
 *
 * ## 의존성 주입 (Composition Root 패턴)
 * `DomainState`와 `DomainPipeline`의 순환 참조를 제거하기 위해
 * `DomainPipeline`을 직접 import하지 않는다.
 * 대신, 진입점(`index.js`)이 `DomainState.configure({ pipelineFactory })`를 호출하여
 * 팩토리 함수를 모듈 클로저 변수 `_pipelineFactory`에 은닉 주입한다.
 * `DomainState.all()`은 이 팩토리만 호출할 뿐, `DomainPipeline`의 존재를 알지 못한다.
 *
 * @module domain/DomainState
 * @see {@link module:domain/DomainVO DomainVO}
 * @see {@link module:domain/DomainPipeline DomainPipeline}
 * @see {@link module:network/api-handler ApiHandler}
 */

import { toDomain, toPayload, toPatch } from '../core/api-mapper.js';
import { createProxy } from '../core/api-proxy.js';
import { normalizeUrlConfig, buildURL } from '../core/url-resolver.js';
import { ERR } from '../constants/error.messages.js';
import { DIRTY_THRESHOLD } from '../constants/dirty.const.js';
import { broadcastUpdate, openDebugPopup } from '../debug/debug-channel.js';
import { DomainVO } from './DomainVO.js';
import { maybeDeepFreeze } from '../common/freeze.js';
import { setSilent, devWarn } from '../common/logger.js';

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 레벨 유틸리티
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Idempotency-Key로 사용할 UUID v4 문자열을 생성한다.
 *
 * `crypto.randomUUID()`를 1순위로 사용한다. 이 API는 Node.js 14.17.0+,
 * Chrome 92+, Firefox 95+, Safari 15.4+ 이상에서 지원된다.
 * 라이브러리의 `engines.node >= 20.0.0` 요구사항을 만족하는 환경에서는
 * 항상 `crypto.randomUUID()`가 사용된다.
 *
 * 구형 브라우저 환경에서는 `Math.random()` 기반 UUID 폴백을 사용하며,
 * 이 경우 `devWarn()`으로 경고를 출력한다. 폴백 UUID는 보안 강도가 낮으므로
 * 프로덕션 환경에서는 `crypto.randomUUID()`를 지원하는 환경을 사용해야 한다.
 *
 * 이 함수는 클래스 외부의 모듈 레벨에 위치한다.
 * 인스턴스마다 함수를 생성하지 않고, 모든 DomainState 인스턴스가 공유한다.
 *
 * @returns {string} UUID v4 형식의 문자열 (예: `'110e8400-e29b-41d4-a716-446655440000'`)
 */
function _generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // 폴백: 구형 브라우저 환경 대응 (Math.random() 기반 UUID v4)
    // crypto.randomUUID()보다 보안 강도가 낮다.
    // Node.js 20+ 및 모던 브라우저에서는 이 분기가 절대 실행되지 않는다.
    devWarn(
        '[DSM] crypto.randomUUID() 미지원 환경입니다. ' +
        'Math.random() 기반 UUID 폴백을 사용합니다. ' +
        '프로덕션 환경에서는 crypto.randomUUID()를 지원하는 환경을 사용하세요.'
    );
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 레벨 의존성 저장소
// ════════════════════════════════════════════════════════════════════════════════

/**
 * DomainPipeline 인스턴스를 생성하는 팩토리 함수.
 *
 * `DomainState.configure({ pipelineFactory })`를 통해서만 주입받는다.
 * 모듈 스코프 클로저 변수이므로 외부에서 직접 접근하거나 덮어쓸 수 없다.
 *
 * DomainPipeline을 직접 import하지 않으므로 반환 타입을 object로 완화한다.
 * 구체적인 DomainPipeline 타입 힌트는 all()의 @returns JSDoc에서 처리한다.
 * @type {((...args: any[]) => object) | null}
 */
let _pipelineFactory = null;

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainState` 생성자에 전달하는 옵션 객체.
 *
 * @typedef {object} DomainStateOptions
 * @property {import('../network/api-handler.js').ApiHandler|null}  [handler]      - `ApiHandler` 인스턴스. `save()` / `remove()` 호출에 필수.
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
 * @property {string|null}              [label=null]     - 디버그 팝업 표시 이름.
 * @property {DomainVO|null}            [vo=null]        - DomainVO 인스턴스. 스키마 검증 + validators/transformers 주입.
 * @property {boolean}                  [strict=false]   - `true`이면 스키마 불일치(missingKeys) 시 Error를 throw한다.
 *                                                         `false`(기본값)이면 콘솔 에러 출력 후 계속 진행한다.
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
 * @typedef {import('../core/api-proxy.js').ProxyWrapper} ProxyWrapper
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

    // ── 보상 트랜잭션 스냅샷 ──────────────────────────────────────────────────

    /**
     * `save()` 진입 직전 상태의 깊은 복사 스냅샷.
     *
     * | 상태        | 의미                                                               |
     * |-------------|-------------------------------------------------------------------|
     * | `undefined` | `save()` 미호출 또는 `restore()` 완료. `restore()` 호출 시 no-op. |
     * | `object`    | `save()` 진입 시 캡처된 스냅샷. 파이프라인 보상 트랜잭션 기준점.  |
     *
     * `save()` 성공 후에도 즉시 초기화하지 않는다.
     * `DomainPipeline`이 후속 `save()` 실패를 감지한 뒤 이미 성공한 인스턴스에
     * `restore()`를 호출할 수 있도록 기준점을 유지한다.
     *
     * 다음 `save()` 호출 시 덮어쓰여 자동으로 최신 기준점으로 갱신된다.
     *
     * @type {{ data: object, changeLog: import('../core/api-proxy.js').ChangeLogEntry[], dirtyFields: Set<string>, isNew: boolean } | undefined}
     */
    #snapshot = undefined;

    // ── Idempotency-Key ───────────────────────────────────────────────────────

    /**
     * Idempotency-Key UUID 저장소.
     *
     * `ApiHandler` 인스턴스의 `_idempotent` 옵션이 `true`인 경우에만 사용된다.
     * `save()` 진입 시 UUID를 발급하고, 성공 시 즉시 초기화한다.
     * 실패(네트워크 오류, HTTP 오류) 시에는 유지되어 소비자 `catch` 블록에서
     * `save()`를 재호출할 때 동일 UUID를 서버에 전송한다.
     *
     * ## 2-상태 설계 (`#csrfToken`의 3-상태와 다른 이유)
     * `#csrfToken`은 "init() 호출 후 파싱 실패"라는 별도의 에러 상태(`null`)가 필요하다.
     * `#idempotencyKey`는 파싱 실패 시나리오가 없으므로 2-상태로 단순화한다.
     *
     * | 상태        | 의미                                             | `save()` 동작                  |
     * |-------------|--------------------------------------------------|-------------------------------|
     * | `undefined` | 기능 비활성 또는 이전 요청 성공 후 초기화 상태    | Idempotency-Key 헤더 미삽입   |
     * | `string`    | 요청 진행 중 또는 실패 후 재시도 대기 중 UUID     | Idempotency-Key 헤더 자동 주입 |
     *
     * `restore()` 호출 시: `#snapshot = undefined`와 동시에 `undefined`로 초기화된다.
     * 재시도 맥락 자체가 소멸했으므로 다음 `save()`는 신규 UUID를 발급한다.
     *
     * @type {string | undefined}
     */
    #idempotencyKey = undefined;

    // ── Shadow State ──────────────────────────────────────────────────────────

    /**
     * 가장 최근 생성된 불변 스냅샷. `getSnapshot()`이 반환하는 값.
     *
     * | 상태     | 의미                                                       |
     * |----------|------------------------------------------------------------|
     * | `null`   | constructor 실행 전 초기값. 즉시 초기화됨.                 |
     * | `object` | `_buildSnapshot()`이 생성한 동결된 스냅샷.                 |
     *
     * `dirtyFields`가 비어있으면 `_buildSnapshot()`이 이 참조를 그대로 유지한다.
     * 이것이 `useSyncExternalStore`의 "변경 없음 → 동일 참조 반환" 규약을 보장한다.
     *
     * @type {object | null}
     */
    #shadowCache = null;

    /**
     * `subscribe()`로 등록된 외부 리스너 집합.
     * `_buildSnapshot()` 완료 직후 `_notifyListeners()`가 전체를 순회하여 호출한다.
     * `useSyncExternalStore`의 `subscribe` 콜백 규약을 만족한다.
     *
     * @type {Set<() => void>}
     */
    #listeners = new Set();

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

    // ── 의존성 주입 (Composition Root 패턴) ───────────────────────────────────

    /**
     * 라이브러리 의존성 및 전역 동작을 설정하는 메서드.
     *
     * `DomainState`와 `DomainPipeline`의 순환 참조를 제거하기 위해,
     * `DomainPipeline` 생성자를 직접 import하지 않고 팩토리 함수로 주입받는다.
     *
     * **`pipelineFactory`는 직접 호출 불필요.** 라이브러리 진입점(`index.js`)이
     * 모듈 평가 시점에 자동으로 주입한다.
     *
     * Vitest 환경에서는 `configure({ pipelineFactory: vi.fn() })`으로 DomainPipeline을
     * 로드하지 않고도 DomainState 단독 테스트가 가능하다.
     *
     * @param {object}   [config={}] - configure()의 config 파라미터
     * @param {(...args: any[]) => object} [config.pipelineFactory]
     *   `(resourceMap, options) => DomainPipeline` 형태의 팩토리 함수.
     *   `DomainState.all()` 호출 전에 반드시 주입되어야 한다.
     * @param {boolean}  [config.silent=false]
     *   `true`이면 라이브러리 내부의 모든 `console` 출력을 억제한다.
     *   통합 테스트 또는 콘솔 오염을 막아야 하는 운영 환경에서 사용한다.
     * @returns {typeof DomainState} 체이닝용 `DomainState` 클래스 반환
     * @throws {TypeError} `pipelineFactory`가 전달됐지만 함수가 아닐 때
     *
     * @example <caption>index.js (Composition Root) — 라이브러리 내부 사용</caption>
     * DomainState.configure({
     *     pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options)
     * });
     *
     * @example <caption>Vitest 테스트 환경에서 mock 주입</caption>
     * DomainState.configure({ pipelineFactory: vi.fn(() => ({ run: vi.fn() })) });
     *
     * @example <caption>통합 테스트 환경 — 콘솔 억제</caption>
     * DomainState.configure({ silent: true });
     *
     * @example <caption>체이닝</caption>
     * DomainState.configure({ pipelineFactory: factory, silent: true }).use(FormBinder);
     */
    static configure({ pipelineFactory, silent } = {}) {
        // pipelineFactory: 전달된 경우에만 검증 및 주입
        // undefined이면 건너뜀 — configure({ silent: true })만 호출해도 에러 없음
        if (pipelineFactory !== undefined) {
            if (typeof pipelineFactory !== 'function') {
                throw new TypeError(
                    '[DSM] DomainState.configure(): pipelineFactory는 함수여야 합니다.'
                );
            }
            _pipelineFactory = pipelineFactory;
        }

        // silent: 전달된 경우에만 설정
        if (silent !== undefined) {
            setSilent(silent);
        }

        return DomainState; // 체이닝 허용: DomainState.configure({...}).use(Plugin)
    }

    /**
     * 여러 `DomainState`를 병렬로 fetch하고, 후처리 핸들러를 순서대로 체이닝하는
     * `DomainPipeline` 인스턴스를 반환한다.
     *
     * 내부적으로 `_pipelineFactory`(모듈 클로저 변수)를 호출한다.
     * `DomainState.configure()`를 통해 팩토리가 주입되지 않으면 즉시 `Error`를 throw한다.
     *
     * @param {ResourceMap}     resourceMap - 키: 리소스 식별자, 값: `Promise<DomainState>`
     * @param {PipelineOptions} [options]   - 파이프라인 실행 옵션
     * @returns {object} 체이닝 가능한 DomainPipeline 인스턴스. after() / run() 메서드를 제공한다.
     * @throws {Error} `configure()`가 호출되지 않은 경우
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
        if (!_pipelineFactory) {
            throw new Error(ERR.PIPELINE_NOT_CONFIGURED);
        }
        // _pipelineFactory는 index.js에서 (...args) => new DomainPipeline(...args)로 주입됨.
        // DomainState는 DomainPipeline의 존재를 모르고, 팩토리 함수만 실행한다.
        return _pipelineFactory(resourceMap, options);
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
        this._proxy = proxyWrapper.proxy;
        /** @type {() => import('../core/api-proxy.js').ChangeLogEntry[]} */
        this._getChangeLog = proxyWrapper.getChangeLog;
        /** @type {() => object} */
        this._getTarget = proxyWrapper.getTarget;
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
        this._getDirtyFields = proxyWrapper.getDirtyFields;
        /** @type {() => void} */
        this._clearDirtyFields = proxyWrapper.clearDirtyFields;
        // ──────────────────────────────────────────────────────────────────────

        // ── Optimistic Update 롤백용 복원 메서드 ─────────────────────────────
        // save() try 블록이 실패했을 때 _rollback()이 이 세 메서드를 호출하여
        // domainObject, changeLog, dirtyFields를 save() 진입 이전 상태로 되돌린다.
        /** @type {(data: object) => void} */
        this._restoreTarget = proxyWrapper.restoreTarget;
        /** @type {(entries: import('../core/api-proxy.js').ChangeLogEntry[]) => void} */
        this._restoreChangeLog = proxyWrapper.restoreChangeLog;
        /** @type {(fields: Set<string>) => void} */
        this._restoreDirtyFields = proxyWrapper.restoreDirtyFields;
        // ─────────────────────────────────────────────────────────────────────

        // ── 메타데이터 ────────────────────────────────────────────────────────
        /** @type {import('../network/api-handler.js').ApiHandler|null} */
        this._handler = options.handler ?? null;
        /** @type {NormalizedUrlConfig|null} */
        this._urlConfig = options.urlConfig ?? null;
        /** @type {boolean} — true이면 save() 시 POST로 분기 */
        this._isNew = options.isNew ?? false;
        /** @type {boolean} — true이면 log() / openDebugger() 활성화 */
        this._debug = options.debug ?? false;
        /** @type {string} — 디버그 팝업 식별 레이블 */
        this._label = options.label ?? `ds_${Date.now()}`;
        /** @type {ValidatorMap} */
        this._validators = options.validators ?? {};
        /** @type {TransformerMap} */
        this._transformers = options.transformers ?? {};
        /** @type {Array<*>} — 인스턴스 수준 에러 목록 */
        this._errors = [];

        // ── Shadow State 초기화 ───────────────────────────────────────────────
        // getSnapshot()은 항상 유효한 참조를 반환해야 한다.
        // constructor 시점에 반드시 초기 스냅샷을 생성한다.
        // 이후 _scheduleFlush()의 microtask 콜백이 변경마다 재빌드한다.
        this.#shadowCache = maybeDeepFreeze(this._buildSnapshot(this._getTarget(), null));
        // ─────────────────────────────────────────────────────────────────────

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
     * @param {import('../network/api-handler.js').ApiHandler}          handler           - `ApiHandler` 인스턴스
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
    static fromJSON(
        jsonText,
        handler,
        { urlConfig = null, debug = false, label = null, vo = null, strict = false } = {}
    ) {
        /** @type {DomainState|null} */
        let state = null;
        const wrapper = toDomain(jsonText, () => {
            // _broadcast() 직접 호출 대신 배칭 스케줄러를 거친다.
            // 동일 동기 블록 내 다중 변경이 단일 postMessage로 병합된다.
            state?._scheduleFlush();
        });

        state = new DomainState(wrapper, {
            handler,
            urlConfig,
            isNew: false,
            debug,
            label: label ?? `json_${Date.now()}`,
        });

        // DomainVO 스키마 검증 및 validators / transformers 주입
        if (vo instanceof DomainVO) {
            const { valid, missingKeys } = vo.checkSchema(wrapper.getTarget());
            if (!valid && strict) {
                throw new Error(ERR.VO_SCHEMA_STRICT_FAIL(missingKeys));
            }
            if (valid) {
                state._validators = vo.getValidators();
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
     * @param {import('../network/api-handler.js').ApiHandler}        handler   - `ApiHandler` 인스턴스
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
    static fromVO(vo, handler, { urlConfig = null, debug = false, label = null } = {}) {
        if (!(vo instanceof DomainVO)) throw new TypeError(ERR.FROM_VO_TYPE);

        const resolvedUrlConfig =
            urlConfig ??
            (vo.getBaseURL()
                ? normalizeUrlConfig({ baseURL: vo.getBaseURL() ?? undefined, debug })
                : null);

        /** @type {DomainState|null} */
        let state = null;

        const wrapper = createProxy(vo.toSkeleton(), () => {
            state?._scheduleFlush();
        });

        state = new DomainState(wrapper, {
            handler,
            urlConfig: resolvedUrlConfig,
            isNew: true,
            debug,
            label: label ?? vo.constructor.name,
            validators: vo.getValidators(),
            transformers: vo.getTransformers(),
        });
        return state;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 외부 인터페이스
    // ════════════════════════════════════════════════════════════════════════════

    // ── Shadow State 공개 API ─────────────────────────────────────────────────

    /**
     * 상태 변경 시 호출될 리스너를 등록한다.
     *
     * `useSyncExternalStore`의 `subscribe` 인자로 직접 전달할 수 있다.
     * Proxy 변경 → microtask 배치 완료 → `_buildSnapshot()` 직후 리스너가 호출된다.
     *
     * @param {() => void} listener - 상태 변경 시 호출될 콜백. 인자를 받지 않는다.
     * @returns {() => void} 구독 해제 함수. `useSyncExternalStore`에 전달하는 cleanup.
     *
     * @example <caption>useSyncExternalStore와 직접 연결</caption>
     * const data = useSyncExternalStore(
     *     (cb) => state.subscribe(cb),
     *     ()   => state.getSnapshot()
     * );
     *
     * @example <caption>useDomainState 어댑터 사용 (권장)</caption>
     * // import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
     * const data = useDomainState(state);
     */
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    /**
     * 가장 최근에 생성된 불변 스냅샷을 반환한다.
     *
     * ## `useSyncExternalStore` 규약 준수
     * - **변경이 없으면 반드시 이전과 동일한 참조를 반환한다.**
     *   매번 새 객체를 반환하면 React가 무한 리렌더링 루프에 빠진다.
     * - **반환값은 동결된 불변 객체다.**
     *   개발 환경에서만 `deepFreeze` 적용, 프로덕션에서는 no-op.
     *
     * ## Vanilla JS / Vue 환경
     * React 없이도 사용 가능하다.
     * Proxy가 아닌 순수 불변 객체가 필요할 때 이 메서드를 직접 호출한다.
     *
     * @returns {Readonly<object>} 현재 상태의 불변 스냅샷. 변경 시 새 참조 반환.
     *
     * @example <caption>Vanilla JS 상태 비교</caption>
     * const snap1 = state.getSnapshot();
     * state.data.name = 'Davi';
     * await Promise.resolve(); // microtask flush 대기
     * const snap2 = state.getSnapshot();
     * console.log(snap1 === snap2);           // false — 새 참조
     * console.log(snap1.email === snap2.email); // true  — 미변경 키 Structural Sharing
     */
    getSnapshot() {
        // #shadowCache는 constructor에서 반드시 초기화되므로 null이 될 수 없다.
        return /** @type {object} */ (this.#shadowCache);
    }

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
     *     dirtyFields.size === 0           → PUT   (변경 없는 의도적 재저장)
     *     dirtyRatio >= DIRTY_THRESHOLD    → PUT   (변경 비율 70% 이상 — 전체 교체가 효율적)
     *     dirtyRatio <  DIRTY_THRESHOLD    → PATCH (변경 부분만 RFC 6902 Patch 배열로 전송)
     * ```
     *
     * ## Optimistic Update 롤백
     * `save()` 진입 직전 `structuredClone()`으로 현재 상태의 깊은 복사 스냅샷을 생성한다.
     * HTTP 요청이 실패(`4xx` / `5xx` / 네트워크 오류)하면 `_rollback(snapshot)`을 호출하여
     * `domainObject`, `changeLog`, `dirtyFields`, `_isNew` 4개 상태를 일관되게 복원한다.
     * 복원 후 에러를 반드시 re-throw하여 호출자가 처리할 수 있게 한다.
     *
     * ## structuredClone 전제
     * 스냅샷은 `structuredClone()`을 사용하므로 `domainObject` 내부에
     * 함수, DOM 노드, Symbol 등 구조화된 복제가 불가능한 값이 있으면 throw된다.
     * REST API JSON 응답 데이터(문자열, 숫자, 배열, 플레인 객체)만 담는
     * 일반적인 DTO에서는 문제가 발생하지 않는다.
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
     * @example <caption>기본 사용</caption>
     * await user.save('/api/users/user_001');
     *
     * @example <caption>에러 처리 및 롤백 확인</caption>
     * try {
     *     await user.save('/api/users/1');
     * } catch (err) {
     *     // err: { status: 409, statusText: 'Conflict', body: '...' }
     *     // 이 시점에 user.data는 save() 호출 이전 상태로 자동 복원되어 있다.
     *     console.error('저장 실패, 상태 롤백 완료:', err.status);
     * }
     *
     * @example <caption>재시도 패턴</caption>
     * for (let attempt = 0; attempt < 3; attempt++) {
     *     try {
     *         await user.save('/api/users/1');
     *         break;
     *     } catch (err) {
     *         if (attempt === 2) throw err; // 3회 실패 시 상위로 전파
     *         // 롤백된 상태 그대로 재시도 가능
     *     }
     * }
     */
    async save(requestPath) {
        const handler = this._assertHandler('save');
        const url = this._resolveURL(requestPath);

        // ── 스냅샷 캡처 — save() 진입 직전 상태를 인스턴스 필드에 저장 ─────────
        // - 실패 시: _rollback()이 이 스냅샷으로 4개 상태를 복원한다.
        // - 성공 시: DomainPipeline 보상 트랜잭션을 위해 유지된다.
        // - 다음 save() 호출 시: 덮어쓰여 자동으로 최신 기준점으로 갱신된다.
        this.#snapshot = {
            data: structuredClone(this._getTarget()),
            changeLog: this._getChangeLog(), // 이미 얕은 복사본 반환
            dirtyFields: this._getDirtyFields(), // 이미 new Set 복사본 반환
            isNew: this._isNew,
        };

        try {
            if (this._isNew) {
                // ── POST: 서버에 아직 존재하지 않는 신규 리소스 ─────────────
                await handler._fetch(url, {
                    method: 'POST',
                    body: toPayload(this._getTarget),
                });
                this._isNew = false;
            } else {
                // ── PUT / PATCH: Dirty Checking 기반 자동 분기 ──────────────
                const dirtyFields = this._getDirtyFields();
                const totalFields = Object.keys(this._getTarget()).length;
                const dirtyRatio = totalFields > 0 ? dirtyFields.size / totalFields : 0;

                if (dirtyFields.size === 0 || dirtyRatio >= DIRTY_THRESHOLD) {
                    await handler._fetch(url, {
                        method: 'PUT',
                        body: toPayload(this._getTarget),
                    });
                } else {
                    await handler._fetch(url, {
                        method: 'PATCH',
                        body: JSON.stringify(toPatch(this._getChangeLog)),
                    });
                }
            }

            // ── 동기화 성공 후 상태 초기화 ──────────────────────────────────
            this._clearChangeLog();
            this._clearDirtyFields();
            // #snapshot은 유지한다. DomainPipeline 보상 트랜잭션 기준점 역할.
            if (this._debug) this._broadcast();
        } catch (err) {
            // ── HTTP 오류 또는 네트워크 오류 — 상태 롤백 ────────────────────
            // 어떤 이유로 서버 동기화가 실패했든 클라이언트 상태를 복원한다.
            console.warn(ERR.SAVE_ROLLBACK(/** @type {any} */ (err)?.status ?? 0));
            this._rollback(this.#snapshot);

            // 에러를 반드시 re-throw한다.
            // 호출자의 try/catch가 HttpError를 받아 적절히 처리할 수 있어야 한다.
            // #snapshot은 유지한다. 재시도 시 동일 기준점으로 다시 rollback 가능.
            throw err;
        }
    }

    /**
     * 인메모리 도메인 상태를 `save()` 진입 이전 스냅샷으로 복원한다.
     *
     * `DomainPipeline`의 보상 트랜잭션(Compensating Transaction)에서
     * 파이프라인이 자동으로 호출한다. 소비자가 직접 호출할 수도 있다.
     *
     * ## 복원 대상 (4가지)
     * `save()` 진입 직전 캡처된 `#snapshot`의 네 가지 상태를 복원한다.
     * - `domainObject` (원본 데이터)
     * - `changeLog` (변경 이력)
     * - `dirtyFields` (변경된 필드 집합)
     * - `isNew` 플래그
     *
     * ## 멱등성 보장
     * `#snapshot`이 `undefined`이면 경고 로그 후 `false`를 반환한다.
     * 동일 인스턴스에 여러 번 호출해도 에러 없이 동일 결과를 낸다.
     *
     * ## 책임 범위
     * 이 메서드는 **프론트엔드 인메모리 상태만 복원**한다.
     * 서버에 이미 커밋된 상태를 되돌리는 것은 라이브러리 책임 범위 밖이며,
     * 소비자가 `dsm:rollback` 이벤트를 구독하여 서버 롤백 API를 직접 호출해야 한다.
     *
     * ## `dsm:rollback` 이벤트
     * 복원 완료 후 브라우저 환경에서 `CustomEvent('dsm:rollback')`를 발행한다.
     * 소비자 앱이 이 이벤트를 구독하여 사용자 알림을 표시할 수 있다.
     *
     * @returns {boolean} 복원 성공 시 `true`, 스냅샷 없어 no-op 시 `false`
     *
     * @example <caption>DomainPipeline이 자동으로 호출 (failurePolicy: 'rollback-all')</caption>
     * const result = await DomainState.all({ a: ..., b: ..., c: ... }, {
     *     failurePolicy: 'rollback-all',
     * }).after('a', s => s.save('/api/a'))
     *   .after('b', s => s.save('/api/b'))
     *   .after('c', s => s.save('/api/c'))
     *   .run();
     *
     * @example <caption>소비자가 직접 호출</caption>
     * try {
     *     await userState.save('/api/users/1');
     *     await profileState.save('/api/profiles/1');
     * } catch (err) {
     *     userState.restore();  // 인메모리 상태 복원
     *     // 서버 롤백은 소비자 책임: DELETE /api/users/1 등
     * }
     *
     * @example <caption>dsm:rollback 이벤트 구독</caption>
     * window.addEventListener('dsm:rollback', (e) => {
     *     console.warn(`[UI] ${e.detail.label} 상태가 복원되었습니다.`);
     *     showErrorNotification('저장에 실패하여 이전 상태로 복원되었습니다.');
     * });
     */
    restore() {
        // ── 멱등성 방어 ─────────────────────────────────────────────────────
        // #snapshot이 undefined이면 no-op.
        // save() 미호출이거나 이미 restore()가 완료된 상태다.
        if (this.#snapshot === undefined) {
            console.warn(
                `[DSM][${this._label}] restore(): 스냅샷이 없습니다. ` +
                    'save() 호출 없이 restore()를 호출했거나 이미 복원된 상태입니다.'
            );
            return false;
        }
        // ───────────────────────────────────────────────────────────────────

        // ── 인메모리 상태 복원 ───────────────────────────────────────────────
        this._rollback(this.#snapshot);
        // ───────────────────────────────────────────────────────────────────

        // ── 스냅샷 초기화 ────────────────────────────────────────────────────
        // 복원 완료. 다음 restore() 호출은 no-op이 된다 (멱등성).
        this.#snapshot = undefined;
        // ───────────────────────────────────────────────────────────────────

        // ── dsm:rollback 이벤트 발행 ─────────────────────────────────────────
        // 소비자 앱이 구독하여 서버 롤백 API 호출 또는 UI 알림 표시 가능.
        // Node.js / Vitest 환경에서는 window가 없으므로 건너뛴다.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('dsm:rollback', {
                    detail: { label: this._label },
                })
            );
        }
        // ───────────────────────────────────────────────────────────────────

        return true;
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
        log.length ? console.table(log) : console.debug('(변경 이력 없음)');
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

    // ── Shadow State 내부 메서드 ──────────────────────────────────────────────

    /**
     * Structural Sharing 기반 불변 스냅샷을 빌드한다.
     *
     * ## 알고리즘 (depth-1 Structural Sharing)
     * `dirtyFields`(변경된 최상위 키 집합)를 기준으로 스냅샷을 구성한다.
     *
     * | 조건                              | 처리 방식                              |
     * |-----------------------------------|----------------------------------------|
     * | `prevSnapshot !== null` + dirty 없음 | `prevSnapshot` 그대로 반환 (캐시 히트) |
     * | dirty 있음 / 최초 생성            | 변경 키: 얕은 복사 / 나머지: 참조 재사용 |
     *
     * 배열: `[...val]`, plain Object: `{ ...val }`, Primitive: 값 그대로.
     * `Date` / `Map` / `Set`은 참조를 그대로 공유한다.
     * 현 VO 레이어에서 이들 타입이 실질적으로 사용되지 않으므로 단순화하였다.
     *
     * @param {object}        currentData  - `_getTarget()`으로 얻은 원본 객체
     * @param {object | null} prevSnapshot - 이전 스냅샷. 최초 호출 시 `null`.
     * @returns {object} 새로 조립된 스냅샷 객체 (freeze 이전 단계)
     */
    _buildSnapshot(currentData, prevSnapshot) {
        const dirtyFields = this._getDirtyFields();

        // 변경 없음 + 이전 스냅샷 존재 → 동일 참조 유지 (useSyncExternalStore 무한루프 방지)
        if (prevSnapshot !== null && dirtyFields.size === 0) {
            return prevSnapshot;
        }

        const snapshot = /** @type {Record<string, unknown>} */ ({});

        for (const key of Object.keys(currentData)) {
            const isDirty = prevSnapshot === null || dirtyFields.has(key);

            if (isDirty) {
                const val = /** @type {any} */ (currentData)[key];

                if (Array.isArray(val)) {
                    snapshot[key] = [...val];
                } else if (val !== null && typeof val === 'object') {
                    snapshot[key] = { ...val };
                } else {
                    snapshot[key] = val;
                }
            } else {
                // 변경 없는 키 — 이전 스냅샷 참조 재사용 (Structural Sharing)
                snapshot[key] = /** @type {Record<string, unknown>} */ (prevSnapshot)[key];
            }
        }

        return snapshot;
    }

    /**
     * `#listeners`에 등록된 모든 리스너를 동기적으로 호출한다.
     *
     * 개별 리스너 에러를 격리하여 한 리스너의 실패가 나머지 실행을 막지 않는다.
     *
     * @returns {void}
     */
    _notifyListeners() {
        for (const listener of this.#listeners) {
            try {
                listener();
            } catch (err) {
                // 리스너 에러 격리 — 나머지 리스너 실행 및 디버그 채널 전파에 영향 없음
                console.error('[DSM] subscribe 리스너 실행 중 에러 발생:', err);
            }
        }
    }

    /**
     * `handler`가 주입되어 있는지 검사하고, 없으면 `Error`를 throw한다.
     *
     * @param {string} method - 호출한 메서드명 (에러 메시지 생성용)
     * @returns {import('../network/api-handler.js').ApiHandler} - 안전한 핸들러 반환!
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
     * `save()` 실패 시 도메인 상태를 save() 진입 이전 스냅샷으로 복원한다.
     *
     * ## 복원 대상 4가지
     *
     * | 대상              | 복원 이유                                                    |
     * |------------------|--------------------------------------------------------------|
     * | `domainObject`   | Proxy target이 이미 변경된 상태. 서버와 불일치 제거.         |
     * | `changeLog`      | save() 재시도 시 올바른 PATCH payload 재생성 보장.           |
     * | `dirtyFields`    | save() 재시도 시 올바른 PUT/PATCH 분기 판단 보장.            |
     * | `this._isNew`    | POST 실패 후 isNew 플래그 일관성 유지.                       |
     *
     * ## Proxy 우회
     * `restoreTarget()`은 Proxy가 아닌 원본 `domainObject`에 직접 접근하므로
     * 복원 작업 자체가 `changeLog`나 `dirtyFields`에 기록되지 않는다.
     *
     * ## 디버그 채널 전파
     * `debug: true`이면 롤백 완료 후 `_broadcast()`를 호출하여
     * 디버그 패널이 롤백된 상태를 즉시 반영하도록 한다.
     *
     * @param {{ data: object, changeLog: import('../core/api-proxy.js').ChangeLogEntry[], dirtyFields: Set<string>, isNew: boolean }} snapshot
     *   `save()` 진입 직전에 확보한 상태 스냅샷
     * @returns {void}
     */
    _rollback(snapshot) {
        this._restoreTarget(snapshot.data);
        this._restoreChangeLog(snapshot.changeLog);
        this._restoreDirtyFields(snapshot.dirtyFields);
        this._isNew = snapshot.isNew;
        if (this._debug) this._broadcast();
    }

    /**
     * 동일 동기 블록 내 다중 상태 변경을 단일 flush로 병합하는 마이크로태스크 배칭 스케줄러.
     *
     * ## 동작 원리
     * `_pendingFlush`가 `false`일 때만 `queueMicrotask()`로 flush를 예약한다.
     * 동일 동기 블록의 추가 변경은 플래그 체크에서 차단되어 중복 예약 없이 건너뛴다.
     * Call Stack이 비워지면 Microtask Queue가 실행되어 flush가 정확히 한 번 실행된다.
     *
     * ## flush 실행 순서
     * ```
     * 1. pendingFlush = false          (다음 flush 예약 허용)
     * 2. _buildSnapshot()              (Structural Sharing 기반 스냅샷 재빌드)
     * 3. #shadowCache 갱신             (새 참조일 때만)
     * 4. _notifyListeners()            (React / 외부 구독자 알림)
     * 5. if (debug) _broadcast()       (디버그 채널 전파)
     * ```
     *
     * ## 배칭에서 제외되는 두 호출
     * - `constructor` 초기 스냅샷 빌드 : 인스턴스 생성 시 `_buildSnapshot()` 직접 호출.
     * - `save()` 완료 후 `_broadcast()` : 서버 동기화 완료. `onMutate` 경로 미경유.
     *
     * @returns {void}
     */
    _scheduleFlush() {
        if (this._pendingFlush) return;
        this._pendingFlush = true;

        queueMicrotask(() => {
            // 플래그를 먼저 초기화한다.
            // _broadcast() 내에서 추가 변경이 발생하는 극단적 케이스에서도
            // 다음 flush가 정상적으로 예약되도록 순서를 보장한다.
            this._pendingFlush = false;

            // ── Shadow State 갱신 ──────────────────────────────────────────────
            const newSnapshot = this._buildSnapshot(this._getTarget(), this.#shadowCache);

            // _buildSnapshot()이 prevSnapshot을 그대로 반환한 경우(dirty 없음)에는
            // 참조가 동일하므로 캐시 갱신과 리스너 알림을 건너뛴다.
            // 이것이 useSyncExternalStore 무한루프의 근본 방어선이다.
            if (newSnapshot !== this.#shadowCache) {
                this.#shadowCache = maybeDeepFreeze(newSnapshot);
                this._notifyListeners();
            }
            // ──────────────────────────────────────────────────────────────────

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
            data: this._getTarget(),
            changeLog: this._getChangeLog(),
            isNew: this._isNew,
            errors: this._errors,
        });
    }
}
