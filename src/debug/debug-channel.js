/**
 * 디버그 BroadcastChannel 통신 및 팝업 관리
 *
 * 같은 출처(Origin)의 모든 브라우저 탭이 `'dsm_debug'` 채널로 연결되어
 * 디버그 팝업 창에서 모든 탭의 `DomainState` 상태를 실시간으로 확인할 수 있다.
 *
 * ## 아키텍처 — BroadcastChannel 기반 멀티탭 통신
 *
 * ```
 * [탭 A]              [탭 B]              [디버그 팝업]
 *   │                   │                      │
 *   │◄──── TAB_PING ────┼──────────────────────│  팝업이 ping 전송
 *   │                   │                      │
 *   ├──── TAB_REGISTER ─┼──────────────────────►  각 탭이 자신을 등록
 *   │                   ├──── TAB_REGISTER ────►
 *   │                   │                      │
 *   ├──── DS_UPDATE ────┼──────────────────────►  상태 변경 시 broadcast
 *   │                   │                      │
 *   │ (탭 닫힘/새로고침)│                      │
 *   ├── TAB_UNREGISTER ─┼──────────────────────►  탭 해제 알림
 * ```
 *
 * ## BroadcastChannel 자기 수신 불가 제약 우회
 * BroadcastChannel은 자기 자신이 보낸 메시지를 수신하지 않는다.
 * 따라서 팝업이 직접 `TAB_PING`을 broadcast하고, 각 탭이 `TAB_REGISTER`로 응답한다.
 *
 * ## Heartbeat & GC 전략
 * 팝업은 2초마다 `TAB_PING`을 전송하고, 탭은 `TAB_REGISTER`로 응답한다.
 * 팝업의 GC 로직이 2초마다 `lastSeen` 타임스탬프를 확인하여
 * 5초 이상 응답이 없는 탭을 죽은 탭으로 판단하고 레지스트리에서 제거한다.
 * `beforeunload` 이벤트에 의존하지 않아 모바일 브라우저나 강제 종료에도 대응한다.
 *
 * ## 메모리 누수 방지
 * SPA 환경에서 컴포넌트가 언마운트될 때 `closeDebugChannel()`을 호출하여
 * `BroadcastChannel`을 명시적으로 닫고 GC 대상이 되도록 해야 한다.
 *
 * ## 초기화 전략 — Lazy Initialization
 * 이 모듈은 import 시 브라우저 전용 사이드 이펙트를 즉시 실행하지 않는다.
 * `broadcastUpdate()`가 최초 호출되는 시점, 즉 `debug: true`인 `DomainState`가
 * 처음으로 상태를 broadcast하는 순간에 `initDebugChannel()`이 lazy하게 실행된다.
 *
 * 이 구조를 통해 Node.js / Vitest 테스트 환경에서 `window`, `location` 등
 * 브라우저 전용 전역 객체에 대한 `ReferenceError` 없이 모듈을 안전하게 import할 수 있다.
 *
 * 초기화 순서:
 * 1. `broadcastUpdate()` 최초 호출 → `initDebugChannel()` 실행
 * 2. `TAB_PING` 수신 시 `registerTab()` 응답 리스너 등록
 * 3. `beforeunload` 시 `TAB_UNREGISTER` 전송 리스너 등록
 * 4. 초기 `registerTab()` 호출 (페이지 로드 직후 자기 등록)
 *
 * @module debug/debug-channel
 * @see {@link https://developer.mozilla.org/ko/docs/Web/API/BroadcastChannel MDN — BroadcastChannel}
 * @see {@link module:domain/DomainState DomainState}
 */

import {
    DEBUG_CHANNEL_NAME,
    DEBUG_POPUP_NAME,
    DEBUG_POPUP_FEATURES,
    MSG_TYPE,
} from '../constants/channel.const.js';


// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 채널을 통해 전송되는 메시지 타입 식별자.
 * `channel.const.js`의 `MSG_TYPE` 상수값과 일치한다.
 *
 * @typedef {'TAB_REGISTER'|'TAB_UNREGISTER'|'TAB_PING'|'DS_UPDATE'|'DS_ERROR'} DebugMessageType
 */

