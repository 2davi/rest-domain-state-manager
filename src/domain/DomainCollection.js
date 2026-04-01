/**
 * DomainCollection — 1:N 배열 상태 관리 컨테이너
 *
 * `DomainState`가 단일 DTO 객체를 다루는 것처럼,
 * `DomainCollection`은 **N개의 `DomainState` 인스턴스**를 담는 컨테이너다.
 *
 * ## Java 유추
 * ```
 * DomainState       ≈ Map<K,V>        (단일 DTO 객체)
 * DomainCollection  ≈ List<DomainState> (DomainState 배열)
 * ```
 *
 * ## 설계 원칙
 *
 * ### UI 독립성
 * `DomainCollection`은 UI와 완전히 독립된 순수 상태 레이어다.
 * `UIComposer` 없이도 `saveAll({ strategy: 'batch', path })` 단독 사용이 가능하다.
 *
 * ### 단방향 의존성
 * `DomainCollection → DomainState` 단방향.
 * `DomainState`는 `DomainCollection`을 알지 못한다.
 *
 * ### Nested Array 선언 방식 — 런타임 연결
 * `DomainVO.static fields`에 배열 기본값(`default: []`)만 선언한다.
 * `UIComposer.bindCollection()` 호출 시점에 런타임으로 해당 필드를 연결한다.
 * `DomainVO`가 `DomainCollection`을 직접 참조하면 순환 의존성이 재발한다.
 *
 * ## 생성 경로 (팩토리 메서드)
 *
 * | 팩토리                       | 입력              | `_isNew` | 주 용도                              |
 * |------------------------------|-------------------|----------|--------------------------------------|
 * | `DomainCollection.create()`  | 없음              | `true`   | 신규 배열 생성 후 POST               |
 * | `DomainCollection.fromJSONArray()` | JSON 문자열 | `false`  | GET 응답 배열 수신 후 수정 → PUT     |
 *
 * ## saveAll 전략
 *
 * | 전략          | 동작                                | 지원 여부         |
 * |---------------|-------------------------------------|------------------|
 * | `'batch'`     | 배열 전체를 단일 POST / PUT로 전송  | ✅ v1.3.x MVP    |
 * | `'sequential'`| 각 DomainState를 순차적으로 save()  | 🔜 v2.x 이후     |
 * | `'parallel'`  | 각 DomainState를 병렬로 save()      | 🔜 v2.x 이후     |
 *
 * @module domain/DomainCollection
 * @see {@link module:domain/DomainState DomainState}
 *
 * @example <caption>빈 컬렉션에서 시작 — POST</caption>
 * const certs = DomainCollection.create(api);
 * certs.add({ certName: '정보처리기사', certType: 'IT' });
 * certs.add({ certName: '한국사', certType: 'HISTORY' });
 * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
 *
 * @example <caption>GET 응답 수신 후 수정 → PUT</caption>
 * const certs = await DomainCollection.fromJSONArray(
 *     await fetch('/api/certificates').then(r => r.text()),
 *     api
 * );
 * certs.add({ certName: '신규자격증' });
 * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
 */

import { DomainState } from './DomainState.js';
import { normalizeUrlConfig } from '../core/url-resolver.js';
import { ERR } from '../constants/error.messages.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainCollection.create()` / `fromJSONArray()` 공통 옵션 객체.
 *
 * @typedef {object} DomainCollectionOptions
 *
 * @property {import('../core/url-resolver.js').UrlConfig|null} [urlConfig=null]
 *   이 컬렉션의 모든 요청에 적용할 URL 설정.
 *   미입력 시 `handler.getUrlConfig()` 폴백.
 *
 * @property {boolean} [debug=false]
 *   `true`이면 각 `DomainState` 항목에 `debug: true`가 전파된다.
 *
 * @property {'realtime'|'lazy'} [trackingMode='realtime']
 *   각 `DomainState` 항목의 변경 추적 모드.
 *   `'lazy'`이면 `saveAll()` 시점에 `_initialSnapshot`과 diff 연산을 수행한다.
 *
 * @property {string | undefined} [itemKey]
 *   `trackingMode: 'lazy'`일 때 배열 항목 동일성 기준 필드명.
 *   `UILayout.static itemKey`가 v1.4.x에서 이 값을 사용한다.
 *   미지정 시 positional 비교.
 */

