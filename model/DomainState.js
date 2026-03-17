/**
 * @fileoverview DomainState — REST API 연동 도메인 상태 관리자
 *
 * 한 REST 리소스(또는 애그리거트 루트) 단위로 인스턴스 하나.
 * DomainState 인스턴스 = 현재 상태(Proxy) + 변경 로그 + 동기화 단위
 *
 * ── 생성 경로 ────────────────────────────────────────────────────────────────
 *   fromJSON(text, handler, opts?)    GET 응답 → DomainState (isNew: false)
 *   fromForm(form, handler, opts?)    Form 요소 → 빈 골격 DomainState (isNew: true)
 *   fromVO(vo, handler, opts?)        DomainVO → 기본값 골격 DomainState (isNew: true)
 *
 * ── 외부 인터페이스 ──────────────────────────────────────────────────────────
 *   .data           Proxy 객체 (변경 추적 진입점)
 *   .save(path?)    POST / PATCH / PUT 자동 분기
 *   .remove(path?)  DELETE
 *   .log()          changeLog 콘솔 출력 (debug: true일 때만)
 *   .openDebugger() 디버그 팝업 열기 (debug: true일 때만)
 *
 * ── 플러그인 시스템 ───────────────────────────────────────────────────────────
 *   DomainState.use(plugin)  install(DomainState) 계약을 가진 플러그인 등록
 *
 * @module model/DomainState
 */

import { toDomain, toPayload, toPatch }          from '../src/core/api-mapper.js';
import { createProxy }                           from '../src/core/api-proxy.js';
import { normalizeUrlConfig, buildURL }          from '../src/core/url-resolver.js';
import { ERR }                                   from '../src/constants/error.messages.js';
import { broadcastUpdate, openDebugPopup }       from '../src/debug/debug-channel.js';
import { DomainVO }                              from './DomainVO.js';


export class DomainState {

    // ── 플러그인 레지스트리 (클래스 레벨 싱글톤) ────────────────────────────
    /** @type {Set<object>} */
    static #installedPlugins = new Set();