/**
 * `TAB_REGISTER` 메시지 구조.
 * 각 탭이 팝업의 `TAB_PING`에 응답하거나 로드 직후 자기 등록 시 전송한다.
 *
 * @typedef {object} TabRegisterMessage
 * @property {'TAB_REGISTER'} type   - 메시지 타입
 * @property {string}          tabId  - 이 탭의 고유 ID (`dsm_{timestamp}_{random}` 형식)
 * @property {string}          tabUrl - 이 탭의 현재 URL (`location.href`)
 * @property {Record<string, DomainStateSnapshot>} states - 이 탭의 모든 DomainState 스냅샷 맵
 */

/**
 * `TAB_UNREGISTER` 메시지 구조.
 * 탭이 닫히거나 `closeDebugChannel()` 호출 시 전송한다.
 *
 * @typedef {object} TabUnregisterMessage
 * @property {'TAB_UNREGISTER'} type  - 메시지 타입
 * @property {string}            tabId - 해제할 탭의 고유 ID
 */

/**
 * `DS_UPDATE` 메시지 구조.
 * `DomainState._broadcast()` 호출 시 전송된다.
 *
 * @typedef {object} DsUpdateMessage
 * @property {'DS_UPDATE'} type     - 메시지 타입
 * @property {string}       tabId   - 전송 탭의 고유 ID
 * @property {string}       tabUrl  - 전송 탭의 현재 URL
 * @property {string}       label   - 변경된 `DomainState`의 식별 레이블
 * @property {DomainStateSnapshot} snapshot - 변경 직후 스냅샷
 */

/**
 * `DS_ERROR` 메시지 구조.
 * `DomainPipeline` 내 `after()` 핸들러 실패 시 전송된다.
 *
 * @typedef {object} DsErrorMessage
 * @property {'DS_ERROR'} type   - 메시지 타입
 * @property {string}      tabId  - 전송 탭의 고유 ID
 * @property {string}      tabUrl - 전송 탭의 현재 URL
 * @property {string}      key    - 실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)
 * @property {string}      error  - `String(error)` 직렬화된 에러 메시지
 */

/**
 * `_stateRegistry`에 저장되는 `DomainState` 스냅샷.
 * `broadcastUpdate()` 호출 시 생성된다.
 *
 * @typedef {object} DomainStateSnapshot
 * @property {string}   label      - `DomainState`의 식별 레이블
 * @property {object}   data       - `DomainState._getTarget()` 결과 (원본 객체)
 * @property {import('../core/api-proxy.js').ChangeLogEntry[]} changeLog - 현재 변경 이력
 * @property {boolean}  isNew      - 신규 리소스 여부
 * @property {Array<*>} errors     - 인스턴스 수준 에러 목록
 */

/**
 * `broadcastUpdate()` 의 `snapshot` 파라미터 타입.
 * `DomainState._broadcast()` 에서 구성하여 전달한다.
 *
 * @typedef {object} BroadcastSnapshot
 * @property {object}   data      - `DomainState._getTarget()` 결과
 * @property {import('../core/api-proxy.js').ChangeLogEntry[]} changeLog - 현재 변경 이력
 * @property {boolean}  isNew     - 신규 리소스 여부
 * @property {Array<*>} errors    - 인스턴스 수준 에러 목록
 */


// ════════════════════════════════════════════════════════════════════════════════
// 모듈 수준 상태 (싱글톤)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 이 라이브러리 인스턴스(탭)의 고유 식별자.
 * 모듈 로드 시 1회 생성되며 탭 생명주기 내내 유지된다.
 *
 * 형식: `dsm_{Date.now()}_{Math.random().toString(36).slice(2, 8)}`
 * 예: `'dsm_1741856783412_3f9k2a'`
 *
 * @type {string}
 */
