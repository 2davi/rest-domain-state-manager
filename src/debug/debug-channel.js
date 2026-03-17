/**
 * @fileoverview 디버그 BroadcastChannel 통신 및 팝업 관리
 *
 * 같은 출처(Origin)의 모든 탭이 'dsm_debug' 채널로 연결되며,
 * 디버그 팝업 창이 모든 탭의 DomainState 상태를 실시간으로 표시한다.
 *
 * BroadcastChannel은 브라우저 내장 Web API로 외부 의존성이 없다.
 *
 * @module debug/debug-channel
 * @see https://developer.mozilla.org/ko/docs/Web/API/BroadcastChannel
 */

import {
    DEBUG_CHANNEL_NAME,
    DEBUG_POPUP_NAME,
    DEBUG_POPUP_FEATURES,
    MSG_TYPE,
} from '../constants/channel.const.js';


// ── 탭 고유 ID — 라이브러리 로드 시 1회 생성 ───────────────────────────────
const TAB_ID = `dsm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── BroadcastChannel 싱글톤 ───────────────────────────────────────────────
let _channel = null;

/**
 * BroadcastChannel 인스턴스를 반환한다.
 * 브라우저가 BroadcastChannel을 지원하지 않으면 null을 반환한다.
 *
 * @returns {BroadcastChannel | null}
 */
function getChannel() {
    if (_channel) return _channel;
    if (typeof BroadcastChannel === 'undefined') return null;
    _channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
    return _channel;
}

/**
 * 현재 탭의 DomainState 스냅샷 맵
 * key: 개발자가 DomainState 생성 시 지정한 레이블 (없으면 자동 생성)
 * value: { label, data, changeLog, isNew, errors }
 *
 * @type {Map<string, object>}
 */
const _stateRegistry = new Map();

/**
 * DomainState 변경을 채널에 broadcast한다.
 * DomainState 내부에서 상태가 변할 때마다 호출한다.
 *
 * @param {string} label   - DomainState 식별 레이블
 * @param {object} snapshot - { data, changeLog, isNew, errors }
 */
export function broadcastUpdate(label, snapshot) {
    _stateRegistry.set(label, { label, ...snapshot });
    getChannel()?.postMessage({
        type:    MSG_TYPE.DS_UPDATE,
        tabId:   TAB_ID,
        tabUrl:  location.href,
        label,
        snapshot,
    });
}

/**
 * after() 핸들러 실패를 채널에 broadcast한다.
 *
 * @param {string} key
 * @param {Error}  error
 */
export function broadcastError(key, error) {
    getChannel()?.postMessage({
        type:   MSG_TYPE.DS_ERROR,
        tabId:  TAB_ID,
        tabUrl: location.href,
        key,
        error:  String(error),
    });
}

/**
 * 현재 탭을 채널에 등록한다.
 * 팝업이 ping을 보내면 pong으로 재등록한다.
 */
function registerTab() {
    getChannel()?.postMessage({
        type:   MSG_TYPE.TAB_REGISTER,
        tabId:  TAB_ID,
        tabUrl: location.href,
        states: Object.fromEntries(_stateRegistry),
    });
}

// 팝업의 ping에 응답해 탭 목록을 갱신
getChannel()?.addEventListener('message', ({ data }) => {
    if (data?.type === MSG_TYPE.TAB_PING) registerTab();
});

// 탭 닫힐 때 해제 신호 전송
window.addEventListener('beforeunload', () => {
    getChannel()?.postMessage({ type: MSG_TYPE.TAB_UNREGISTER, tabId: TAB_ID });
});

// 페이지 로드 시 자신을 등록
registerTab();


// ══════════════════════════════════════════════════════════════════════════════
// 디버그 팝업
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.
 * debug: true일 때만 동작한다.
 *
 * 팝업은 순수 JS로 HTML을 동적 생성하며 외부 리소스 없이 동작한다.
 */
export function openDebugPopup() {
    const popup = window.open('', DEBUG_POPUP_NAME, DEBUG_POPUP_FEATURES);
    if (!popup) {
        console.warn('[DSM] 팝업이 차단되었습니다. 브라우저 팝업 차단을 해제하세요.');
        return;
    }

    // 이미 초기화된 팝업이면 포커스만
    if (popup.document.getElementById('dsm-root')) {
        popup.focus();
        return;
    }

    popup.document.write(_buildPopupHTML());
    popup.document.close();

    // 팝업이 완전히 로드된 후 채널 연결
    popup.addEventListener('load', () => {
        _initPopupChannel(popup);
        // 현재 탭들의 상태 요청
        //getChannel()?.postMessage({ type: MSG_TYPE.TAB_PING });
    });
}

/**
 * 팝업 내부 HTML을 생성한다.
 * @returns {string}
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
  const tabs    = new Map(); // tabId → { tabUrl, states }
  let activeTab = null;
  const channel = new BroadcastChannel('dsm_debug');
  channel.postMessage({ type: 'TAB_PING' });

  channel.addEventListener('message', ({ data }) => {
    if (!data) return;

    if (data.type === 'TAB_REGISTER') {
      tabs.set(data.tabId, { url: data.tabUrl, states: data.states ?? {} });
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
      render();
    }
    if (data.type === 'DS_ERROR' && tabs.has(data.tabId)) {
      const tab = tabs.get(data.tabId);
      (tab.errors ??= []).push({ key: data.key, error: data.error });
      render();
    }
  });

  function render() {
    const tabBar = document.getElementById('tab-bar');
    const content = document.getElementById('content');
    document.getElementById('tab-count').textContent = \`\${tabs.size}개 탭\`;

    tabBar.innerHTML = [...tabs.entries()].map(([id, t]) =>
      \`<button class="tab-btn \${id === activeTab ? 'active' : ''}"
          onclick="activeTab='\${id}';render()">
        \${new URL(t.url).pathname}
      </button>\`
    ).join('');

    if (!activeTab || !tabs.has(activeTab)) {
      content.innerHTML = '<div id="empty">탭을 선택하세요</div>';
      return;
    }

    const { states, errors } = tabs.get(activeTab);
    const keys = Object.keys(states);

    if (!keys.length) { content.innerHTML = '<div id="empty">DomainState 없음</div>'; return; }

    content.innerHTML = keys.map(k => {
      const s = states[k];
      const badgeClass = s.isNew ? 'badge-new' : 'badge-exist';
      const badgeText  = s.isNew ? 'NEW' : 'EXIST';
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
<\/script>
</body>
</html>`;
}

/**
 * 팝업 창에 채널 수신 핸들러를 연결한다. (팝업 내 script가 자체 처리하므로 현재 미사용)
 * 향후 팝업 ↔ 부모 간 직접 통신이 필요할 때 확장 지점.
 *
 * @param {Window} _popup
 */
function _initPopupChannel(_popup) {
    // 팝업 내 BroadcastChannel이 자체적으로 수신 처리
}