    /**
     * 플러그인을 등록한다. install(DomainState) 메서드가 필수다.
     * 중복 등록은 무시된다. use() 자체를 체이닝할 수 있다.
     *
     * @param {object} plugin - { install(DomainState): void } 계약
     * @returns {typeof DomainState}  체이닝용 DomainState 클래스 반환
     * @throws {TypeError}
     *
     * @example
     * DomainState.use(DomainRenderer).use(AnotherPlugin);
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

    /**
     * 여러 DomainState를 병렬로 fetch하고 순서 있는 후처리를 체이닝한다.
     * DomainPipeline을 반환한다.
     *
     * @param {Record<string, Promise<DomainState>>} resourceMap
     * @param {{ strict?: boolean }} [options]
     * @returns {import('./DomainPipeline.js').DomainPipeline}
     *
     * @example
     * const result = await DomainState.all({
     *   roles: api.get('/api/roles'),
     *   user:  api.get('/api/users/1'),
     * }, { strict: false })
     * .after('roles', roles => roles.renderTo('#roleDiv', { type: 'select', ... }))
     * .after('user',  user  => user.bindForm('#userForm'))
     * .run();
     */
    static all(resourceMap, options = {}) {
        // 순환 참조 방지를 위해 DomainPipeline을 동적 import 대신 lazy require
        const { DomainPipeline } = _requirePipeline();
        return new DomainPipeline(resourceMap, options);
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 생성자 (직접 호출 금지 — 팩토리 메서드 사용)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @param {{ proxy, getChangeLog, getTarget, clearChangeLog }} proxyWrapper
     * @param {object} options
     * @param {object|null}  options.handler      ApiHandler 인스턴스
     * @param {object|null}  options.urlConfig     정규화된 URL 설정
     * @param {boolean}      options.isNew         true → POST / false → PUT·PATCH
     * @param {boolean}      options.debug         true → log() / openDebugger() 활성화
     * @param {string}       options.label         디버그 팝업에 표시될 식별 레이블
     * @param {object}       options.validators    { 필드: (v) => boolean }
     * @param {object}       options.transformers  { 필드: (v) => v }
     */
    constructor(proxyWrapper, options = {}) {
        // ── 도개교 세트 ──────────────────────────────────────────────────────
        this._proxy          = proxyWrapper.proxy;
        this._getChangeLog   = proxyWrapper.getChangeLog;
        this._getTarget      = proxyWrapper.getTarget;
        this._clearChangeLog = proxyWrapper.clearChangeLog;

        // ── 메타데이터 ───────────────────────────────────────────────────────
        this._handler      = options.handler      ?? null;
        this._urlConfig    = options.urlConfig     ?? null;
        this._isNew        = options.isNew         ?? false;
        this._debug        = options.debug         ?? false;
        this._label        = options.label         ?? `ds_${Date.now()}`;
        this._validators   = options.validators    ?? {};
        this._transformers = options.transformers  ?? {};
        this._errors       = [];

        // 생성 직후 디버그 채널에 초기 상태 broadcast
        if (this._debug) this._broadcast();
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 팩토리 메서드
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * [팩토리 1] REST API 응답 JSON 문자열로부터 DomainState를 생성한다.
     * api-handler.js의 get() 내부에서 호출한다.
     *
     * options.vo    → DomainVO 정합성 검증 후 validators/transformers 주입 (4-1)
     * options.form  → 로드된 데이터를 form 요소에 자동 채움 (4-2)
     * 둘 다         → 정합성 검증 → form 채움 (4-3)
     *
     * @param {string}          jsonText
     * @param {object}          handler      ApiHandler 인스턴스
     * @param {object}          [options]
     * @param {object|null}     [options.urlConfig]
     * @param {boolean}         [options.debug]
     * @param {string}          [options.label]
     * @param {DomainVO|null}   [options.vo]   DomainVO 인스턴스 (정합성 검증용)
     * @param {string|HTMLFormElement|null} [options.form]  form 요소 또는 id
     * @returns {DomainState}
     */
    static fromJSON(jsonText, handler, {
        urlConfig   = null,
        debug       = false,
        label       = null,
        vo          = null,
        form        = null,
    } = {}) {
        const wrapper = toDomain(jsonText);
        const state   = new DomainState(wrapper, {
            handler,
            urlConfig,
            isNew:  false,
            debug,
            label:  label ?? `json_${Date.now()}`,
        });

        // 4-1: DomainVO 정합성 검증
        if (vo instanceof DomainVO) {
            const { valid } = vo.checkSchema(wrapper.getTarget());
            if (valid) {
                state._validators   = vo.getValidators();
                state._transformers = vo.getTransformers();
            }
        }

        // 4-2: form에 데이터 채움
        if (form) {
            const formEl = _resolveForm(form);
            if (formEl) _syncToForm(formEl, wrapper.getTarget());
        }

        return state;
    }

    /**
     * [팩토리 2] HTML Form 요소 또는 form id 문자열로부터 DomainState를 생성한다.
     * form[name] 속성의 점(dot) 표기 중첩 구조를 읽어 빈 골격 Proxy를 만든다.
     * form 요소에 이벤트 리스너를 자동으로 등록하여 실시간 변경을 추적한다.
     *
     * @param {string|HTMLFormElement} form   form id 문자열 또는 DOM 요소
     * @param {object}  handler
     * @param {object}  [options]
     * @param {object|null}  [options.urlConfig]
     * @param {boolean}      [options.debug]
     * @param {string}       [options.label]
     * @returns {DomainState}
     * @throws {TypeError|Error}
     */
    static fromForm(form, handler, {
        urlConfig = null,
        debug     = false,
        label     = null,
    } = {}) {
        const formEl = _resolveForm(form);
        if (!formEl) {
            if (typeof form === 'string') throw new Error(ERR.FORM_NOT_FOUND(form));
            throw new TypeError(ERR.FROM_FORM_TYPE);
        }

        const skeleton = _formToSkeleton(formEl);
        const wrapper  = createProxy(skeleton);
        const state    = new DomainState(wrapper, {
            handler,
            urlConfig,
            isNew: true,
            debug,
            label: label ?? (formEl.id ? `form_${formEl.id}` : `form_${Date.now()}`),
        });

        // 6번: form 요소 이벤트 리스너 등록
        _bindFormEvents(formEl, wrapper.proxy, () => state._broadcast());

        return state;
    }

    /**
     * [팩토리 3] DomainVO 인스턴스로부터 DomainState를 생성한다.
     * VO의 static fields를 기반으로 기본값 골격을 생성하고,
     * validators / transformers를 주입한다.
     *
     * @param {DomainVO} vo
     * @param {object}   handler
     * @param {object}   [options]
     * @param {object|null}  [options.urlConfig]  미입력 시 vo.getBaseURL() 폴백
     * @param {boolean}      [options.debug]
     * @param {string}       [options.label]
     * @returns {DomainState}
     * @throws {TypeError}
     */
    static fromVO(vo, handler, {
        urlConfig = null,
        debug     = false,
        label     = null,
    } = {}) {
        if (!(vo instanceof DomainVO)) throw new TypeError(ERR.FROM_VO_TYPE);

        // urlConfig 미입력 시 DomainVO의 static baseURL 폴백
        const resolvedUrlConfig = urlConfig
            ?? (vo.getBaseURL() ? normalizeUrlConfig({ baseURL: vo.getBaseURL(), debug }) : null);

        const wrapper  = createProxy(vo.toSkeleton());
        return new DomainState(wrapper, {
            handler,
            urlConfig:    resolvedUrlConfig,
            isNew:        true,
            debug,
            label:        label ?? vo.constructor.name,
            validators:   vo.getValidators(),
            transformers: vo.getTransformers(),
        });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 외부 인터페이스
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * 변경 추적이 활성화된 Proxy 객체.
     * 외부 개발자가 도메인 데이터에 접근하는 유일한 공개 진입점.
     *
     * @type {object}
     */
    get data() {
        return this._proxy;
    }

    /**
     * 도메인 상태를 서버(DB)와 동기화한다.
     *
     * 분기 전략 (A+C 혼합):
     *   isNew === true               → POST  (toPayload)
     *   isNew === false
     *     changeLog.length > 0      → PATCH (toPatch, RFC 6902)
     *     changeLog.length === 0    → PUT   (toPayload)
     *
     * 전송 성공 시 clearChangeLog() 호출.
     * POST 성공 시 isNew → false 전환.
     *
     * @param {string} [requestPath] - 엔드포인트 경로. urlConfig와 조합됨.
     * @returns {Promise<void>}
     * @throws {Error}  handler 미주입 또는 URL 미확정
     * @throws {{ status: number, statusText: string, body: string }} HTTP 에러
     */
    async save(requestPath) {
        this._assertHandler('save');
        const url = this._resolveURL(requestPath);

        if (this._isNew) {
            await this._handler._fetch(url, { method: 'POST', body: toPayload(this._getTarget) });
            this._isNew = false;
        } else {
            const log = this._getChangeLog();
            if (log.length > 0) {
                await this._handler._fetch(url, {
                    method: 'PATCH',
                    body:   JSON.stringify(toPatch(this._getChangeLog)),
                });
            } else {
                await this._handler._fetch(url, { method: 'PUT', body: toPayload(this._getTarget) });
            }
        }

        this._clearChangeLog();
        if (this._debug) this._broadcast();
    }

    /**
     * 해당 리소스를 서버에서 삭제한다. (DELETE)
     *
     * @param {string} [requestPath]
     * @returns {Promise<void>}
     */
    async remove(requestPath) {
        this._assertHandler('remove');
        const url = this._resolveURL(requestPath);
        await this._handler._fetch(url, { method: 'DELETE' });
    }

    /**
     * 현재 changeLog를 콘솔에 출력한다.
     * debug: false이면 아무 동작도 하지 않는다.
     */
    log() {
        if (!this._debug) return;
        const log = this._getChangeLog();
        console.group(`[DSM][${this._label}] changeLog`);
        log.length ? console.table(log) : console.log('(변경 이력 없음)');
        console.groupEnd();
    }

    /**
     * 디버그 팝업을 열거나 포커스한다.
     * debug: false이면 아무 동작도 하지 않는다.
     */
    openDebugger() {
        if (this._debug) openDebugPopup();
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 내부 유틸
    // ══════════════════════════════════════════════════════════════════════════

    /** @param {string} method */
    _assertHandler(method) {
        if (!this._handler) throw new Error(ERR.HANDLER_MISSING(method));
    }

    /**
     * urlConfig와 requestPath를 조합해 최종 URL을 반환한다.
     * @param {string|undefined} requestPath
     * @returns {string}
     */
    _resolveURL(requestPath) {
        const config = this._urlConfig ?? this._handler?.getUrlConfig() ?? {};
        return buildURL(config, requestPath ?? '');
    }

    /** 현재 상태를 디버그 채널에 broadcast한다. */
    _broadcast() {
        broadcastUpdate(this._label, {
            data:      this._getTarget(),
            changeLog: this._getChangeLog(),
            isNew:     this._isNew,
            errors:    this._errors,
        });
    }
}


// ══════════════════════════════════════════════════════════════════════════════
// 모듈 내부 유틸 함수
// ══════════════════════════════════════════════════════════════════════════════

/**
 * form id 문자열 또는 HTMLFormElement를 받아 HTMLFormElement를 반환한다.
 * 찾을 수 없으면 null을 반환한다.
 *
 * @param {string|HTMLFormElement|*} form
 * @returns {HTMLFormElement|null}
 */
function _resolveForm(form) {
    if (form instanceof HTMLFormElement)    return form;
    if (typeof form === 'string')           return document.getElementById(form);
    return null;
}

/**
 * HTMLFormElement를 읽어 빈 골격 객체를 생성한다.
 * input[name]의 점(dot) 표기를 중첩 객체로 변환한다.
 *
 * @param {HTMLFormElement} formEl
 * @returns {object}
 *
 * @example
 * // <input name="address.city" /> → { address: { city: '' } }
 */
function _formToSkeleton(formEl) {
    const skeleton = {};
    for (const el of formEl.elements) {
        if (!el.name) continue;
        _setNestedValue(skeleton, el.name.split('.'), '');
    }
    return skeleton;
}

/**
 * 점(dot) 분해된 키 배열로 중첩 객체에 값을 설정한다.
 *
 * @param {object}   target
 * @param {string[]} keys
 * @param {*}        value
 */
function _setNestedValue(target, keys, value) {
    let cursor = target;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cursor[keys[i]] == null || typeof cursor[keys[i]] !== 'object') {
            cursor[keys[i]] = {};
        }
        cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
}

/**
 * DomainState 데이터를 form 요소의 value로 채운다. (4-2 syncForm)
 *
 * @param {HTMLFormElement} formEl
 * @param {object}          data
 */
function _syncToForm(formEl, data) {
    for (const el of formEl.elements) {
        if (!el.name) continue;
        const val = el.name.split('.').reduce((obj, k) => obj?.[k], data);
        if (val == null) continue;

        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = el.value === String(val);
        } else {
            el.value = val;
        }
    }
}

/**
 * form 요소에 변경 이벤트 리스너를 등록한다. (6번)
 *
 * 추적 전략:
 *   input[type='text'], textarea → blur 시 proxy 업데이트
 *   select, radio, checkbox      → change 시 proxy 업데이트 (선택 즉시 확정)
 *
 * @param {HTMLFormElement} formEl
 * @param {object}          proxy  - createProxy()의 반환 proxy
 */
function _bindFormEvents(formEl, proxy, onUpdate) {
    const textLike = new Set(['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'textarea']);

    for (const el of formEl.elements) {
        if (!el.name) continue;
        const keys  = el.name.split('.');
        const event = textLike.has(el.type || el.tagName.toLowerCase()) ? 'blur' : 'change';

        el.addEventListener(event, () => {
            const value = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
            // 중첩 경로 proxy 탐색 후 최종 키에 값 설정
            let cursor = proxy;
            for (let i = 0; i < keys.length - 1; i++) cursor = cursor[keys[i]];
            cursor[keys[keys.length - 1]] = value;
            // proxy 업데이트 후 broadcast 호출
            onUpdate();
        });
    }
}

/**
 * DomainPipeline을 순환 참조 없이 lazy load한다.
 * (DomainState ↔ DomainPipeline 상호 import 방지)
 *
 * @returns {{ DomainPipeline: typeof import('./DomainPipeline.js').DomainPipeline }}
 */
let _pipelineCache = null;
function _requirePipeline() {
    if (!_pipelineCache) {
        // ES Module 환경에서는 정적 import를 사용하지만,
        // 순환 참조를 끊기 위해 전역 등록 방식을 사용한다.
        // DomainPipeline.js가 로드되면 전역에 등록되어 있어야 한다.
        if (typeof globalThis.__DSM_DomainPipeline === 'undefined') {
            throw new Error('[DSM] DomainPipeline을 먼저 import해야 합니다. rest-domain-state-manager.js를 사용하세요.');
        }
        _pipelineCache = { DomainPipeline: globalThis.__DSM_DomainPipeline };
    }
    return _pipelineCache;
}
