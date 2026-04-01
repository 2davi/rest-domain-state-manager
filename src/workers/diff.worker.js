/**
 * DSM Diff Worker — lazy tracking mode 전용
 *
 * `DomainState`의 `lazy` tracking mode에서 `save()` 호출 시,
 * 메인 스레드의 diff 연산을 오프로딩하여 UI 블로킹을 방지한다.
 *
 * ## 책임
 * `DIFF` 메시지를 수신하여 `deepDiff(initial, current, itemKey?)` 연산을 수행하고
 * `DIFF_RESULT` 메시지로 changeLog 배열을 응답한다.
 *
 * ## 수신 메시지 구조
 * ```
 * {
 *   type:    'DIFF',
 *   id:      string,    // 요청 식별자 (응답 매칭용)
 *   payload: string,    // JSON.stringify({ initial, current })
 *   itemKey: string?    // 배열 항목 동일성 기준 필드명 (없으면 positional)
 * }
 * ```
 *
 * ## 응답 메시지 구조
 * ```
 * {
 *   type:      'DIFF_RESULT',
 *   id:        string,              // 요청과 동일한 식별자
 *   changeLog: ChangeLogEntry[],    // RFC 6902 형식 변경 이력
 *   error?:    string               // 에러 발생 시 메시지
 * }
 * ```
 *
 * ## postMessage 전송 비용 최소화 전략
 * 메인 스레드에서 `JSON.stringify({ initial, current })`로 문자열화 후 전달한다.
 * `postMessage`의 structuredClone이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
 * (`serializer_worker.js`에서 이미 검증된 패턴)
 * Worker는 수신 후 `JSON.parse()`로 역직렬화하여 deepDiff를 수행한다.
 *
 * ## BroadcastChannel 미사용
 * 이 Worker는 순수 diff 연산만 담당한다.
 * `serializer_worker.js`(디버그 채널 브로드캐스팅 전용)와 역할이 완전히 분리된다.
 *
 * @module workers/diff.worker
 * @see {@link module:common/lcs-diff deepDiff}
 * @see {@link module:workers/diff-worker-client requestDiff}
 */

import { deepDiff } from '../common/lcs-diff.js';

// ── 메시지 핸들러 ─────────────────────────────────────────────────────────────

/**
 * 메인 스레드에서 전달된 메시지를 처리한다.
 *
 * ## 처리 흐름 (DIFF)
 * 1. `payload` 문자열을 `JSON.parse()`로 역직렬화한다.
 * 2. `deepDiff(initial, current, itemKey?)`를 호출한다.
 * 3. 성공: `DIFF_RESULT` + changeLog를 응답한다.
 * 4. 실패: `DIFF_RESULT` + error 메시지를 응답한다.
 *
 * 알 수 없는 `type`의 메시지는 조용히 무시한다.
 * 에러가 메인 스레드로 역전파되면 diff-worker-client의 pending 항목이 영원히 대기하므로,
 * 반드시 `error` 필드로 응답하여 정상 해제되도록 한다.
 *
 * @param {MessageEvent<{
 *   type:    string,
 *   id:      string,
 *   payload: string,
 *   itemKey: string | undefined
 * }>} event - 메인 스레드에서 전달된 MessageEvent
 */
self.onmessage = function (event) {
    const { type, id, payload, itemKey } = event.data ?? {};

    if (type !== 'DIFF') return; // 알 수 없는 타입은 무시

    // ── JSON 역직렬화 ─────────────────────────────────────────────────────────
    /** @type {{ initial: object, current: object } | null} */
    let parsed = null;
    try {
        parsed = JSON.parse(payload);
    } catch (parseErr) {
        // JSON 파싱 실패 — 에러 응답으로 pending 해제
        self.postMessage({
            type: 'DIFF_RESULT',
            id,
            changeLog: [],
            error: `[DSM] diff.worker: JSON.parse 실패 — ${String(parseErr)}`,
        });
        return;
    }

    const { initial, current } = parsed ?? {};

    // ── diff 연산 ─────────────────────────────────────────────────────────────
    try {
        const changeLog = deepDiff(initial ?? {}, current ?? {}, itemKey ?? undefined);

        self.postMessage({
            type: 'DIFF_RESULT',
            id,
            changeLog,
        });
    } catch (diffErr) {
        // diff 연산 자체의 예외 — 에러 응답으로 pending 해제
        self.postMessage({
            type: 'DIFF_RESULT',
            id,
            changeLog: [],
            error: `[DSM] diff.worker: deepDiff 실패 — ${String(diffErr)}`,
        });
    }
};