const TAB_ID = `dsm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * `BroadcastChannel` 싱글톤 인스턴스.
 * `getChannel()` 최초 호출 시 초기화되며, `closeDebugChannel()` 호출 시 `null`로 리셋된다.
 *
 * @type {BroadcastChannel | null}
 */
let _channel = null;

/**
 * 이 탭에서 생성된 모든 `DomainState`의 최신 스냅샷을 보관하는 레지스트리.
 *
 * - 키: `DomainState` 식별 레이블 (개발자가 지정하거나 자동 생성)
 * - 값: 해당 `DomainState`의 최신 스냅샷 (`DomainStateSnapshot`)
 *
 * `TAB_PING` 수신 시 `registerTab()`이 이 맵 전체를 팝업으로 전송한다.
 *
 * @type {Map<string, DomainStateSnapshot>}
 */
const _stateRegistry = new Map();


// ════════════════════════════════════════════════════════════════════════════════
// 내부 유틸리티
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `BroadcastChannel` 싱글톤 인스턴스를 반환한다.
 *
 * 최초 호출 시 채널을 생성하고, 이후 호출에는 캐싱된 인스턴스를 반환한다.
 * 브라우저가 `BroadcastChannel`을 지원하지 않으면 `null`을 반환하여
 * 하위 환경에서 채널 관련 기능이 조용히 비활성화되도록 한다.
 *
 * @returns {BroadcastChannel | null} 채널 인스턴스 또는 미지원 환경에서 `null`
 */
function getChannel() {
    if (_channel) return _channel;
    if (typeof BroadcastChannel === 'undefined') return null;
    _channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
    return _channel;
}

/**
 * 현재 탭의 정보와 모든 `DomainState` 스냅샷을 채널에 등록 알림으로 전송한다.
 *
 * 다음 두 시점에 호출된다:
 * 1. 모듈 로드 직후 — 페이지가 열렸을 때 팝업에 자기 존재를 알림
 * 2. `TAB_PING` 수신 시 — 팝업의 Heartbeat에 응답하여 살아있음을 알림
 *
 * 전송하는 `states`는 `_stateRegistry`의 현재 내용을 `Object.fromEntries()`로 변환한 것이다.
 *
 * @returns {void}
 */
function registerTab() {
    getChannel()?.postMessage(/** @type {TabRegisterMessage} */ ({
        type:   MSG_TYPE.TAB_REGISTER,
        tabId:  TAB_ID,
        tabUrl: location.href,
        states: Object.fromEntries(_stateRegistry),
    }));
}


// ════════════════════════════════════════════════════════════════════════════════
// 지연 초기화 (Lazy Initialization)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 초기화 완료 여부를 기록하는 모듈 수준 플래그.
 *
 * ES Module은 싱글톤이므로, 이 플래그는 같은 출처(Origin) 내에서
 * `initDebugChannel()`이 단 한 번만 실행됨을 보장한다.
 *
 * @type {boolean}
 */
let _initialized = false;

/**
 * 디버그 채널의 브라우저 전용 사이드 이펙트를 초기화한다.
 *
 * 아래 세 가지 동작을 수행하며, 브라우저 환경에서 단 한 번만 실행된다:
 * 1. `TAB_PING` 수신 시 `registerTab()`으로 응답하는 채널 리스너 등록
 * 2. `beforeunload` 시 `TAB_UNREGISTER` 전송 리스너 등록
 * 3. 초기 `registerTab()` 호출 (팝업이 이미 열려있다면 즉시 이 탭을 인식함)
 *
 * `broadcastUpdate()` 내부에서 lazy하게 호출되므로,
 * 실제로 `debug: true`인 `DomainState` 인스턴스가 상태 변경을 일으키기 전까지는
 * 실행되지 않는다.
 *
 * `window`가 존재하지 않는 환경(Node.js, Vitest node environment)에서는
 * 즉시 반환하여 아무 동작도 하지 않는다 (no-op).
 *
 * @returns {void}
 */
export function initDebugChannel() {
    // Node.js / Vitest(node) 환경에서는 window가 없으므로 no-op으로 처리한다.
    // BroadcastChannel, location 등 브라우저 전용 API 접근을 차단하는 유일한 관문.
    if (typeof window === 'undefined') return;

    // _initialized 플래그로 중복 실행을 차단한다.
    // SPA에서 핫 리로드 등으로 모듈이 재평가되는 경우에도 이벤트 리스너 중복 등록을 막는다.
    if (_initialized) return;
    _initialized = true;

    // TAB_PING 수신 시 registerTab()으로 응답
    getChannel()?.addEventListener('message', ({ data }) => {
        if (data?.type === MSG_TYPE.TAB_PING) registerTab();
    });

    // 탭/창이 닫히거나 새로고침될 때 팝업에 해제 신호 전송
    // 단, 모바일 브라우저나 강제 종료 시에는 이 이벤트가 발생하지 않을 수 있다.
    // 이 경우 팝업의 Heartbeat GC 로직이 5초 후 해당 탭을 자동으로 제거한다.
    window.addEventListener('beforeunload', () => {
        getChannel()?.postMessage(/** @type {TabUnregisterMessage} */ ({
            type:  MSG_TYPE.TAB_UNREGISTER,
            tabId: TAB_ID,
        }));
    });

    // 페이지 로드 직후 자기 등록 (팝업이 이미 열려있다면 즉시 이 탭을 인식함)
    registerTab();
}


// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `BroadcastChannel`을 명시적으로 닫고 내부 참조를 해제한다.
 *
 * SPA(Single Page Application) 환경에서 라우트 이동이나 컴포넌트 언마운트 시
 * 이 함수를 호출하여 채널 객체가 GC 대상이 되도록 해야 한다.
 *
 * 채널이 닫히기 전에 `TAB_UNREGISTER` 메시지를 한 번 전송하여
 * 팝업이 즉시 이 탭을 레지스트리에서 제거할 수 있도록 한다.
 *
 * `_channel`이 이미 `null`이면 아무 동작도 하지 않는다.
 *
 * @returns {void}
 *
 * @example <caption>SPA 라우트 언마운트 시 호출</caption>
 * import { closeDebugChannel } from './rest-domain-state-manager.js';
 *
 * // Vue 3 / React의 cleanup 훅에서:
 * onUnmounted(() => closeDebugChannel());
 * useEffect(() => () => closeDebugChannel(), []);
 */
export function closeDebugChannel() {
    if (_channel) {
        _channel.postMessage(/** @type {TabUnregisterMessage} */ ({
            type:  MSG_TYPE.TAB_UNREGISTER,
            tabId: TAB_ID,
        }));
        _channel.close();
        _channel = null;
        console.debug('[DSM] Debug BroadcastChannel closed.');
    }
}

/**
 * `DomainState`의 상태 변경을 채널에 broadcast하고 `_stateRegistry`를 갱신한다.
 *
 * `DomainState._broadcast()` 내부에서 호출된다.
 * `debug: true`인 인스턴스가 생성될 때, 필드가 변경될 때, `save()` 성공 후 호출된다.
 *
 * 채널이 `null`이면 (BroadcastChannel 미지원 환경) 메시지 전송을 건너뛰지만
 * `_stateRegistry` 갱신은 수행한다.
 *
 * @param {string}            label    - `DomainState`의 식별 레이블
 * @param {BroadcastSnapshot} snapshot - 현재 상태 스냅샷 (`data`, `changeLog`, `isNew`, `errors`)
 * @returns {void}
 *
 * @example <caption>DomainState._broadcast() 내부에서의 호출</caption>
 * // DomainState 내부:
 * _broadcast() {
 *     broadcastUpdate(this._label, {
 *         data:      this._getTarget(),
 *         changeLog: this._getChangeLog(),
 *         isNew:     this._isNew,
 *         errors:    this._errors,
 *     });
 * }
 */
export function broadcastUpdate(label, snapshot) {
    // debug: true인 DomainState가 최초로 상태를 broadcast하는 시점에
    // 채널 초기화를 수행한다. 브라우저 환경이 아니면 no-op.
    // Node.js / Vitest(node) 환경에서는 no-op으로 처리한다.
    if(typeof window === 'undefined') return;
    initDebugChannel();

    _stateRegistry.set(label, { label, ...snapshot });
    getChannel()?.postMessage(/** @type {DsUpdateMessage} */ ({
        type:    MSG_TYPE.DS_UPDATE,
        tabId:   TAB_ID,
        tabUrl:  location.href,
        label,
        snapshot,
    }));
}

/**
 * `DomainPipeline`의 `after()` 핸들러 실패를 채널에 broadcast한다.
 *
 * `DomainPipeline.run()` 내부에서 `after()` 핸들러가 throw할 때 호출된다.
 * 팝업은 이 메시지를 수신하여 해당 탭의 에러 목록에 추가하고 UI를 갱신한다.
 *
 * 채널이 `null`이면 아무 동작도 하지 않는다.
 *
 * @param {string} key   - 실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)
 * @param {*}      error - throw된 에러 값 (모든 타입 허용, `String()`으로 직렬화됨)
 * @returns {void}
 *
 * @example <caption>DomainPipeline.run() 내부에서의 호출</caption>
 * try {
 *     await handler(state);
 * } catch (err) {
 *     broadcastError(key, err); // 팝업에 에러 전파
 *     if (this._strict) throw err;
 * }
 */
export function broadcastError(key, error) {
    // Node.js / Vitest(node) 환경에서는 no-op으로 처리한다.
    if(typeof window === 'undefined') return;
    
    getChannel()?.postMessage(/** @type {DsErrorMessage} */ ({
        type:   MSG_TYPE.DS_ERROR,
        tabId:  TAB_ID,
        tabUrl: location.href,
        key,
        error:  String(error),
    }));
}

/**
 * 디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.
 *
 * `DomainState.openDebugger()` 호출 시 실행된다. (`debug: true` 시만 호출)
 *
 * ## 동작 흐름
 * 1. `window.open()`으로 팝업을 열거나 기존 창에 포커스한다.
 * 2. 팝업 내 `#dsm-root` 요소 존재 여부로 초기화 여부를 판단한다.
 * 3. 초기화되지 않은 경우: `_buildPopupHTML()`로 생성한 HTML을 주입한다.
 * 4. 팝업 `load` 이벤트 후 `_initPopupChannel()`로 채널을 연결한다.
 *    (현재 팝업 내부 스크립트가 자체적으로 채널을 처리하므로 실질적으로는 No-op)
 *
 * 팝업 차단으로 `window.open()`이 `null`을 반환하면 콘솔 경고 후 조기 반환한다.
 *
 * @returns {void}
 *
 * @example <caption>DomainState에서 호출</caption>
 * const user = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'User' });
 * user.openDebugger(); // → openDebugPopup() 내부 호출
 */
