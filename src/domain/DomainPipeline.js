/**
 * DomainPipeline — 병렬 fetch + 순차 후처리 체이닝
 *
 * `DomainState.all()`이 반환하는 파이프라인 객체.
 * 여러 `DomainState`를 병렬로 fetch하고,
 * `after()`로 등록된 핸들러를 등록 순서대로 순차 실행한다.
 *
 * ## 실행 모델
 *
 * ```
 * DomainState.all(resourceMap, options)
 *   ↓
 * DomainPipeline 인스턴스 생성
 *   ↓ .after('roles', handler1)
 *   ↓ .after('user',  handler2)
 *   ↓ .run()
 *      ├─ 1단계: Promise.allSettled()로 모든 리소스 병렬 fetch
 *      ├─ 2단계: after() 큐를 등록 순서대로 순차 await
 *      └─ 3단계: { ...DomainStates, _errors? } 반환
 * ```
 *
 * ## strict 옵션 동작
 *
 * | strict | fetch 실패 시            | after() 핸들러 실패 시   | 반환값                          |
 * |--------|------------------------|------------------------|--------------------------------|
 * | `false`| `_errors`에 기록, 계속  | `_errors`에 기록, 계속  | `resolve` + `_errors` 배열 포함 |
 * | `true` | 즉시 `reject`           | 즉시 `reject`           | `reject`                        |
 *
 * ## 설계 원칙 — strict 기본값 `false`
 * HTTP Request/Response는 이미 완료된 비용이다.
 * 독립적인 리소스의 fetch 실패가 전체 파이프라인을 중단시키는 것은 과잉 반응이다.
 * 실패 항목은 `_errors`에 기록하고 나머지를 계속 진행하는 것이 유지보수에 유리하다.
 *
 * ## 에러 처리 패턴
 *
 * ```js
 * const result = await DomainState.all({ ... }, { strict: false }).run();
 * if (result._errors?.length) {
 *     result._errors.forEach(({ key, error }) => console.warn(key, error));
 * }
 * ```
 *
 * @module domain/DomainPipeline
 * @see {@link module:domain/DomainState DomainState}
 * @see {@link https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled MDN — Promise.allSettled}
 */

import { ERR } from '../constants/error.messages.js';
import { LOG, formatMessage } from '../constants/log.messages.js';
import { broadcastError } from '../debug/debug-channel.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `DomainPipeline` 생성자의 `resourceMap` 파라미터.
 * 키는 리소스 식별자, 값은 `api.get()` 등이 반환하는 `Promise<DomainState>`.
 *
 * @typedef {Record<string, Promise<import('./DomainState.js').DomainState>>} ResourceMap
 */

/**
 * `DomainPipeline` 생성자의 `options` 파라미터.
 *
 * @typedef {object} PipelineOptions
 * @property {boolean} [strict=false]
 *   `true`이면 fetch 또는 `after()` 핸들러 실패 시 즉시 reject.
 *   `false`(기본값)이면 `_errors`에 기록하고 계속 진행.
 */

/**
 * `_queue` 배열에 저장되는 `after()` 핸들러 항목.
 *
 * @typedef {object} QueueEntry
 * @property {string}   key     - `resourceMap`의 키 이름
 * @property {AfterHandler} handler - 해당 `DomainState`를 인자로 받는 핸들러 함수
 */

/**
 * `after()` 메서드에 전달하는 핸들러 함수 타입.
 *
 * @callback AfterHandler
 * @param {import('./DomainState.js').DomainState} domainState - 해당 키의 `DomainState` 인스턴스
 * @returns {void | Promise<void>}
 */

/**
 * `_errors` 배열 및 `run()` 반환값의 `_errors` 프로퍼티에 포함되는 에러 항목.
 *
 * @typedef {object} PipelineError
 * @property {string} key   - 실패한 리소스 키 (`resourceMap`의 키)
 * @property {*}      error - throw된 에러 값 (fetch 실패 이유 또는 핸들러가 throw한 값)
 */

/**
 * `run()`의 반환값 타입.
 * 성공한 리소스의 `DomainState` 맵에 선택적으로 `_errors` 배열이 포함된다.
 *
 * @typedef {Record<string, import('./DomainState.js').DomainState> & { _errors?: PipelineError[] }} PipelineResult
 */

// ════════════════════════════════════════════════════════════════════════════════
// DomainPipeline 클래스
// ════════════════════════════════════════════════════════════════════════════════

