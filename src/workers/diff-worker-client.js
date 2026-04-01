/**
 * Diff Worker 클라이언트 — Promise 기반 비동기 인터페이스
 *
 * `diff.worker.js`와 메인 스레드 사이의 `postMessage` / `onmessage` 통신을
 * Promise API로 감싸 `DomainState.save()`에서 `await`로 사용할 수 있도록 한다.
 *
 * ## 설계 원칙
 *
 * ### Lazy Singleton 패턴
 * Worker 인스턴스는 첫 번째 `requestDiff()` 호출 시 단 1회 생성된다.
 * 이후 모든 `requestDiff()` 호출이 동일한 Worker 인스턴스를 재사용한다.
 * 사용하지 않으면 Worker가 생성되지 않아 메모리를 낭비하지 않는다.
 *
 * ### 동시성 안전 (Concurrency Safety)
 * 여러 `DomainState` 인스턴스가 동시에 `save()`를 호출할 수 있다.
 * 각 요청에 고유한 `_requestId`를 부여하고, 응답 수신 시 ID로 매칭한다.
 * `_pending Map`에서 해당 ID의 Promise를 꺼내 resolve/reject한다.
 *
 * ### Node.js / Vitest 폴백
 * `typeof Worker === 'undefined'`인 Node.js 환경(Vitest, SSR)에서는
 * Worker 없이 `deepDiff()`를 **동기적으로** 직접 호출한다.
 * 테스트 격리가 완전하고, 비동기 메시지 대기 없이 동일한 로직을 검증할 수 있다.
 *
 * ### Worker 에러 복구
 * Worker가 치명적 에러로 종료되면 `_pending` 전체를 reject하고
 * `_worker = null`로 초기화한다. 다음 `requestDiff()` 호출 시 Worker가 재생성된다.
 *
 * @module workers/diff-worker-client
 * @see {@link module:workers/diff.worker diff.worker}
 * @see {@link module:common/lcs-diff deepDiff}
 */

import { deepDiff } from '../common/lcs-diff.js';

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * RFC 6902 JSON Patch 연산 항목.
 * `api-proxy.js`의 `ChangeLogEntry`와 동일한 구조.
 *
 * @typedef {object} ChangeLogEntry
 * @property {'add'|'replace'|'remove'} op         - RFC 6902 연산 종류
 * @property {string}                   path       - JSON Pointer 경로
 * @property {*}                        [newValue] - 새 값
 * @property {*}                        [oldValue] - 이전 값
 */

// ════════════════════════════════════════════════════════════════════════════════
// 모듈 레벨 상태
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Lazy Singleton Worker 인스턴스.
 * 첫 번째 `requestDiff()` 호출 시 생성된다.
 * Worker API 미지원 환경에서는 항상 `null`이다.
 *
 * @type {Worker | null}
 */
let _worker = null;

/**
 * 요청 ID 카운터.
 * `requestDiff()` 호출마다 증가하여 고유한 요청 ID를 생성한다.
 * 동시 요청이 여러 개여도 각자의 응답을 정확히 매칭할 수 있다.
 *
 * @type {number}
 */
let _nextId = 0;

/**
 * 대기 중인 Promise 저장소.
 * 키: 요청 ID(`string`), 값: `{ resolve, reject }` 콜백 쌍.
 *
 * Worker로부터 `DIFF_RESULT` 응답이 오면 해당 ID의 항목을 꺼내 resolve/reject한다.
 *
 * @type {Map<string, { resolve: (value: ChangeLogEntry[]) => void, reject: (reason?: *) => void }>}
 */
const _pending = new Map();

// ════════════════════════════════════════════════════════════════════════════════
// 내부 유틸
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Lazy Singleton Worker를 반환하거나, 미지원 환경에서 `null`을 반환한다.
 *
 * Worker 최초 생성 시 `onmessage`와 `onerror` 핸들러를 등록한다.
 * `onerror` 발생 시 전체 pending 항목을 reject하고 Worker를 재생성 가능 상태로 초기화한다.
 *
 * @returns {Worker | null}
 */
function _getWorker() {
    if (_worker) return _worker;

    // Worker API 미지원 환경 (Node.js, Vitest, 구형 브라우저)
    if (typeof Worker === 'undefined') return null;

    // Worker 생성 — import.meta.url 기반 동적 경로 (번들러 호환)
    _worker = new Worker(new URL('./diff.worker.js', import.meta.url), { type: 'module' });

    // ── 응답 핸들러 ──────────────────────────────────────────────────────────
    _worker.onmessage = (event) => {
        const { id, changeLog, error } = event.data ?? {};
        const pending = _pending.get(id);
        if (!pending) return; // 알 수 없는 ID (이미 처리됨 또는 Worker 재생성 후)

        _pending.delete(id);

        if (error) {
            pending.reject(new Error(error));
        } else {
            pending.resolve(changeLog ?? []);
        }
    };

    // ── 치명적 에러 핸들러 ──────────────────────────────────────────────────
    // Worker가 치명적 에러로 종료되면:
    // 1. 대기 중인 모든 Promise를 reject한다 (영원한 대기 방지)
    // 2. Worker 참조를 null로 초기화하여 다음 호출 시 재생성되도록 한다.
    _worker.onerror = (event) => {
        const errorMsg = `[DSM] diff.worker 치명적 에러: ${event.message ?? 'Unknown error'}`;

        for (const { reject } of _pending.values()) {
            reject(new Error(errorMsg));
        }
        _pending.clear();

        // Worker 참조 초기화 → 다음 requestDiff() 시 재생성
        _worker = null;
    };

    return _worker;
}

// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 두 도메인 객체를 비교하여 RFC 6902 형식의 changeLog 배열을 반환한다.
 *
 * ## 브라우저 환경 (Worker 지원)
 * `diff.worker.js`에 diff 연산을 오프로딩하여 메인 스레드를 블로킹하지 않는다.
 * 동시 요청이 여러 개여도 각 요청은 고유한 ID로 독립적으로 처리된다.
 *
 * ## Node.js / Vitest 환경 (Worker 미지원)
 * `deepDiff()`를 동기적으로 직접 호출한다.
 * 비동기 Promise로 감싸 반환하므로 호출 코드(await)가 동일하게 동작한다.
 * 테스트에서 Worker 없이 동일한 비즈니스 로직을 검증할 수 있다.
 *
 * ## 오프로딩 안전성
 * `DomainState.save()` 호출 시 이미 `#snapshot`이 동기 캡처된 이후에
 * 이 함수가 호출된다. diff 연산 중 소비자가 데이터를 변경해도,
 * `lazy` 모드의 Proxy `set` 트랩은 changeLog 기록을 건너뛰므로
 * 타이밍 충돌이 발생하지 않는다.
 *
 * @param {object}            target   - 현재 도메인 객체 (`_getTarget()` 결과)
 * @param {object}            initial  - 초기 상태 스냅샷 (`_initialSnapshot`)
 * @param {string | undefined} [itemKey] - 배열 항목 동일성 기준 필드명.
 *                                         미지정 시 positional fallback.
 * @returns {Promise<ChangeLogEntry[]>} RFC 6902 형식의 변경 이력 배열.
 *   변경이 없으면 빈 배열 `[]`로 resolve된다.
 * @throws {Error} Worker 에러 또는 JSON 처리 실패 시 reject된다.
 *
 * @example <caption>DomainState.save() lazy 모드 내부 호출</caption>
 * const diffResult = await requestDiff(
 *     this._getTarget(),
 *     this._initialSnapshot,
 *     this._lazyItemKey  // undefined이면 positional
 * );
 * // diffResult: ChangeLogEntry[]
 *
 * @example <caption>직접 사용</caption>
 * const initial = { name: 'Davi', email: 'davi@example.com' };
 * const current = { name: 'Lee',  email: 'davi@example.com' };
 * const log = await requestDiff(current, initial);
 * // [{ op: 'replace', path: '/name', oldValue: 'Davi', newValue: 'Lee' }]
 */
export async function requestDiff(target, initial, itemKey) {
    const worker = _getWorker();

    // ── Node.js / Vitest 폴백: 동기 실행 ────────────────────────────────────
    if (!worker) {
        const changeLog = deepDiff(initial ?? {}, target ?? {}, itemKey);
        return changeLog;
    }

    // ── 브라우저: Worker 비동기 실행 ─────────────────────────────────────────
    return new Promise((resolve, reject) => {
        const id = String(++_nextId);
        _pending.set(id, { resolve, reject });

        // JSON.stringify 후 문자열로 전달 (postMessage structuredClone 최적화)
        // Nolan Lawson 분석: 복잡한 객체는 JSON.stringify 후 postMessage가 더 빠름
        let payload;
        try {
            payload = JSON.stringify({ initial: initial ?? {}, current: target ?? {} });
        } catch (err) {
            _pending.delete(id);
            reject(new Error(`[DSM] requestDiff: JSON.stringify 실패 — ${String(err)}`));
            return;
        }

        worker.postMessage({
            type:    'DIFF',
            id,
            payload,
            itemKey: itemKey ?? undefined,
        });
    });
}

/**
 * Lazy Singleton Worker를 종료하고 모든 대기 중인 Promise를 reject한다.
 *
 * 테스트 환경에서 Worker를 명시적으로 정리하거나,
 * 애플리케이션 종료 시 Worker 생명주기를 완전히 관리할 때 사용한다.
 *
 * Worker 없이 동작하는 환경(Node.js)에서는 no-op이다.
 *
 * @returns {void}
 *
 * @example <caption>Vitest afterEach에서 정리</caption>
 * afterEach(() => {
 *     terminateDiffWorker();
 * });
 */
export function terminateDiffWorker() {
    if (_worker) {
        // 남은 pending 항목 reject (영원한 대기 방지)
        for (const { reject } of _pending.values()) {
            reject(new Error('[DSM] diff.worker가 명시적으로 종료되었습니다.'));
        }
        _pending.clear();

        _worker.terminate();
        _worker = null;
    }
}