export function openDebugPopup() {
    const popup = window.open('', DEBUG_POPUP_NAME, DEBUG_POPUP_FEATURES);
    if (!popup) {
        console.warn('[DSM] 팝업이 차단되었습니다. 브라우저 팝업 차단을 해제하세요.');
        return;
    }

    // 이미 초기화된 팝업이면 포커스만 이동
    if (popup.document.getElementById('dsm-root')) {
        popup.focus();
        return;
    }

    popup.document.write(_buildPopupHTML());
    popup.document.close();

    popup.addEventListener('load', () => {
        _initPopupChannel(popup);
    });
}


// ════════════════════════════════════════════════════════════════════════════════
// 내부 팝업 유틸리티
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 디버그 팝업 창의 HTML 문자열을 생성한다.
 *
 * 외부 리소스(CDN, 파일)에 의존하지 않는 완전한 자급자족 HTML이다.
 * `window.open()` 후 `popup.document.write()`로 직접 주입된다.
 *
 * ## 팝업 내부 기능
 * - **탭 바**: 연결된 탭 목록을 버튼으로 표시. 클릭 시 해당 탭의 상태 표시.
 * - **상태 뷰**: 선택된 탭의 모든 `DomainState`를 레이블별로 표시.
 *   - `data` (현재 상태, JSON pretty-print)
 *   - `changeLog` (변경 이력, 건수 포함)
 *   - `errors` (에러 목록, 있는 경우만)
 * - **Heartbeat**: 2초마다 `TAB_PING`을 broadcast하여 살아있는 탭을 확인.
 * - **GC**: 2초마다 `lastSeen` 기준 5초 이상 무응답 탭을 자동 제거.
 *
 * @returns {string} 팝업에 주입할 완전한 HTML 문자열
 */