export class DomainPipeline {
    /**
     * `DomainPipeline` 인스턴스를 생성한다.
     *
     * **직접 호출 금지.** `DomainState.all(resourceMap, options)`을 사용한다.
     * `DomainState.all()`은 내부적으로 `DomainState.PipelineConstructor`를 통해
     * 이 생성자를 호출한다.
     *
     * @param {ResourceMap}     resourceMap - 키: 리소스 식별자, 값: `Promise<DomainState>`
     * @param {PipelineOptions} [options]   - 파이프라인 실행 옵션
     *
     * @example <caption>직접 사용하지 말 것 — DomainState.all() 사용</caption>
     * // ❌ 직접 생성 금지
     * // new DomainPipeline({ ... });
     *
     * // ✅ DomainState.all()을 통해 사용
     * const result = await DomainState.all({ roles: api.get('/api/roles') }, { strict: false })
     *     .after('roles', async roles => { ... })
     *     .run();
     */
    constructor(resourceMap, { strict = false } = {}) {
        /**
         * 병렬 fetch 대상 리소스 맵.
         * 키: 리소스 식별자, 값: `Promise<DomainState>`.
         * `run()` 실행 시 `Promise.allSettled()`에 전달된다.
         *
         * @type {ResourceMap}
         */
        this._resourceMap = resourceMap;

        /**
         * strict 모드 플래그.
         * `true`이면 첫 실패에서 즉시 `reject`, `false`이면 `_errors`에 기록 후 계속.
         *
         * @type {boolean}
         */
        this._strict = strict;

        /**
         * `after()` 핸들러 큐. 등록 순서가 곧 실행 순서다.
         * `run()` 2단계에서 이 배열을 순서대로 순차 `await`한다.
         *
         * @type {QueueEntry[]}
         */
        this._queue = [];
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 체이닝 API
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 특정 리소스에 대한 후처리 핸들러를 큐에 등록한다.
     *
     * 등록 순서가 `run()` 에서의 실행 순서가 된다.
     * `run()`이 호출될 때까지 핸들러는 실행되지 않는다.
     *
     * fetch가 성공한 리소스만 핸들러가 실행된다.
     * fetch가 실패한 리소스의 핸들러는 `run()` 2단계에서 자동으로 건너뛰며
     * `_errors`에 스킵 이유가 기록된다.
     *
     * @param {string}       key     - `resourceMap`의 키 이름. 존재하지 않는 키면 즉시 `Error` throw.
     * @param {AfterHandler} handler - 해당 `DomainState`를 인자로 받는 핸들러 함수.
     *   async 함수 또는 일반 함수 모두 지원.
     * @returns {DomainPipeline} 체이닝을 위한 `this` 반환
     * @throws {Error}     `key`가 `resourceMap`에 없는 경우
     * @throws {TypeError} `handler`가 함수가 아닌 경우
     *
     * @example <caption>기본 사용</caption>
     * DomainState.all({
     *     roles: api.get('/api/roles'),
     *     user:  api.get('/api/users/1'),
     * })
     * .after('roles', async roles => {
     *     roles.renderTo('#roleDiv', { type: 'select', valueField: 'roleId', labelField: 'roleName' });
     * })
     * .after('user', async user => {
     *     user.bindForm('#userForm');
     * })
     * .run();
     *
     * @example <caption>존재하지 않는 키 — 즉시 Error throw</caption>
     * pipeline.after('nonExistent', handler);
     * // → Error: [DSM] Pipeline: 'nonExistent' 키가 resourceMap에 없습니다.
     */
    after(key, handler) {
        if (!(key in this._resourceMap)) throw new Error(ERR.PIPELINE_INVALID_KEY(key));
        if (typeof handler !== 'function') throw new TypeError(ERR.PIPELINE_HANDLER_TYPE(key));
        this._queue.push({ key, handler });
        return this;
    }

    /**
     * 등록된 fetch Promise와 `after()` 핸들러를 순서대로 실행한다.
     *
     * ## 실행 흐름
     *
     * ### 1단계 — 병렬 fetch
     * `Promise.allSettled()`로 모든 리소스를 병렬로 fetch한다.
     * `allSettled`를 사용하므로 일부 실패가 나머지 fetch를 중단시키지 않는다.
     * - 성공(`fulfilled`): `resolved[key]`에 `DomainState` 저장
     * - 실패(`rejected`):
     *   - `strict: false` → `errors`에 `{ key, error: reason }` 기록 후 계속
     *   - `strict: true`  → `reason`을 즉시 `throw`
     *   - 디버그 채널에 `broadcastError(key, reason)` 전송
     *
     * ### 2단계 — after() 핸들러 순차 실행
     * `_queue`를 등록 순서대로 순회하며 각 핸들러를 `await`한다.
     * - fetch 실패로 `resolved[key]`가 없는 경우: 스킵 이유를 `errors`에 기록하고 `continue`
     * - 핸들러 성공: 정상 진행
     * - 핸들러 실패:
     *   - `strict: false` → `errors`에 기록 후 다음 핸들러 계속
     *   - `strict: true`  → 즉시 `throw`
     *   - 디버그 채널에 `broadcastError(key, err)` 전송
     *
     * ### 3단계 — 결과 반환
     * `errors`가 있으면 `output._errors`에 포함하여 반환한다.
     *
     * @returns {Promise<PipelineResult>}
     *   성공한 리소스의 `DomainState` 맵. 실패 항목이 있으면 `_errors` 포함.
     * @throws {*} `strict: true`이고 fetch 또는 핸들러가 실패한 경우 에러를 즉시 throw
     *
     * @example <caption>strict: false (기본) — 부분 실패 허용</caption>
     * const result = await DomainState.all({
     *     roles: api.get('/api/roles'),
     *     user:  api.get('/api/users/INVALID'), // 404 예상
     * }, { strict: false })
     * .after('roles', async roles => { roles.renderTo('#roleDiv', { ... }); })
     * .run();
     *
     * // result.roles  → DomainState (성공)
     * // result.user   → undefined (fetch 실패)
     * // result._errors → [{ key: 'user', error: { status: 404, ... } }]
     * result._errors?.forEach(({ key, error }) => console.warn(key, error));
     *
     * @example <caption>strict: true — 첫 실패에서 중단</caption>
     * try {
     *     const result = await DomainState.all({ ... }, { strict: true })
     *         .after('roles', async roles => { ... })
     *         .run();
     * } catch (err) {
     *     console.error('Pipeline 중단:', err);
     * }
     *
     * @example <caption>run() 후 결과 활용</caption>
     * const { roles, user } = await DomainState.all({ roles: ..., user: ... }).run();
     * user.data.name = 'Davi';
     * await user.save('/api/users/1');
     */
    async run() {
        const keys = Object.keys(this._resourceMap);
        /** @type {PipelineError[]} */
        const errors = [];

        // ── 1단계: 병렬 fetch ─────────────────────────────────────────────────
        console.debug(formatMessage(LOG.pipeline.fetchStart, { keys: keys.join(', ') }));

        const settled = await Promise.allSettled(keys.map((k) => this._resourceMap[k]));

        /** @type {Record<string, import('./DomainState.js').DomainState>} */
        const resolved = {};

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const result = settled[i];

            if (result.status === 'fulfilled') {
                resolved[key] = result.value;
            } else {
                errors.push({ key, error: result.reason });
                if (this._strict) throw result.reason;
                broadcastError(key, result.reason);
                console.error(`[DSM][Pipeline] fetch 실패 | key: ${key}`, result.reason);
            }
        }

        console.debug(LOG.pipeline.fetchDone);

        // ── 2단계: after() 핸들러 순차 실행 ──────────────────────────────────
        for (const { key, handler } of this._queue) {
            const state = resolved[key];

            if (!state) {
                // fetch 단계에서 실패한 리소스의 핸들러는 자동으로 건너뜀
                errors.push({
                    key,
                    error: new Error(`fetch 실패로 인해 "${key}" 핸들러를 건너뜁니다.`),
                });
                continue;
            }

            console.debug(formatMessage(LOG.pipeline.afterStart, { key }));
            try {
                await handler(state);
                console.debug(formatMessage(LOG.pipeline.afterDone, { key }));
            } catch (err) {
                errors.push({ key, error: err });
                broadcastError(key, err);
                console.error(
                    formatMessage(LOG.pipeline.afterError, { key, error: String(err) }),
                    err
                );
                if (this._strict) throw err;
            }
        }

        // ── 3단계: 결과 반환 ──────────────────────────────────────────────────
        /** @type {PipelineResult} */
        const output = { ...resolved };
        if (errors.length > 0) output._errors = errors;
        return output;
    }
}
