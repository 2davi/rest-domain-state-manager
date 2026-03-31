/**
 * DSM Serialize Worker
 *
 * 메인 스레드의 `_stateRegistry` 직렬화 및 BroadcastChannel 발화를 오프로딩 처리한다.
 *
 * ## 책임
 * `REGISTER_TAB` 메시지를 수신하여 JSON.parse 후 BroadcastChannel에 `TAB_REGISTER`를 발화한다.
 *
 * ## 수신 메시지 구조
 * ```
 * {
 *   type:    'REGISTER_TAB',
 *   tabId:   string,
 *   tabUrl:  string,
 *   payload: string   // JSON.stringify(Object.fromEntries(_stateRegistry))
 * }
 * ```
 *
 * ## postMessage 전송 비용 최소화 전략
 * 메인 스레드에서 `JSON.stringify()` 후 문자열로 전달한다.
 * `postMessage`의 `structuredClone`이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
 * Worker는 수신 후 `JSON.parse()`로 역직렬화하여 채널에 발화한다.
 *
 * ## BroadcastChannel 호환성
 * BroadcastChannel API는 Web Worker 컨텍스트에서 직접 인스턴스화 가능하다.
 * MDN 공식 명세에서 확인됨.
 *
 * @module workers/serializer.worker
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel MDN — BroadcastChannel}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Worker MDN — Worker}
 */

import { DEBUG_CHANNEL_NAME } from '../constants/channel.const.js';

// ── Worker 내부 BroadcastChannel 싱글톤 ──────────────────────────────────────

/**
 * Worker 내부 BroadcastChannel 싱글톤.
 * `getWorkerChannel()` 최초 호출 시 Lazy하게 생성된다.
 *
 * @type {BroadcastChannel | null}
 */
let _workerChannel = null;

/**
 * Worker 내부 BroadcastChannel 싱글톤을 반환한다.
 *
 * BroadcastChannel 미지원 환경에서는 `null`을 반환하여 조용히 비활성화한다.
 *
 * @returns {BroadcastChannel | null}
 */
function getWorkerChannel() {
    if (_workerChannel) return _workerChannel;
    if (typeof BroadcastChannel === 'undefined') return null;
    _workerChannel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
    return _workerChannel;
}

// ── 메시지 핸들러 ─────────────────────────────────────────────────────────────

/**
 * 메인 스레드에서 전달된 메시지를 처리한다.
 *
 * ## 처리 흐름 (REGISTER_TAB)
 * 1. `payload` 문자열을 `JSON.parse()`로 역직렬화한다.
 * 2. 파싱 실패 시 빈 객체로 폴백하여 Silent Failure를 방지한다.
 * 3. BroadcastChannel에 `TAB_REGISTER` 메시지를 발화한다.
 *
 * 알 수 없는 `type`의 메시지는 조용히 무시한다.
 *
 * @param {MessageEvent<{
 *   type:    string,
 *   tabId:   string,
 *   tabUrl:  string,
 *   payload: string
 * }>} event - 메인 스레드에서 전달된 MessageEvent
 */
self.onmessage = function (event) {
    const { type, tabId, tabUrl, payload } = event.data ?? {};

    if (type === 'REGISTER_TAB') {
        /** @type {Record<string, unknown>} */
        let states;
        try {
            states = JSON.parse(payload);
        } catch {
            // JSON 파싱 실패 — 빈 객체로 폴백. 에러를 전파하지 않는다.
            // 메인 스레드에 에러가 역전파되면 디버그 채널 전체가 중단될 수 있다.
            states = {};
        }

        getWorkerChannel()?.postMessage({
            type: 'TAB_REGISTER',
            tabId,
            tabUrl,
            states,
        });
    }
    // 알 수 없는 타입은 조용히 무시한다.
};