function _buildPopupHTML() {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>DSM Debugger</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Consolas', 'D2Coding', monospace; font-size: 12px;
         background: #1e1e1e; color: #d4d4d4; height: 100vh; display: flex; flex-direction: column; }
  #header { background: #007acc; color: #fff; padding: 8px 12px;
            font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 8px; }
  #tab-bar { display: flex; background: #2d2d2d; border-bottom: 1px solid #444; overflow-x: auto; }
  .tab-btn { padding: 6px 12px; border: none; background: transparent; color: #aaa;
             cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; font-size: 11px; }
  .tab-btn.active { color: #fff; border-bottom-color: #007acc; }
  .tab-btn:hover  { background: #3a3a3a; }
  #content { flex: 1; overflow-y: auto; padding: 10px; }
  .ds-block { margin-bottom: 12px; border: 1px solid #3a3a3a; border-radius: 4px; overflow: hidden; }
  .ds-header { background: #2d2d2d; padding: 6px 10px; font-weight: bold;
               display: flex; justify-content: space-between; align-items: center; }
  .ds-header .badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; }
  .badge-new     { background: #16825d; color: #fff; }
  .badge-exist   { background: #0e639c; color: #fff; }
  .badge-error   { background: #c72e0f; color: #fff; }
  .ds-section    { padding: 6px 10px; border-top: 1px solid #3a3a3a; }
  .ds-section-title { color: #9cdcfe; font-size: 11px; margin-bottom: 4px; }
  pre { white-space: pre-wrap; word-break: break-all; color: #ce9178; font-size: 11px; line-height: 1.5; }
  .change-entry { color: #4ec9b0; }
  .error-entry  { color: #f48771; }
  #empty { color: #666; text-align: center; padding: 40px; }
</style>
</head>
<body>
<div id="header">
  🔍 DSM Debugger
  <span id="tab-count" style="font-size:11px;opacity:.8">탭 없음</span>
</div>
<div id="tab-bar"></div>
<div id="content"><div id="empty">탭 데이터를 기다리는 중...</div></div>
<script>
  const tabs    = new Map();
  let activeTab = null;
  const channel = new BroadcastChannel('dsm_debug');

  // 1. 팝업 초기화 직후 TAB_PING을 broadcast하여 현재 열린 탭들이 응답하도록 한다.
  //    BroadcastChannel은 자기 자신이 보낸 메시지를 수신하지 않으므로,
  //    팝업이 직접 PING을 보내고 각 탭이 TAB_REGISTER로 응답하는 구조를 사용한다.
  channel.postMessage({ type: 'TAB_PING' });

  channel.addEventListener('message', ({ data }) => {
    if (!data) return;
    const now = Date.now();

    if (data.type === 'TAB_REGISTER') {
      tabs.set(data.tabId, { url: data.tabUrl, states: data.states ?? {}, lastSeen: now });
      if (!activeTab) activeTab = data.tabId;
      render();
    }
    if (data.type === 'TAB_UNREGISTER') {
      tabs.delete(data.tabId);
      if (activeTab === data.tabId) activeTab = [...tabs.keys()][0] ?? null;
      render();
    }
    if (data.type === 'DS_UPDATE' && tabs.has(data.tabId)) {
      const tab = tabs.get(data.tabId);
      tab.states[data.label] = { label: data.label, ...data.snapshot };
      tab.lastSeen = now;
      render();
    }
    if (data.type === 'DS_ERROR' && tabs.has(data.tabId)) {
      const tab = tabs.get(data.tabId);
      (tab.errors ??= []).push({ key: data.key, error: data.error });
      tab.lastSeen = now;
      render();
    }
  });

  // 2. Heartbeat: 2초마다 TAB_PING을 broadcast하여 살아있는 탭의 응답을 유도한다.
  //    탭이 응답하면 lastSeen 타임스탬프가 갱신된다.
  setInterval(() => {
      channel.postMessage({ type: 'TAB_PING' });
  }, 2000);

  // 3. GC: 2초마다 lastSeen을 확인하여 5초 이상 무응답인 탭을 죽은 탭으로 판단하고 제거한다.
  //    beforeunload 이벤트가 발생하지 않는 모바일/강제 종료 환경을 대응한다.
  setInterval(() => {
      const now = Date.now();
      let isDeadFound = false;
      for (const [id, tab] of tabs.entries()) {
          if (now - tab.lastSeen > 5000) {
              tabs.delete(id);
              if (activeTab === id) activeTab = [...tabs.keys()][0] ?? null;
              isDeadFound = true;
          }
      }
      if (isDeadFound) render();
  }, 2000);

  function render() {
      document.getElementById('tab-count').textContent = \`활성 탭: \${tabs.size}개\`;
      const tabBar  = document.getElementById('tab-bar');
      const content = document.getElementById('content');

      if (tabs.size === 0) {
        tabBar.innerHTML  = '';
        content.innerHTML = '<div id="empty">대기 중...</div>';
        return;
      }

      tabBar.innerHTML = [...tabs.keys()].map(k => \`
        <button class="tab-btn \${k === activeTab ? 'active' : ''}" data-id="\${k}">
          \${k.split('_')[1]} (\${new URL(tabs.get(k).url).pathname})
        </button>
      \`).join('');

      if (!activeTab || !tabs.has(activeTab)) activeTab = [...tabs.keys()][0];
      const states = tabs.get(activeTab).states;
      const keys   = Object.keys(states);

      if (keys.length === 0) {
        content.innerHTML = '<div id="empty">생성된 DomainState 없음</div>';
      } else {
        content.innerHTML = keys.map(k => {
          const s          = states[k];
          const badgeClass = s.isNew ? 'badge-new' : 'badge-exist';
          const badgeText  = s.isNew ? 'NEW'       : 'EXIST';
          const hasError   = (s.errors?.length ?? 0) > 0;
          return \`<div class="ds-block">
            <div class="ds-header">
              <span>\${s.label ?? k}</span>
              <span>
                <span class="badge \${badgeClass}">\${badgeText}</span>
                \${hasError ? '<span class="badge badge-error">ERROR</span>' : ''}
              </span>
            </div>
            <div class="ds-section">
              <div class="ds-section-title">data (현재 상태)</div>
              <pre>\${JSON.stringify(s.data, null, 2)}</pre>
            </div>
            <div class="ds-section">
              <div class="ds-section-title">changeLog (\${(s.changeLog ?? []).length}건)</div>
              \${(s.changeLog ?? []).map(e =>
                \`<pre class="change-entry">\${JSON.stringify(e)}</pre>\`
              ).join('') || '<pre style="color:#666">변경 없음</pre>'}
            </div>
            \${hasError ? \`<div class="ds-section">
              <div class="ds-section-title">errors</div>
              \${s.errors.map(e => \`<pre class="error-entry">\${JSON.stringify(e)}</pre>\`).join('')}
            </div>\` : ''}
          </div>\`;
        }).join('');
      }

      tabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => { activeTab = btn.dataset.id; render(); };
      });
  }
<\/script>
</body>
</html>`;
}

/**
 * 팝업 창에 채널 수신 핸들러를 연결하기 위한 확장 지점.
 *
 * 현재는 팝업 내부의 `<script>` 블록이 자체적으로 `BroadcastChannel`을 생성하고
 * 모든 메시지를 처리하므로 이 함수는 실질적으로 아무 동작도 하지 않는다.
 *
 * 향후 팝업 ↔ 부모 탭 간 직접 통신 기능(예: 디버거에서 `save()` 트리거)이
 * 필요해질 때 이 함수를 확장 지점으로 사용한다.
 *
 * @param {Window} _popup - `window.open()`으로 열린 팝업 Window 객체
 * @returns {void}
 */
function _initPopupChannel(_popup) {
    // 팝업 내부의 BroadcastChannel 스크립트가 자체적으로 처리한다.
    // 향후 부모 탭 ↔ 팝업 직접 통신 기능 추가 시 이 함수를 확장한다.
}