/**
 * `saveAll()` 메서드의 `options` 파라미터.
 *
 * @typedef {object} SaveAllOptions
 *
 * @property {'batch'} strategy
 *   저장 전략. 현재는 `'batch'`만 지원한다.
 *   - `'batch'`: 배열 전체를 단일 HTTP 요청으로 전송한다.
 *     SI 레거시 환경에서 DELETE ALL + INSERT 또는 MERGE 방식의 백엔드와 호환된다.
 *
 * @property {string} path
 *   엔드포인트 경로 (예: `'/api/certificates'`).
 *   `saveAll()`에서 `handler._fetch()`를 직접 호출하므로 경로가 필수다.
 *
 * @property {import('../core/url-resolver.js').UrlConfig} [urlConfig]
 *   이 요청에만 적용할 URL 설정 오버라이드.
 */

// ════════════════════════════════════════════════════════════════════════════════
// DomainCollection 클래스
// ════════════════════════════════════════════════════════════════════════════════

export class DomainCollection {
    // ════════════════════════════════════════════════════════════════════════════
    // 생성자 (직접 호출 금지 — 팩토리 메서드 사용)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * `DomainCollection` 인스턴스를 생성한다.
     *
     * **직접 호출 금지.** `create()` / `fromJSONArray()` 팩토리 메서드를 사용한다.
     *
     * @param {import('../network/api-handler.js').ApiHandler} handler
     *   HTTP 전송 레이어. `saveAll()` 호출에 필수.
     * @param {DomainCollectionOptions} [options={}]
     *   컬렉션 옵션.
     * @param {boolean} [isNew=true]
     *   `true`이면 `saveAll()` 시 POST, `false`이면 PUT.
     */
    constructor(handler, options = {}, isNew = true) {
        /**
         * HTTP 전송 레이어. `saveAll()` 내부에서 직접 호출된다.
         * @type {import('../network/api-handler.js').ApiHandler}
         */
        this._handler = handler;

        /**
         * 정규화된 URL 설정. `saveAll()` 에서 URL 조합에 사용된다.
         * @type {import('../core/url-resolver.js').NormalizedUrlConfig | null}
         */
        this._urlConfig = options.urlConfig
            ? normalizeUrlConfig(
                  /** @type {import('../core/url-resolver.js').UrlConfig} */ (options.urlConfig)
              )
            : null;

        /**
         * 디버그 플래그. `add()` / `fromJSONArray()`로 생성되는 각 DomainState에 전파된다.
         * @type {boolean}
         */
        this._debug = options.debug ?? false;

        /**
         * 변경 추적 모드. 각 DomainState 항목에 전파된다.
         * @type {'realtime'|'lazy'}
         */
        this._trackingMode = options.trackingMode ?? 'realtime';

        /**
         * `lazy` 모드에서 배열 항목 동일성 기준 필드명.
         * `UILayout.static itemKey`가 v1.4.x에서 이 값을 덮어쓴다.
         * @type {string | undefined}
         */
        this._itemKey = options.itemKey ?? undefined;

        /**
         * `isNew: true`이면 `saveAll()` 시 POST, `false`이면 PUT.
         * `create()`로 생성하면 `true`, `fromJSONArray()`로 생성하면 `false`.
         * `saveAll()` 성공 후 `false`로 전환된다.
         * @type {boolean}
         */
        this._isNew = isNew;

        /**
         * 내부 `DomainState` 인스턴스 배열.
         * `getItems()` / `add()` / `remove()` 를 통해서만 관리한다.
         * @type {DomainState[]}
         */
        this._items = [];

        /**
         * `fromJSONArray()` 호출 시점의 초기 배열 스냅샷.
         * `lazy` 모드에서 `saveAll()` 시 diff 기준점으로 사용된다.
         * `create()` 로 생성된 경우 `null`.
         * `saveAll()` 성공 후 현재 상태로 갱신된다.
         *
         * @type {object[] | null}
         */
        this._initialSnapshot = null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 팩토리 메서드
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 빈 `DomainCollection` 인스턴스를 생성한다. (`_isNew: true`)
     *
     * 이후 `add()`로 항목을 추가하고 `saveAll()`로 서버에 POST한다.
     *
     * @param {import('../network/api-handler.js').ApiHandler} handler
     *   HTTP 전송 레이어.
     * @param {DomainCollectionOptions} [options={}]
     *   컬렉션 옵션.
     * @returns {DomainCollection} `_isNew: true`인 빈 컬렉션.
     *
     * @example
     * const certs = DomainCollection.create(api, { debug: true });
     * certs.add({ certName: '정보처리기사', certType: 'IT' });
     * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
     */
    static create(handler, options = {}) {
        return new DomainCollection(handler, options, true);
    }

    /**
     * REST API GET 응답 JSON 문자열(배열)로부터 `DomainCollection`을 생성한다. (`_isNew: false`)
     *
     * JSON 파싱 후 각 항목을 `DomainState.fromJSON()`으로 변환하여 컬렉션에 적재한다.
     * `lazy` 모드이면 생성 시점의 배열 전체를 `_initialSnapshot`에 저장한다.
     *
     * ## JSON 형식 요구사항
     * 응답 본문의 최상위는 반드시 **JSON 배열**이어야 한다.
     * 객체(`{}`)나 기타 형식이 오면 즉시 `Error`를 throw한다.
     *
     * @param {string}   jsonText
     *   `response.text()`로 읽은 GET 응답 JSON 문자열.
     *   최상위가 배열인 JSON이어야 한다.
     * @param {import('../network/api-handler.js').ApiHandler} handler
     *   HTTP 전송 레이어.
     * @param {DomainCollectionOptions} [options={}]
     *   컬렉션 옵션.
     * @returns {DomainCollection} `_isNew: false`인 컬렉션.
     * @throws {SyntaxError} `jsonText`가 유효하지 않은 JSON인 경우.
     * @throws {Error} 파싱된 JSON 최상위가 배열이 아닌 경우.
     *
     * @example <caption>GET 응답 수신 후 항목 추가 → PUT</caption>
     * const jsonText = await fetch('/api/certificates').then(r => r.text());
     * const certs = DomainCollection.fromJSONArray(jsonText, api, { trackingMode: 'lazy', itemKey: 'certId' });
     * certs.add({ certName: '신규자격증' });
     * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
     */
    static fromJSONArray(jsonText, handler, options = {}) {
        // ── JSON 파싱 ─────────────────────────────────────────────────────────
        const parsed = JSON.parse(jsonText); // SyntaxError는 호출자에게 전파

        if (!Array.isArray(parsed)) {
            throw new Error(ERR.COLLECTION_NOT_ARRAY(typeof parsed));
        }
        // ─────────────────────────────────────────────────────────────────────

        const collection = new DomainCollection(handler, options, false);

        // ── 각 항목을 DomainState로 변환하여 적재 ────────────────────────────
        for (const item of parsed) {
            const itemJson = JSON.stringify(item);
            const state = DomainState.fromJSON(itemJson, handler, {
                urlConfig: collection._urlConfig,
                debug: options.debug ?? false,
                trackingMode: options.trackingMode ?? 'realtime',
                itemKey: options.itemKey ?? undefined,
            });
            // fromJSONArray로 생성된 개별 항목은 isNew: false (서버 데이터 기반)
            collection._items.push(state);
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── lazy 모드: 초기 스냅샷 저장 ──────────────────────────────────────
        // saveAll() 시점에 현재 배열 전체를 초기 스냅샷과 비교하기 위해 저장한다.
        if (options.trackingMode === 'lazy') {
            collection._initialSnapshot = structuredClone(parsed);
        }
        // ─────────────────────────────────────────────────────────────────────

        return collection;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 공개 API — 항목 조작
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 컬렉션에 새 항목(`DomainState`)을 추가한다.
     *
     * 전달된 `initialData`로 `DomainState.fromJSON()`을 생성한다.
     * `initialData`가 없으면 빈 객체(`{}`)로 생성한다.
     * 생성된 `DomainState`의 `isNew`는 항상 `true`이다.
     *
     * @param {object} [initialData={}]
     *   새 항목의 초기 데이터. 미전달 시 빈 객체.
     * @returns {DomainState} 생성된 `DomainState` 인스턴스.
     *
     * @example
     * const state = certs.add({ certName: '정보처리기사', certType: 'IT' });
     * console.log(certs.getCount()); // +1
     */
    add(initialData = {}) {
        const itemJson = JSON.stringify(initialData);
        const state = DomainState.fromJSON(itemJson, this._handler, {
            urlConfig: this._urlConfig,
            debug: this._debug,
            trackingMode: this._trackingMode,
            itemKey: this._itemKey,
        });
        // 새로 추가된 항목은 서버에 아직 존재하지 않으므로 isNew: true
        state._isNew = true;
        this._items.push(state);
        return state;
    }

    /**
     * 컬렉션에서 항목을 제거한다.
     *
     * 인덱스(number) 또는 `DomainState` 인스턴스 참조로 제거한다.
     * 존재하지 않는 인덱스나 인스턴스를 전달하면 조용히 no-op으로 처리한다.
     *
     * ## 복수 항목 제거 시 주의사항
     * 복수 인덱스를 연속으로 제거할 때는 반드시 **내림차순(LIFO)으로 정렬** 후 호출해야 한다.
     * 앞 인덱스를 먼저 제거하면 뒤 인덱스가 밀려 잘못된 항목이 제거된다.
     * `UIComposer.removeChecked()`가 이 순서를 자동으로 보장한다.
     *
     * @param {number | DomainState} indexOrState
     *   제거할 항목의 인덱스 또는 `DomainState` 인스턴스.
     * @returns {boolean} 제거 성공 시 `true`, 항목이 없어 no-op 시 `false`.
     *
     * @example <caption>인덱스로 제거</caption>
     * certs.remove(0);
     *
     * @example <caption>참조로 제거</caption>
     * const state = certs.getItems()[0];
     * certs.remove(state);
     *
     * @example <caption>복수 인덱스 제거 — 반드시 내림차순</caption>
     * // [0, 2] → 내림차순 [2, 0] → remove(2) → remove(0)
     * [2, 0].forEach(i => certs.remove(i));
     */
    remove(indexOrState) {
        if (typeof indexOrState === 'number') {
            const idx = indexOrState;
            if (idx < 0 || idx >= this._items.length) return false;
            this._items.splice(idx, 1);
            return true;
        }

        if (indexOrState instanceof DomainState) {
            const idx = this._items.indexOf(indexOrState);
            if (idx === -1) return false;
            this._items.splice(idx, 1);
            return true;
        }

        return false;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 공개 API — 상태 조회
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 컬렉션 내 모든 `DomainState` 인스턴스 배열을 반환한다.
     *
     * 반환된 배열은 내부 배열의 **얕은 복사본**이다.
     * 원본 배열을 직접 수정하지 않도록 복사본을 반환한다.
     *
     * @returns {DomainState[]} 항목 배열.
     *
     * @example
     * certs.getItems().forEach(state => console.log(state.data.certName));
     */
    getItems() {
        return [...this._items];
    }

    /**
     * 체크된 항목(`UIComposer`의 `.dsm-checkbox:checked` 상태) 목록을 반환한다.
     *
     * v1.4.x에서 `UIComposer`가 각 `DomainState`에 `_checked` 플래그를 주입한다.
     * 현재(v1.3.x)에서는 `UIComposer` 미설치 시 빈 배열을 반환한다.
     *
     * @returns {DomainState[]} 체크된 항목 배열.
     */
    getCheckedItems() {
        // v1.4.x에서 UIComposer가 _checked 플래그를 주입한다.
        // 현재는 _checked가 없으므로 항상 빈 배열 반환.
        return this._items.filter((s) => /** @type {any} */ (s)._checked === true);
    }

    /**
     * 컬렉션 내 항목의 총 수를 반환한다.
     *
     * @returns {number} 항목 수.
     *
     * @example
     * console.log(certs.getCount()); // 3
     */
    getCount() {
        return this._items.length;
    }

    /**
     * 모든 항목의 현재 데이터를 일반 객체 배열로 직렬화한다.
     *
     * 각 항목의 `_getTarget()`(Proxy 원본 객체)을 읽어 배열로 반환한다.
     * `saveAll({ strategy: 'batch' })`의 request body 생성에 사용된다.
     *
     * @returns {object[]} 현재 상태의 도메인 객체 배열. Proxy가 아닌 순수 객체.
     *
     * @example
     * const payload = JSON.stringify(certs.toJSON());
     * // → '[{"certId":1,"certName":"정보처리기사"},...]'
     */
    toJSON() {
        return this._items.map((state) => state._getTarget());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 공개 API — 서버 동기화
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 컬렉션 전체를 서버와 동기화한다.
     *
     * ## 현재 지원 전략: `'batch'`
     * 배열 전체를 단일 HTTP 요청으로 전송한다.
     * SI 레거시 환경에서 DELETE ALL + INSERT 또는 MERGE 방식의 백엔드와 호환된다.
     *
     * ## HTTP 메서드 결정
     * - `_isNew: true` (create()로 생성) → POST
     * - `_isNew: false` (fromJSONArray()로 생성) → PUT
     *
     * ## 성공 처리
     * 1. `_isNew = false` (최초 POST 성공 후 이후 요청은 PUT)
     * 2. 각 항목의 `clearChangeLog()` + `clearDirtyFields()`
     * 3. `lazy` 모드: `_initialSnapshot`을 현재 상태로 갱신
     *
     * ## 실패 처리
     * 1. `_rollback()`을 각 항목에 적용 (save() 진입 이전 상태 복원)
     * 2. `_isNew` 상태 복원
     * 3. 에러 re-throw — 소비자의 `catch` 블록이 처리할 수 있도록
     *
     * ## `sequential` / `parallel` 전략 예정
     * v2.x에서 `DomainPipeline` 보상 트랜잭션 완성 이후 연계한다.
     *
     * @param {SaveAllOptions} options - 저장 옵션.
     * @returns {Promise<void>}
     * @throws {Error} `handler`가 주입되지 않은 경우.
     * @throws {Error} 지원하지 않는 `strategy`가 전달된 경우.
     * @throws {Error} `path`가 전달되지 않은 경우.
     * @throws {{ status: number, statusText: string, body: string }} HTTP 에러.
     *
     * @example <caption>POST — 신규 배열 저장</caption>
     * const certs = DomainCollection.create(api);
     * certs.add({ certName: '정보처리기사' });
     * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
     *
     * @example <caption>PUT — 기존 배열 전체 교체</caption>
     * const certs = DomainCollection.fromJSONArray(jsonText, api);
     * certs.remove(0); // 첫 항목 제거
     * await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
     *
     * @example <caption>에러 처리</caption>
     * try {
     *     await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
     * } catch (err) {
     *     // err.status === 409: Conflict 등
     *     // 각 항목은 saveAll() 진입 이전 상태로 자동 복원됨
     *     console.error('배열 저장 실패:', err.status);
     * }
     */
    async saveAll({ strategy, path, urlConfig } = /** @type {SaveAllOptions} */ ({})) {
        // ── 사전 검증 ─────────────────────────────────────────────────────────
        if (!this._handler) {
            throw new Error(ERR.COLLECTION_HANDLER_MISSING);
        }
        if (!path) {
            throw new Error(ERR.COLLECTION_PATH_MISSING);
        }
        if (strategy !== 'batch') {
            throw new Error(ERR.COLLECTION_STRATEGY_UNSUPPORTED(strategy));
        }
        // ─────────────────────────────────────────────────────────────────────

        // ── 각 항목 스냅샷 캡처 (rollback 기준점) ────────────────────────────
        // saveAll()이 실패하면 각 항목을 이 스냅샷으로 복원한다.
        // 스냅샷은 각 DomainState.save()와 동일한 방식으로 구성한다.
        const isNewBefore = this._isNew;
        const snapshots = this._items.map((state) => ({
            data: structuredClone(state._getTarget()),
            changeLog: state._getChangeLog(),
            dirtyFields: state._getDirtyFields(),
            isNew: state._isNew,
        }));
        // ─────────────────────────────────────────────────────────────────────

        // ── URL 조합 ──────────────────────────────────────────────────────────
        const { buildURL, normalizeUrlConfig } = await import('../core/url-resolver.js');
        const resolvedConfig = urlConfig
            ? normalizeUrlConfig(urlConfig)
            : (this._urlConfig ?? this._handler.getUrlConfig());
        const url = buildURL(resolvedConfig, path);
        // ─────────────────────────────────────────────────────────────────────

        // ── 직렬화 ────────────────────────────────────────────────────────────
        const body = JSON.stringify(this.toJSON());
        // ─────────────────────────────────────────────────────────────────────

        // ── HTTP 메서드 결정 ──────────────────────────────────────────────────
        // _isNew: true  → POST (컬렉션이 서버에 아직 존재하지 않음)
        // _isNew: false → PUT  (서버의 배열 전체를 교체)
        const method = this._isNew ? 'POST' : 'PUT';
        // ─────────────────────────────────────────────────────────────────────

        try {
            await this._handler._fetch(url, { method, body });

            // ── 성공 처리 ─────────────────────────────────────────────────────
            this._isNew = false; // 최초 POST 성공 이후 PUT으로 전환

            for (const state of this._items) {
                state._clearChangeLog();
                state._clearDirtyFields();
                state._isNew = false; // 각 항목도 서버에 존재하게 됨
            }

            // lazy 모드: _initialSnapshot을 현재 상태로 갱신
            if (this._trackingMode === 'lazy') {
                this._initialSnapshot = structuredClone(this.toJSON());
            }
            // ─────────────────────────────────────────────────────────────────
        } catch (err) {
            // ── 실패 처리 — 각 항목 롤백 ─────────────────────────────────────
            this._isNew = isNewBefore;

            for (let i = 0; i < this._items.length; i++) {
                const state = this._items[i];
                const snap = snapshots[i];
                if (!snap) continue; // 방어: 스냅샷 수보다 항목이 많아진 경우

                state._restoreTarget(snap.data);
                state._restoreChangeLog(snap.changeLog);
                state._restoreDirtyFields(snap.dirtyFields);
                state._isNew = snap.isNew;
            }
            // ─────────────────────────────────────────────────────────────────

            // 호출자의 catch 블록이 처리할 수 있도록 re-throw
            throw err;
        }
    }
}
