/**
 * @fileoverview DomainPipeline — 병렬 fetch + 순차 후처리 체이닝
 *
 * DomainState.all()이 반환하는 객체.
 * 여러 DomainState를 병렬로 fetch하고, after()로 등록된 핸들러를
 * 등록 순서대로 순차 실행한다.
 *
 * 실행 모델:
 *   1단계: Promise.all()로 모든 리소스 병렬 fetch
 *   2단계: after() 핸들러를 등록 순서대로 순차 실행 (await)
 *   3단계: { ...DomainStates, _errors? } 반환
 *
 * 에러 처리 (strict 옵션):
 *   strict: false (기본값) — 핸들러 실패 시 _errors에 기록하고 계속 진행
 *   strict: true           — 첫 실패에서 즉시 reject
 *
 * @module model/DomainPipeline
 *
 * @example
 * const result = await DomainState.all({
 *   roles: api.get('/api/roles'),
 *   user:  api.get('/api/users/1'),
 * }, { strict: false })
 * .after('roles', async roles => {
 *   await roles.renderTo('#roleDiv', { type: 'select', valueField: 'roleId', labelField: 'roleName' });
 * })
 * .after('user', async user => {
 *   user.bindForm('#userForm');
 * })
 * .run();
 *
 * result.user.data.name = 'Davi';
 * await result.user.save('/api/users/1');
 */

import { ERR }              from '../src/constants/error.messages.js';
import { LOG, formatMessage } from '../src/constants/log.messages.js';
import { broadcastError }   from '../src/debug/debug-channel.js';


export class DomainPipeline {

    /**
     * @param {Record<string, Promise<import('./DomainState.js').DomainState>>} resourceMap
     *   키: 리소스 식별자, 값: api.get() 등이 반환하는 Promise<DomainState>
     * @param {{ strict?: boolean }} [options]
     */
    constructor(resourceMap, { strict = false } = {}) {
        /** @type {Record<string, Promise<*>>} */
        this._resourceMap = resourceMap;

        /** @type {boolean} */
        this._strict = strict;

        /**
         * after() 핸들러 큐 — 등록 순서가 곧 실행 순서
         * @type {Array<{ key: string, handler: function }>}
         */
        this._queue = [];
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 체이닝 API
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * 특정 리소스에 대한 후처리 핸들러를 등록한다.
     * 등록 순서가 실행 순서가 된다. run()이 호출될 때까지 실행되지 않는다.
     *
     * @param {string}   key     - resourceMap의 키 이름
     * @param {function} handler - async (domainState) => void
     * @returns {DomainPipeline} 체이닝용 this 반환
     * @throws {Error}      key가 resourceMap에 없을 때
     * @throws {TypeError}  handler가 함수가 아닐 때
     *
     * @example
     * .after('roles', async roles => {
     *   roles.renderTo('#div', { type: 'select', valueField: 'id', labelField: 'name' });
     * })
     */
    after(key, handler) {
        if (!(key in this._resourceMap)) throw new Error(ERR.PIPELINE_INVALID_KEY(key));
        if (typeof handler !== 'function') throw new TypeError(ERR.PIPELINE_HANDLER_TYPE(key));
        this._queue.push({ key, handler });
        return this;
    }

    /**
     * 등록된 fetch와 핸들러를 실행한다.
     *
     * 실행 흐름:
     *   1. Promise.all()로 모든 리소스 병렬 fetch
     *   2. after() 큐를 등록 순서대로 순차 await
     *   3. 완성된 결과 맵 반환
     *
     * @returns {Promise<Record<string, import('./DomainState.js').DomainState> & { _errors?: Array<{key: string, error: *}> }>}
     */
    async run() {
        const keys    = Object.keys(this._resourceMap);
        const errors  = [];

        // ── 1단계: 병렬 fetch ────────────────────────────────────────────────
        console.debug(formatMessage(LOG.pipeline.fetchStart, { keys: keys.join(', ') }));

        const settled = await Promise.allSettled(
            keys.map(k => this._resourceMap[k])
        );

        const resolved = {};
        for (let i = 0; i < keys.length; i++) {
            const key    = keys[i];
            const result = settled[i];
            if (result.status === 'fulfilled') {
                resolved[key] = result.value;
            } else {
                errors.push({ key, error: result.reason });
                if (this._strict) {
                    throw result.reason;
                }
                broadcastError(key, result.reason);
                console.error(`[DSM][Pipeline] fetch 실패 | key: ${key}`, result.reason);
            }
        }

        console.debug(LOG.pipeline.fetchDone);

        // ── 2단계: after 핸들러 순차 실행 ────────────────────────────────────
        for (const { key, handler } of this._queue) {
            const state = resolved[key];
            if (!state) {
                // fetch 단계에서 실패한 리소스의 핸들러는 건너뜀
                errors.push({ key, error: new Error(`fetch 실패로 "${key}" 핸들러를 건너뜁니다.`) });
                continue;
            }

            console.debug(formatMessage(LOG.pipeline.afterStart, { key }));
            try {
                await handler(state);
                console.debug(formatMessage(LOG.pipeline.afterDone, { key }));
            } catch (err) {
                errors.push({ key, error: err });
                broadcastError(key, err);
                console.error(formatMessage(LOG.pipeline.afterError, { key, error: String(err) }), err);
                if (this._strict) throw err;
            }
        }

        // ── 3단계: 결과 반환 ──────────────────────────────────────────────────
        const output = { ...resolved };
        if (errors.length > 0) output._errors = errors;
        return output;
    }
}

