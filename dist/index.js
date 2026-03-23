var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var _installedPlugins;
const PREFIX = "[DSM]";
const ERR = Object.freeze({
  // ── URL ────────────────────────────────────────────────────────────────
  /** @param {string} host @param {string} baseURL */
  URL_CONFLICT: (host, baseURL) => `${PREFIX} host("${host}")와 baseURL("${baseURL}")이 충돌합니다. 둘 중 하나만 사용하세요.`,
  URL_MISSING: `${PREFIX} URL을 특정할 수 없습니다. save(path) 또는 baseURL/host를 설정하세요.`,
  /** @param {string} val */
  PROTOCOL_INVALID: (val) => `${PREFIX} 유효하지 않은 protocol 값: "${val}". HTTP | HTTPS | FILE | SSH 중 하나를 사용하세요.`,
  // ── DomainState 팩토리 ─────────────────────────────────────────────────
  /** @param {string} method */
  HANDLER_MISSING: (method) => `${PREFIX} DomainState.${method}(): ApiHandler가 주입되지 않았습니다. fromJSON / fromForm / fromVO의 두 번째 인자로 api를 전달하세요.`,
  FROM_VO_TYPE: `${PREFIX} DomainState.fromVO(): DomainVO 인스턴스를 전달해야 합니다.`,
  FROM_FORM_TYPE: `${PREFIX} DomainState.fromForm(): HTMLFormElement 또는 form id 문자열을 전달해야 합니다.`,
  /** @param {string} id */
  FORM_NOT_FOUND: (id) => `${PREFIX} DomainState.fromForm(): id="${id}"인 form 요소를 찾을 수 없습니다.`,
  // ── DomainState 동기화 ─────────────────────────────────────────────────
  /** @param {number} status */
  SAVE_ROLLBACK: (status) => `${PREFIX} save() HTTP ${status} 오류 — 서버 동기화 실패. 도메인 상태를 save() 호출 이전으로 롤백합니다.`,
  // ── DomainVO 정합성 ────────────────────────────────────────────────────
  /** @param {string} key */
  VO_SCHEMA_MISSING_KEY: (key) => `${PREFIX} DomainVO 정합성 오류: 응답 데이터에 VO 스키마의 "${key}" 필드가 없습니다.`,
  /** @param {string} key */
  VO_SCHEMA_EXTRA_KEY: (key) => `${PREFIX} DomainVO 정합성 경고: 응답 데이터에 VO 스키마에 없는 "${key}" 필드가 포함되어 있습니다.`,
  // ── 플러그인 ───────────────────────────────────────────────────────────
  PLUGIN_NO_INSTALL: `${PREFIX} DomainState.use(): 플러그인은 install(DomainState) 메서드를 가져야 합니다.`,
  // ── DomainPipeline ─────────────────────────────────────────────────────
  /** @param {string} key */
  PIPELINE_INVALID_KEY: (key) => `${PREFIX} DomainPipeline.after(): "${key}"는 등록되지 않은 리소스 키입니다. DomainState.all()에 전달한 키를 확인하세요.`,
  /** @param {string} key */
  PIPELINE_HANDLER_TYPE: (key) => `${PREFIX} DomainPipeline.after("${key}"): 핸들러는 함수여야 합니다.`,
  // ── Renderer (플러그인) ────────────────────────────────────────────────
  /** @param {string} id */
  RENDERER_CONTAINER_NOT_FOUND: (id) => `${PREFIX} renderTo(): id="${id}"인 컨테이너 요소를 찾을 수 없습니다.`,
  /** @param {string} type */
  RENDERER_TYPE_UNKNOWN: (type) => `${PREFIX} renderTo(): 지원하지 않는 type="${type}"입니다. select | radio | checkbox | button 중 하나를 사용하세요.`,
  RENDERER_VALUE_FIELD_MISSING: `${PREFIX} renderTo(): valueField는 필수 옵션입니다.`,
  RENDERER_LABEL_FIELD_MISSING: `${PREFIX} renderTo(): labelField는 필수 옵션입니다.`,
  /** @param {string} key */
  RENDERER_DATA_NOT_ARRAY: (key) => `${PREFIX} renderTo(): DomainState.data가 배열이 아닙니다. renderTo()는 배열 형태의 DomainState에서만 사용할 수 있습니다. (key: "${key}")`
});
const WARN = Object.freeze({
  // ── URL 충돌 해소 ──────────────────────────────────────────────────────
  /** @param {string} host @param {string} baseURL */
  URL_HOST_IGNORED: (host, baseURL) => `${PREFIX}[경고] host("${host}")를 무시하고 baseURL("${baseURL}")을 우선 사용합니다.`,
  /** @param {string} baseURL @param {string} resolved */
  URL_BASE_PATH_FIXED: (baseURL, resolved) => `${PREFIX}[경고] baseURL("${baseURL}")의 시작이 host와 같아 basePath("${resolved}")로 해석했습니다. 의도대로 동작했다면 다음부터는 basePath를 사용하세요.`
});
const OP = Object.freeze({
  /** 프로퍼티 신규 추가 */
  ADD: "add",
  /** 기존 프로퍼티 값 교체 */
  REPLACE: "replace",
  /** 프로퍼티 삭제 */
  REMOVE: "remove"
});
const LOG = Object.freeze({
  proxy: Object.freeze({
    /** Proxy set 트랩 — add / replace / remove 공통 */
    [OP.ADD]: "[DSM][Proxy][add]     path: {path} | newValue: {newValue}",
    [OP.REPLACE]: "[DSM][Proxy][replace] path: {path} | oldValue: {oldValue} → {newValue}",
    [OP.REMOVE]: "[DSM][Proxy][remove]  path: {path} | oldValue: {oldValue}",
    /** get 트랩 — deep proxy 진입 */
    deepProxy: "[DSM][Proxy][get]     deep proxy 진입 | path: {path}"
  }),
  url: Object.freeze({
    resolved: "[DSM][URL] 최종 URL → {url}",
    hostIgnored: "[DSM][URL] host 무시, baseURL 우선 → {url}",
    basePathFixed: "[DSM][URL] baseURL → basePath 해석 | basePath: {basePath}"
  }),
  pipeline: Object.freeze({
    fetchStart: "[DSM][Pipeline] 병렬 fetch 시작 | keys: {keys}",
    fetchDone: "[DSM][Pipeline] 병렬 fetch 완료",
    afterStart: "[DSM][Pipeline] after 핸들러 실행 | key: {key}",
    afterDone: "[DSM][Pipeline] after 핸들러 완료 | key: {key}",
    afterError: "[DSM][Pipeline] after 핸들러 실패 | key: {key} | error: {error}"
  })
});
function formatMessage(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in values)) return `{${key}}`;
    const val = values[key];
    if (val === null || val === void 0) return String(val);
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  });
}
const DEBUG_CHANNEL_NAME = "dsm_debug";
const MSG_TYPE = Object.freeze({
  TAB_REGISTER: "TAB_REGISTER",
  TAB_UNREGISTER: "TAB_UNREGISTER",
  TAB_PING: "TAB_PING",
  DS_UPDATE: "DS_UPDATE",
  DS_ERROR: "DS_ERROR"
});
const DEBUG_POPUP_NAME = "dsm_debugger";
const DEBUG_POPUP_FEATURES = "width=520,height=700,resizable=yes,scrollbars=yes";
const TAB_ID = `dsm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let _channel = null;
const _stateRegistry = /* @__PURE__ */ new Map();
function getChannel() {
  if (_channel) return _channel;
  if (typeof BroadcastChannel === "undefined") return null;
  _channel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
  return _channel;
}
function registerTab() {
  var _a;
  (_a = getChannel()) == null ? void 0 : _a.postMessage(
    /** @type {TabRegisterMessage} */
    {
      type: MSG_TYPE.TAB_REGISTER,
      tabId: TAB_ID,
      tabUrl: location.href,
      states: Object.fromEntries(_stateRegistry)
    }
  );
}
let _initialized = false;
function initDebugChannel() {
  var _a;
  if (typeof window === "undefined") return;
  if (_initialized) return;
  _initialized = true;
  (_a = getChannel()) == null ? void 0 : _a.addEventListener("message", ({ data }) => {
    if ((data == null ? void 0 : data.type) === MSG_TYPE.TAB_PING) registerTab();
  });
  window.addEventListener("beforeunload", () => {
    var _a2;
    (_a2 = getChannel()) == null ? void 0 : _a2.postMessage(
      /** @type {TabUnregisterMessage} */
      {
        type: MSG_TYPE.TAB_UNREGISTER,
        tabId: TAB_ID
      }
    );
  });
  registerTab();
}
function closeDebugChannel() {
  if (_channel) {
    _channel.postMessage(
      /** @type {TabUnregisterMessage} */
      {
        type: MSG_TYPE.TAB_UNREGISTER,
        tabId: TAB_ID
      }
    );
    _channel.close();
    _channel = null;
    console.debug("[DSM] Debug BroadcastChannel closed.");
  }
}
function broadcastUpdate(label, snapshot) {
  var _a;
  if (typeof window === "undefined") return;
  initDebugChannel();
  _stateRegistry.set(label, { label, ...snapshot });
  (_a = getChannel()) == null ? void 0 : _a.postMessage(
    /** @type {DsUpdateMessage} */
    {
      type: MSG_TYPE.DS_UPDATE,
      tabId: TAB_ID,
      tabUrl: location.href,
      label,
      snapshot
    }
  );
}
function broadcastError(key, error) {
  var _a;
  if (typeof window === "undefined") return;
  (_a = getChannel()) == null ? void 0 : _a.postMessage(
    /** @type {DsErrorMessage} */
    {
      type: MSG_TYPE.DS_ERROR,
      tabId: TAB_ID,
      tabUrl: location.href,
      key,
      error: String(error)
    }
  );
}
function openDebugPopup() {
  const popup = window.open("", DEBUG_POPUP_NAME, DEBUG_POPUP_FEATURES);
  if (!popup) {
    console.warn("[DSM] 팝업이 차단되었습니다. 브라우저 팝업 차단을 해제하세요.");
    return;
  }
  if (popup.document.getElementById("dsm-root")) {
    popup.focus();
    return;
  }
  popup.document.write(_buildPopupHTML());
  popup.document.close();
  popup.addEventListener("load", () => {
  });
}
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
class DomainPipeline {
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
    this._resourceMap = resourceMap;
    this._strict = strict;
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
    if (typeof handler !== "function") throw new TypeError(ERR.PIPELINE_HANDLER_TYPE(key));
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
    const errors = [];
    console.debug(formatMessage(LOG.pipeline.fetchStart, { keys: keys.join(", ") }));
    const settled = await Promise.allSettled(keys.map((k) => this._resourceMap[k]));
    const resolved = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const result = settled[i];
      if (result.status === "fulfilled") {
        resolved[key] = result.value;
      } else {
        errors.push({ key, error: result.reason });
        if (this._strict) throw result.reason;
        broadcastError(key, result.reason);
        console.error(`[DSM][Pipeline] fetch 실패 | key: ${key}`, result.reason);
      }
    }
    console.debug(LOG.pipeline.fetchDone);
    for (const { key, handler } of this._queue) {
      const state = resolved[key];
      if (!state) {
        errors.push({
          key,
          error: new Error(`fetch 실패로 인해 "${key}" 핸들러를 건너뜁니다.`)
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
    const output = { ...resolved };
    if (errors.length > 0) output._errors = errors;
    return output;
  }
}
const TYPEOF = Object.freeze({
  UNDEFINED: "undefined",
  OBJECT: "object",
  BOOLEAN: "boolean",
  NUMBER: "number",
  BIGINT: "bigint",
  STRING: "string",
  SYMBOL: "symbol",
  FUNCTION: "function"
});
const TOSTRING_TAG = Object.freeze({
  OBJECT: "[object Object]",
  ARRAY: "[object Array]",
  DATE: "[object Date]",
  REGEXP: "[object RegExp]",
  MAP: "[object Map]",
  SET: "[object Set]",
  PROMISE: "[object Promise]",
  FUNCTION: "[object Function]",
  NULL: "[object Null]",
  UNDEFINED: "[object Undefined]",
  NUMBER: "[object Number]",
  STRING: "[object String]",
  BOOLEAN: "[object Boolean]"
});
const getToStringTag = (value) => Object.prototype.toString.call(value);
const isArray = (value) => Array.isArray(value);
const isPlainObject = (value) => {
  if (value === null || typeof value !== TYPEOF.OBJECT) return false;
  if (getToStringTag(value) !== TOSTRING_TAG.OBJECT) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
const shouldBypassDeepProxy = (prop) => {
  if (typeof prop === TYPEOF.SYMBOL) return true;
  if (prop === "toJSON") return true;
  if (prop === "then") return true;
  if (prop === "valueOf") return true;
  return false;
};
function _setNestedValue(target, keys, value) {
  let cursor = (
    /** @type {any} */
    target
  );
  for (let i = 0; i < keys.length - 1; i++) {
    if (cursor[keys[i]] == null || typeof cursor[keys[i]] !== "object") {
      cursor[keys[i]] = {};
    }
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = value;
}
function createProxy(domainObject, onMutate = null) {
  const changeLog = [];
  const proxyCache = /* @__PURE__ */ new WeakMap();
  let isMuting = false;
  const dirtyFields = /* @__PURE__ */ new Set();
  const ON_MUTATIONS = ["shift", "unshift", "splice", "sort", "reverse"];
  function record(op, path, oldValue, newValue) {
    if (isMuting) return;
    const entry = { op, path };
    if (op !== OP.REMOVE) entry.newValue = newValue;
    if (op !== OP.ADD) entry.oldValue = oldValue;
    changeLog.push(entry);
    const topLevelKey = path.split("/")[1];
    if (topLevelKey) dirtyFields.add(topLevelKey);
    console.debug(formatMessage(LOG.proxy[op], { path, oldValue, newValue }));
    if (onMutate) onMutate();
  }
  function makeHandler(basePath) {
    return {
      /**
       * `set` 트랩 — 프로퍼티 신규 추가(`add`) 또는 값 교체(`replace`)를 기록한다.
       *
       * ## 처리 순서
       * 1. `Reflect.get`으로 현재 값을 읽어 No-op 여부를 판단한다.
       * 2. 완전히 동일한 값이면(`===`) 기록 없이 `true`를 반환한다.
       * 3. 배열의 `length` 변경은 `ON_MUTATIONS` 래퍼가 이미 제어하므로 추적하지 않는다.
       * 4. `Reflect.set`으로 실제 값을 반영한 뒤 `record()`한다.
       *
       * Proxy 명세: strict mode에서 `false`를 반환하면 `TypeError`가 발생하므로
       * 성공 여부와 무관하게 반드시 `boolean`을 반환해야 한다.
       *
       * @param {object}          target   - Proxy가 감싸고 있는 원본 객체
       * @param {string | symbol} prop     - 설정하려는 프로퍼티 키
       * @param {*}               value    - 설정할 새 값
       * @param {object}          receiver - 원본 Proxy 또는 상속 객체
       * @returns {boolean} `Reflect.set`의 성공 여부
       */
      set(target, prop, value, receiver) {
        const currentValue = Reflect.get(target, prop, receiver);
        if (currentValue === value) return true;
        const path = `${basePath}/${String(prop)}`;
        const hasOwn = Object.prototype.hasOwnProperty.call(target, prop);
        const oldValue = hasOwn ? currentValue : void 0;
        const op = hasOwn ? OP.REPLACE : OP.ADD;
        if (Array.isArray(target) && prop === "length") {
          return Reflect.set(target, prop, value, receiver);
        }
        const ok = Reflect.set(target, prop, value, receiver);
        if (ok) record(op, path, oldValue, value);
        return ok;
      },
      /**
       * `get` 트랩 — deep proxy 적용 및 `ON_MUTATIONS` 배열 메서드 하이재킹.
       *
       * ## 처리 순서
       * 1. `shouldBypassDeepProxy(prop)`이 `true`이면 그대로 반환한다.
       *    (Symbol 프로퍼티, `toJSON`, `then`, `valueOf` — JSON.stringify/Promise 호환성 보존)
       * 2. 배열 대상 `ON_MUTATIONS` 메서드이면 래퍼 함수를 반환한다.
       *    래퍼는 `isMuting`으로 set 트랩을 차단한 뒤 원본 메서드를 실행하고,
       *    메서드별 정확한 Delta 로그를 `record()`에 기록한다.
       * 3. 반환값이 plain object 또는 배열이면:
       *    - `proxyCache`에 캐시된 Proxy가 있으면 그것을 반환한다 (Lazy Proxying).
       *    - 없으면 새 Proxy를 생성해 캐시에 등록한 뒤 반환한다.
       * 4. 나머지(원시값, 함수 등)는 `Reflect.get` 결과를 그대로 반환한다.
       *
       * @param {object}          target   - Proxy가 감싸고 있는 원본 객체
       * @param {string | symbol} prop     - 접근하려는 프로퍼티 키
       * @param {object}          receiver - 원본 Proxy 또는 상속 객체
       * @returns {*} 프로퍼티 값 또는 deep proxy 또는 배열 메서드 래퍼 함수
       */
      get(target, prop, receiver) {
        if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver);
        if (Array.isArray(target) && ON_MUTATIONS.includes(
          /** @type {string} */
          prop
        )) {
          return (...args) => {
            const oldArray = [...target];
            isMuting = true;
            const result = (
              /** @type {any} */
              Array.prototype[
                /** @type {any} */
                prop
              ].apply(target, args)
            );
            isMuting = false;
            switch (prop) {
              case "shift":
                record(OP.REMOVE, `${basePath}/0`, oldArray[0], void 0);
                break;
              case "unshift":
                args.forEach((el, idx) => {
                  record(OP.ADD, `${basePath}/${idx}`, void 0, el);
                });
                break;
              case "splice": {
                const startIdx = args[0] < 0 ? Math.max(oldArray.length + args[0], 0) : Math.min(args[0], oldArray.length);
                result.forEach(
                  (deletedItem) => {
                    record(
                      OP.REMOVE,
                      `${basePath}/${startIdx}`,
                      deletedItem,
                      void 0
                    );
                  }
                );
                const addedItems = args.slice(2);
                addedItems.forEach(
                  (addedItem, idx) => {
                    record(
                      OP.ADD,
                      `${basePath}/${startIdx + idx}`,
                      void 0,
                      addedItem
                    );
                  }
                );
                break;
              }
              case "sort":
              case "reverse":
                record(OP.REPLACE, basePath, oldArray, [...target]);
                break;
            }
            return result;
          };
        }
        const value = Reflect.get(target, prop, receiver);
        if (isPlainObject(value) || isArray(value)) {
          if (proxyCache.has(value)) {
            return proxyCache.get(value);
          }
          const childPath = `${basePath}/${String(prop)}`;
          console.debug(formatMessage(LOG.proxy.deepProxy, { path: childPath }));
          const childProxy = new Proxy(value, makeHandler(childPath));
          proxyCache.set(value, childProxy);
          return childProxy;
        }
        return value;
      },
      /**
       * `deleteProperty` 트랩 — 프로퍼티 삭제(`remove`)를 기록한다.
       *
       * 존재하지 않는 키에 대한 삭제는 Proxy 명세에 따라 조용히 `true`를 반환한다.
       * `Reflect.get`으로 삭제 전 값을 읽어 `oldValue`로 기록한다.
       *
       * @param {object}          target - Proxy가 감싸고 있는 원본 객체
       * @param {string | symbol} prop   - 삭제할 프로퍼티 키
       * @returns {boolean} `Reflect.deleteProperty`의 성공 여부
       */
      deleteProperty(target, prop) {
        if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;
        const path = `${basePath}/${String(prop)}`;
        const oldVal = Reflect.get(target, prop);
        const ok = Reflect.deleteProperty(target, prop);
        if (ok) record(OP.REMOVE, path, oldVal, void 0);
        return ok;
      }
    };
  }
  return {
    /**
     * 변경 추적이 활성화된 Proxy 객체.
     * DomainState 외부에서 도메인 데이터에 접근하는 유일한 공개 진입점.
     * @type {object}
     */
    proxy: new Proxy(domainObject, makeHandler("")),
    /**
     * 현재 변경 이력의 얕은 복사본을 반환한다.
     * 얕은 복사를 반환함으로써 외부에서 `changeLog` 배열을 직접 변조하는 것을 방지한다.
     * @type {() => ChangeLogEntry[]}
     */
    getChangeLog: () => [...changeLog],
    /**
     * 변경이 누적된 원본 객체를 반환한다.
     * `toPayload()` / `toPatch()` 직렬화 시 이 함수를 통해 읽는다.
     * @type {() => object}
     */
    getTarget: () => domainObject,
    /**
     * 변경 이력 배열을 비운다.
     * `DomainState.save()` 성공 직후 호출하여 이력을 초기화한다.
     * `void` 표현식으로 배열의 `length`를 0으로 리셋한다.
     * @type {() => void}
     */
    clearChangeLog: () => void (changeLog.length = 0),
    /**
     * 변경된 최상위 키(top-level key) 집합의 읽기 전용 뷰를 반환한다.
     *
     * `DomainState.save()`에서 `dirtyFields.size / totalFields` 비율로
     * PUT / PATCH 분기를 결정하는 데 사용한다.
     * 외부 변조를 막기 위해 원본 Set이 아닌 새 Set 복사본을 반환한다.
     *
     * @type {() => Set<string>}
     */
    getDirtyFields: () => new Set(dirtyFields),
    /**
     * 변경된 최상위 키 집합을 비운다.
     * `clearChangeLog()`와 함께 `DomainState.save()` 성공 직후 반드시 쌍으로 호출해야 한다.
     * 둘 중 하나만 초기화하면 다음 save() 호출 시 분기 판단이 오염된다.
     *
     * @type {() => void}
     */
    clearDirtyFields: () => dirtyFields.clear(),
    /**
     * `domainObject`의 프로퍼티를 스냅샷 데이터로 직접 복원한다.
     *
     * Proxy 객체가 아닌 원본 `domainObject`에 직접 접근하여
     * 이 복원 작업 자체가 `changeLog`나 `dirtyFields`에 기록되지 않도록 한다.
     * `DomainState._rollback()` 에서만 호출한다.
     *
     * ## Array 루트 처리
     * `domainObject`가 배열인 경우 `Object.keys` + `delete` + `Object.assign` 방식은
     * `length` 복원이 보장되지 않으므로 `splice(0)`으로 전체를 비운 뒤
     * `push(...data)`로 채운다.
     *
     * @param {object|Array<any>} data - `structuredClone(getTarget())` 로 만든 스냅샷 데이터
     * @returns {void}
     */
    restoreTarget: (data) => {
      if (Array.isArray(domainObject)) {
        domainObject.splice(0);
        domainObject.push(.../** @type {any[]} */
        data);
      } else {
        for (const key of Object.keys(domainObject)) {
          Reflect.deleteProperty(domainObject, key);
        }
        Object.assign(domainObject, data);
      }
    },
    /**
     * `changeLog` 배열을 스냅샷 항목으로 통째로 교체한다.
     *
     * 길이를 0으로 리셋한 뒤 스냅샷의 항목들을 순서대로 다시 채운다.
     * 배열 참조를 유지하면서 내용만 교체하는 방식이다.
     *
     * @param {ChangeLogEntry[]} entries - save() 진입 직전에 getChangeLog()로 확보한 얕은 복사본
     * @returns {void}
     */
    restoreChangeLog: (entries) => {
      changeLog.length = 0;
      changeLog.push(...entries);
    },
    /**
     * `dirtyFields` Set을 스냅샷 키 집합으로 통째로 교체한다.
     *
     * @param {Set<string>} fields - save() 진입 직전에 getDirtyFields()로 확보한 복사본
     * @returns {void}
     */
    restoreDirtyFields: (fields) => {
      dirtyFields.clear();
      fields.forEach((k) => dirtyFields.add(k));
    }
  };
}
function toDomain(jsonText, onMutate = null) {
  return createProxy(JSON.parse(jsonText), onMutate);
}
function toPayload(getTargetFn) {
  return JSON.stringify(getTargetFn());
}
function toPatch(getChangeLogFn) {
  return getChangeLogFn().map(({ op, path, newValue }) => {
    const patch = { op, path };
    if (op !== OP.REMOVE) patch.value = newValue;
    return patch;
  });
}
const PROTOCOL = Object.freeze({
  HTTP: "http://",
  HTTPS: "https://",
  FILE: "file:///",
  SSH: "ssh://"
});
const ENV = Object.freeze({
  DEVELOPMENT: "development",
  PRODUCTION: "production"
});
const DEFAULT_PROTOCOL = Object.freeze({
  [ENV.DEVELOPMENT]: PROTOCOL.HTTP,
  [ENV.PRODUCTION]: PROTOCOL.HTTPS
});
const VALID_PROTOCOL_KEYS = Object.freeze(Object.keys(PROTOCOL));
function normalizeUrlConfig(config = {}) {
  let { protocol, host, basePath = "", baseURL, env, debug = false } = config;
  if (host && baseURL) {
    if (baseURL.startsWith(host)) {
      const extracted = baseURL.slice(host.length) || "/";
      console.warn(WARN.URL_BASE_PATH_FIXED(baseURL, extracted));
      basePath = extracted;
      baseURL = void 0;
    } else if (baseURL.includes(host)) {
      console.warn(WARN.URL_HOST_IGNORED(host, baseURL));
      host = void 0;
    } else {
      throw new Error(ERR.URL_CONFLICT(host, baseURL));
    }
  }
  if (baseURL && !host) {
    const withoutProto = baseURL.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "");
    const slashIdx = withoutProto.indexOf("/");
    if (slashIdx === -1) {
      host = withoutProto;
      basePath = "";
    } else {
      host = withoutProto.slice(0, slashIdx);
      basePath = withoutProto.slice(slashIdx);
    }
  }
  const resolvedProtocol = resolveProtocol({ protocol, env, debug });
  return {
    protocol: resolvedProtocol,
    host: host ?? "",
    basePath: normalizePath(basePath)
  };
}
function resolveProtocol({ protocol, env, debug = false } = {}) {
  if (protocol) {
    const key = protocol.toUpperCase();
    if (!VALID_PROTOCOL_KEYS.includes(key)) throw new Error(ERR.PROTOCOL_INVALID(protocol));
    return (
      /** @type {any} */
      PROTOCOL[key]
    );
  }
  if (env) {
    return DEFAULT_PROTOCOL[env] ?? DEFAULT_PROTOCOL[ENV.DEVELOPMENT];
  }
  return debug ? PROTOCOL.HTTP : PROTOCOL.HTTPS;
}
function buildURL(normalized, requestPath = "") {
  const { protocol, host, basePath } = normalized;
  if (!host && !requestPath) throw new Error(ERR.URL_MISSING);
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(requestPath)) {
    console.debug(formatMessage(LOG.url.resolved, { url: requestPath }));
    return requestPath;
  }
  const parts = [protocol, host, normalizePath(basePath), normalizePath(requestPath)].filter(
    Boolean
  );
  const url = parts.map((p, i) => {
    if (i === 0) return p.replace(/\/$/, "");
    return p.replace(/^\//, "").replace(/\/$/, "");
  }).filter(Boolean).join("/");
  console.debug(formatMessage(LOG.url.resolved, { url }));
  return url;
}
function normalizePath(path = "") {
  if (!path) return "";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailing = withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
  return withoutTrailing;
}
const DIRTY_THRESHOLD = 0.7;
class DomainVO {
  /**
   * 서브클래스에서 선언한 `static fields`를 기반으로 기본값 골격 객체를 생성한다.
   *
   * `DomainState.fromVO()` 내부에서 `createProxy()`의 초기 입력 객체로 사용된다.
   *
   * ## 처리 규칙
   * 1. `static fields`가 없으면 인스턴스의 own property를 얕은 복사(`{ ...this }`)로 반환.
   * 2. `static fields`가 있으면 각 필드의 `default` 값으로 객체를 구성한다.
   * 3. `default`가 없으면 `''` (빈 문자열)을 사용한다.
   * 4. `default`가 `object` 또는 `array`이면 `JSON.parse(JSON.stringify(val))`로 deep copy.
   *    인스턴스마다 독립적인 참조를 갖도록 하여 상태 공유 버그를 방지한다.
   *
   * @returns {object} `static fields`의 `default` 값으로 구성된 초기 객체
   *
   * @example <caption>기본 사용</caption>
   * class UserVO extends DomainVO {
   *     static fields = {
   *         name:    { default: '' },
   *         age:     { default: 0 },
   *         address: { default: { city: '', zip: '' } },
   *     };
   * }
   * new UserVO().toSkeleton();
   * // → { name: '', age: 0, address: { city: '', zip: '' } }
   * // address는 deep copy이므로 인스턴스마다 독립적인 객체
   *
   * @example <caption>static fields 미선언 시</caption>
   * class SimpleVO extends DomainVO {}
   * const vo = new SimpleVO();
   * vo.userId = 'u1';
   * vo.toSkeleton(); // → { userId: 'u1' }  (own property 얕은 복사)
   */
  toSkeleton() {
    const schema = (
      /** @type {FieldsSchema | undefined} */
      /** @type {any} */
      this.constructor.fields
    );
    if (!schema) {
      return { ...this };
    }
    return Object.fromEntries(
      Object.entries(schema).map(([key, def]) => {
        const val = def.default ?? "";
        return [
          key,
          val !== null && typeof val === "object" ? JSON.parse(JSON.stringify(val)) : val
          // 원시값: 그대로
        ];
      })
    );
  }
  /**
   * `static fields`에서 `validate` 함수를 추출하여 필드명 → 함수 맵으로 반환한다.
   *
   * `DomainState.fromVO()` 내부에서 호출되어 `DomainState._validators`에 주입된다.
   * `validate` 없는 필드는 포함되지 않는다.
   *
   * @returns {ValidatorMap} `{ 필드명: (value) => boolean }` 맵. `static fields` 미선언 시 빈 객체.
   *
   * @example
   * class ProductVO extends DomainVO {
   *     static fields = {
   *         name:  { default: '', validate: v => v.trim().length > 0 },
   *         price: { default: 0,  validate: v => v >= 0 },
   *         tags:  { default: [] },  // validate 없음 → 맵에 포함되지 않음
   *     };
   * }
   * new ProductVO().getValidators();
   * // → { name: [Function], price: [Function] }
   */
  getValidators() {
    const schema = (
      /** @type {FieldsSchema | undefined} */
      /** @type {any} */
      this.constructor.fields
    );
    if (!schema) return {};
    return (
      /** @type {ValidatorMap} */
      Object.fromEntries(
        Object.entries(schema).filter(([, def]) => typeof def.validate === "function").map(([key, def]) => [key, def.validate])
      )
    );
  }
  /**
   * `static fields`에서 `transform` 함수를 추출하여 필드명 → 함수 맵으로 반환한다.
   *
   * `DomainState.fromVO()` 내부에서 호출되어 `DomainState._transformers`에 주입된다.
   * `toPayload()` 직렬화 직전에 실행되어 각 필드 값을 변환한다.
   * `transform` 없는 필드는 포함되지 않는다.
   *
   * @returns {TransformerMap} `{ 필드명: (value) => * }` 맵. `static fields` 미선언 시 빈 객체.
   *
   * @example
   * class OrderVO extends DomainVO {
   *     static fields = {
   *         quantity: { default: '0', transform: Number },  // 문자열 입력 → 숫자 변환
   *         note:     { default: '' , transform: v => v.trim() }, // 공백 제거
   *         orderId:  { default: '' }, // transform 없음 → 맵에 포함되지 않음
   *     };
   * }
   * new OrderVO().getTransformers();
   * // → { quantity: [Function: Number], note: [Function] }
   */
  getTransformers() {
    const schema = (
      /** @type {FieldsSchema | undefined} */
      /** @type {any} */
      this.constructor.fields
    );
    if (!schema) return {};
    return (
      /** @type {TransformerMap} */
      Object.fromEntries(
        Object.entries(schema).filter(([, def]) => typeof def.transform === "function").map(([key, def]) => [key, def.transform])
      )
    );
  }
  /**
   * 서브클래스에 선언된 `static baseURL`을 반환한다.
   * 미선언이면 `null`을 반환한다.
   *
   * `DomainState.fromVO()`에서 `options.urlConfig`가 없을 때 폴백 URL로 사용된다.
   * `normalizeUrlConfig({ baseURL: vo.getBaseURL() })`로 정규화되어 `DomainState._urlConfig`에 저장된다.
   *
   * @returns {string | null} `static baseURL` 값 또는 `null`
   *
   * @example <caption>baseURL 선언 시</caption>
   * class UserVO extends DomainVO {
   *     static baseURL = 'localhost:8080/api/users';
   * }
   * new UserVO().getBaseURL(); // → 'localhost:8080/api/users'
   *
   * // DomainState.fromVO() 내부에서:
   * // urlConfig 미입력 → normalizeUrlConfig({ baseURL: 'localhost:8080/api/users' })
   * // → { protocol: 'http://', host: 'localhost:8080', basePath: '/api/users' }
   *
   * @example <caption>baseURL 미선언 시</caption>
   * class SimpleVO extends DomainVO {}
   * new SimpleVO().getBaseURL(); // → null
   * // → DomainState.fromVO() 에서 urlConfig는 null → handler.getUrlConfig() 폴백
   */
  getBaseURL() {
    return (
      /** @type {string | null} */
      /** @type {any} */
      this.constructor.baseURL ?? null
    );
  }
  /**
   * REST API 응답 데이터가 이 VO의 스키마(`static fields`)와 일치하는지 검증한다.
   *
   * `DomainState.fromJSON()` 에 `vo` 옵션을 함께 넘기면 내부적으로 호출된다.
   * 불일치 항목은 콘솔에 경고/에러를 출력하지만 실행을 중단하지는 않는다.
   *
   * ## 검증 결과 해석
   * - `missingKeys.length > 0` → VO에 선언됐지만 응답에 없음 → `valid: false`
   *   (서버 API 응답 구조가 변경됐거나, VO 선언이 잘못된 경우)
   * - `extraKeys.length > 0`   → 응답에 있지만 VO에 없음 → `valid: true` (경고만)
   *   (서버가 추가 필드를 내려주는 경우, 무시해도 무방)
   *
   * ## 콘솔 출력
   * - `missingKeys`: `console.error(ERR.VO_SCHEMA_MISSING_KEY(k))` — 각 키마다 에러
   * - `extraKeys`:   `console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k))`   — 각 키마다 경고
   *
   * @param {object} data - `DomainState._getTarget()`으로 읽은 REST API 응답 데이터 객체
   * @returns {SchemaCheckResult} `{ valid, missingKeys, extraKeys }`
   *
   * @example <caption>fromJSON()과 함께 사용</caption>
   * const user = DomainState.fromJSON(jsonText, api, { vo: new UserVO() });
   * // 스키마 불일치 시 콘솔에 에러/경고 출력, 실행은 계속
   *
   * @example <caption>직접 호출</caption>
   * const result = new UserVO().checkSchema({ userId: 'u1', name: 'Davi', extra: 'unknown' });
   * // result.valid        → true  (missingKeys 없음)
   * // result.missingKeys  → []
   * // result.extraKeys    → ['extra']  → 콘솔 경고
   *
   * @example <caption>static fields 미선언 시</caption>
   * class SimpleVO extends DomainVO {}
   * new SimpleVO().checkSchema({ anything: 1 });
   * // → { valid: true, missingKeys: [], extraKeys: [] }  (검증 스킵)
   */
  checkSchema(data) {
    const schema = (
      /** @type {FieldsSchema | undefined} */
      /** @type {any} */
      this.constructor.fields
    );
    if (!schema) return { valid: true, missingKeys: [], extraKeys: [] };
    const schemaKeys = Object.keys(schema);
    const dataKeys = Object.keys(data);
    const missingKeys = schemaKeys.filter((k) => !dataKeys.includes(k));
    const extraKeys = dataKeys.filter((k) => !schemaKeys.includes(k));
    missingKeys.forEach((k) => console.error(ERR.VO_SCHEMA_MISSING_KEY(k)));
    extraKeys.forEach((k) => console.warn(ERR.VO_SCHEMA_EXTRA_KEY(k)));
    return {
      valid: missingKeys.length === 0,
      missingKeys,
      extraKeys
    };
  }
}
const _DomainState = class _DomainState {
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
    if (typeof (plugin == null ? void 0 : plugin.install) !== "function") {
      throw new TypeError(ERR.PLUGIN_NO_INSTALL);
    }
    if (!__privateGet(_DomainState, _installedPlugins).has(plugin)) {
      plugin.install(_DomainState);
      __privateGet(_DomainState, _installedPlugins).add(plugin);
    }
    return _DomainState;
  }
  /**
   * 여러 `DomainState`를 병렬로 fetch하고, 후처리 핸들러를 순서대로 체이닝하는
   * `DomainPipeline` 인스턴스를 반환한다.
   *
   * 내부적으로 `DomainState.PipelineConstructor`를 통해 `DomainPipeline`을 생성한다.
   * `rest-domain-state-manager.js` 진입점을 통해 `PipelineConstructor`가 주입되지 않으면
   * 즉시 `Error`를 throw한다.
   *
   * @param {ResourceMap}    resourceMap - 키: 리소스 식별자, 값: `Promise<DomainState>`
   * @param {PipelineOptions} [options]  - 파이프라인 실행 옵션
   * @returns {import('./DomainPipeline.js').DomainPipeline} 체이닝 가능한 파이프라인 인스턴스
   * @throws {Error} `PipelineConstructor`가 주입되지 않은 경우
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
    if (!_DomainState.PipelineConstructor) {
      throw new Error(
        "[DSM] DomainPipeline이 주입되지 않았습니다. rest-domain-state-manager.js 진입점을 사용하세요."
      );
    }
    return new _DomainState.PipelineConstructor(resourceMap, options);
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
    this._proxy = proxyWrapper.proxy;
    this._getChangeLog = proxyWrapper.getChangeLog;
    this._getTarget = proxyWrapper.getTarget;
    this._clearChangeLog = proxyWrapper.clearChangeLog;
    this._pendingFlush = false;
    this._getDirtyFields = proxyWrapper.getDirtyFields;
    this._clearDirtyFields = proxyWrapper.clearDirtyFields;
    this._restoreTarget = proxyWrapper.restoreTarget;
    this._restoreChangeLog = proxyWrapper.restoreChangeLog;
    this._restoreDirtyFields = proxyWrapper.restoreDirtyFields;
    this._handler = options.handler ?? null;
    this._urlConfig = options.urlConfig ?? null;
    this._isNew = options.isNew ?? false;
    this._debug = options.debug ?? false;
    this._label = options.label ?? `ds_${Date.now()}`;
    this._validators = options.validators ?? {};
    this._transformers = options.transformers ?? {};
    this._errors = [];
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
  static fromJSON(jsonText, handler, { urlConfig = null, debug = false, label = null, vo = null } = {}) {
    let state = null;
    const wrapper = toDomain(jsonText, () => {
      state == null ? void 0 : state._scheduleFlush();
    });
    state = new _DomainState(wrapper, {
      handler,
      urlConfig,
      isNew: false,
      debug,
      label: label ?? `json_${Date.now()}`
    });
    if (vo instanceof DomainVO) {
      const { valid } = vo.checkSchema(wrapper.getTarget());
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
    const resolvedUrlConfig = urlConfig ?? (vo.getBaseURL() ? normalizeUrlConfig({ baseURL: vo.getBaseURL() ?? void 0, debug }) : null);
    let state = null;
    const wrapper = createProxy(vo.toSkeleton(), () => {
      state == null ? void 0 : state._scheduleFlush();
    });
    state = new _DomainState(wrapper, {
      handler,
      urlConfig: resolvedUrlConfig,
      isNew: true,
      debug,
      label: label ?? vo.constructor.name,
      validators: vo.getValidators(),
      transformers: vo.getTransformers()
    });
    return state;
  }
  // ════════════════════════════════════════════════════════════════════════════
  // 외부 인터페이스
  // ════════════════════════════════════════════════════════════════════════════
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
    const handler = this._assertHandler("save");
    const url = this._resolveURL(requestPath);
    const snapshot = {
      data: structuredClone(this._getTarget()),
      changeLog: this._getChangeLog(),
      // 이미 얕은 복사본 반환
      dirtyFields: this._getDirtyFields(),
      // 이미 new Set 복사본 반환
      isNew: this._isNew
    };
    try {
      if (this._isNew) {
        await handler._fetch(url, {
          method: "POST",
          body: toPayload(this._getTarget)
        });
        this._isNew = false;
      } else {
        const dirtyFields = this._getDirtyFields();
        const totalFields = Object.keys(this._getTarget()).length;
        const dirtyRatio = totalFields > 0 ? dirtyFields.size / totalFields : 0;
        if (dirtyFields.size === 0 || dirtyRatio >= DIRTY_THRESHOLD) {
          await handler._fetch(url, {
            method: "PUT",
            body: toPayload(this._getTarget)
          });
        } else {
          await handler._fetch(url, {
            method: "PATCH",
            body: JSON.stringify(toPatch(this._getChangeLog))
          });
        }
      }
      this._clearChangeLog();
      this._clearDirtyFields();
      if (this._debug) this._broadcast();
    } catch (err) {
      console.warn(ERR.SAVE_ROLLBACK(
        /** @type {any} */
        (err == null ? void 0 : err.status) ?? 0
      ));
      this._rollback(snapshot);
      throw err;
    }
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
    const handler = this._assertHandler("remove");
    const url = this._resolveURL(requestPath);
    await handler._fetch(url, { method: "DELETE" });
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
    log.length ? console.table(log) : console.debug("(변경 이력 없음)");
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
    var _a;
    const config = this._urlConfig ?? ((_a = this._handler) == null ? void 0 : _a.getUrlConfig()) ?? /** @type {any} */
    {};
    return buildURL(config, requestPath ?? "");
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
   * 동일 동기 블록 내 다중 상태 변경을 단일 `_broadcast()` 호출로 병합하는
   * 마이크로태스크(Microtask) 배칭 스케줄러.
   *
   * ## 동작 원리
   * `onMutate` 콜백이 `_broadcast()`를 직접 호출하는 대신 이 메서드를 거친다.
   * `_pendingFlush`가 `false`일 때만 `queueMicrotask()`로 flush를 예약하고
   * 플래그를 `true`로 세운다. 이후 동일 동기 블록에서 발생하는 추가 변경은
   * 플래그 체크에서 걸러져 중복 예약 없이 차단된다.
   * 현재 Call Stack이 비워지면 Microtask Queue가 실행되어 `_broadcast()`가
   * 정확히 한 번 호출되고 플래그가 `false`로 복원된다.
   *
   * ## 이벤트 루프 상의 위치
   * ```
   * [Call Stack 동기 코드]          → proxy.name = 'A', proxy.email = 'B', ...
   *   ↓ Call Stack 비워짐
   * [Microtask Queue]              → flush() → _broadcast() (1회)
   *   ↓
   * [Task Queue (렌더링, setTimeout)]
   * ```
   *
   * ## `queueMicrotask` vs `Promise.resolve().then()`
   * 두 방법 모두 Microtask Queue에 작업을 넣는다. `queueMicrotask()`를 선택한 이유:
   * 1. `Promise` 객체 생성·GC 오버헤드가 없다.
   * 2. 코드 의도("microtask에 작업을 직접 예약한다")가 명시적으로 드러난다.
   *
   * ## 배칭에서 제외되는 두 호출
   * - `constructor` 초기 `_broadcast()` : 인스턴스 초기화 시점의 단발 스냅샷.
   * - `save()` 완료 후 `_broadcast()`   : 서버 동기화 완료 이벤트. 즉시 반영 필요.
   * 이 두 곳은 `onMutate` 경로가 아니므로 이 메서드를 거치지 않는다.
   *
   * @returns {void}
   */
  _scheduleFlush() {
    if (this._pendingFlush) return;
    this._pendingFlush = true;
    queueMicrotask(() => {
      this._pendingFlush = false;
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
      errors: this._errors
    });
  }
};
_installedPlugins = new WeakMap();
// ── 플러그인 레지스트리 ────────────────────────────────────────────────────
/**
 * 등록된 플러그인 집합. 중복 등록 방지용.
 * Private class field로 외부 변조를 차단한다.
 *
 * @type {Set<DsmPlugin>}
 */
__privateAdd(_DomainState, _installedPlugins, /* @__PURE__ */ new Set());
// ── 의존성 주입 (순환 참조 해소) ──────────────────────────────────────────
/**
 * `DomainPipeline` 클래스 생성자.
 * 진입점(`rest-domain-state-manager.js`)에서 주입된다.
 *
 * `DomainState`와 `DomainPipeline`의 상호 참조를 피하기 위해
 * 직접 import 대신 생성자 주입(Constructor Injection) 패턴을 사용한다.
 *
 * @type {typeof import('./DomainPipeline.js').DomainPipeline | null}
 */
__publicField(_DomainState, "PipelineConstructor", null);
let DomainState = _DomainState;
class ApiHandler {
  /**
   * `ApiHandler` 인스턴스를 생성한다.
   *
   * `normalizeUrlConfig(urlConfig)`를 즉시 실행하여 URL 설정을 정규화하고
   * `this._urlConfig`에 캐싱한다. 이후 모든 요청은 이 캐싱된 설정을 기반으로 한다.
   *
   * @param {UrlConfig} [urlConfig={}]
   *   URL 설정 객체. `host` 또는 `baseURL` 중 하나를 포함해야 한다.
   * @throws {Error} `urlConfig`의 `protocol` 값이 유효하지 않은 경우
   * @throws {Error} `host`와 `baseURL`이 동시에 입력되어 충돌 해소가 불가능한 경우
   *
   * @example <caption>개발 환경 (HTTP 자동 선택)</caption>
   * const api = new ApiHandler({ host: 'localhost:8080', debug: true });
   *
   * @example <caption>운영 환경 (HTTPS 자동 선택)</caption>
   * const api = new ApiHandler({ host: 'api.example.com', env: 'production' });
   *
   * @example <caption>통합 문자열형 baseURL</caption>
   * const api = new ApiHandler({ baseURL: 'localhost:8080/app/api', debug: true });
   *
   * @example <caption>명시적 프로토콜</caption>
   * const api = new ApiHandler({ host: 'api.example.com', protocol: 'HTTPS' });
   */
  constructor(urlConfig = {}) {
    this._urlConfig = normalizeUrlConfig(urlConfig);
    this._debug = urlConfig.debug ?? false;
    this._headers = { "Content-Type": "application/json" };
  }
  // ════════════════════════════════════════════════════════════════════════════
  // 공개 API
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * HTTP GET 요청을 전송하고 응답을 `DomainState`로 변환하여 반환한다.
   *
   * ## 내부 처리 흐름
   * ```
   * requestPath + urlConfig
   *   ↓ buildURL()
   * 최종 URL
   *   ↓ this._fetch(url, { method: 'GET' })
   * 응답 텍스트 (JSON 문자열)
   *   ↓ DomainState.fromJSON(text, this, { urlConfig, debug })
   * DomainState (isNew: false)
   * ```
   *
   * 반환된 `DomainState`는 `isNew: false`이므로 `save()` 시 PATCH 또는 PUT을 전송한다.
   * `debug: true`이면 반환된 `DomainState`도 디버그 채널에 연결된다.
   *
   * @param {string}     requestPath - 엔드포인트 경로 (예: `'/api/users/user_001'`)
   * @param {GetOptions} [options={}] - 요청별 추가 옵션
   * @returns {Promise<DomainState>} 응답 데이터를 담은 `DomainState` 인스턴스 (`isNew: false`)
   * @throws {HttpError} 서버가 `response.ok === false` 응답을 반환한 경우
   * @throws {SyntaxError} 응답 본문이 유효하지 않은 JSON인 경우 (`DomainState.fromJSON` 내부)
   *
   * @example <caption>기본 GET → 수정 → 저장</caption>
   * const user = await api.get('/api/users/user_001');
   * console.log(user.data.name); // GET 응답 데이터 읽기
   * user.data.name = 'Davi';     // changeLog에 replace 기록
   * await user.save('/api/users/user_001'); // PATCH 전송
   *
   * @example <caption>요청별 URL 오버라이드</caption>
   * const user = await api.get('/api/users/1', {
   *     urlConfig: { host: 'staging.example.com' },
   * });
   *
   * @example <caption>에러 처리</caption>
   * try {
   *     const user = await api.get('/api/users/INVALID_ID');
   * } catch (err) {
   *     if (err.status === 404) console.error('사용자를 찾을 수 없습니다.');
   * }
   */
  async get(requestPath, { urlConfig } = {}) {
    const resolved = urlConfig ? normalizeUrlConfig(urlConfig) : this._urlConfig;
    const url = buildURL(resolved, requestPath);
    const text = await this._fetch(url, { method: "GET" });
    if (text === null) throw new Error("[DSM] GET 응답 본문이 비어있습니다");
    return DomainState.fromJSON(text, this, {
      urlConfig: resolved,
      debug: this._debug
    });
  }
  // ════════════════════════════════════════════════════════════════════════════
  // 내부 전용 메서드 (DomainState가 위임 호출)
  // ════════════════════════════════════════════════════════════════════════════
  /**
   * `fetch()` 공통 처리 메서드. `DomainState.save()` / `remove()` 내부에서 위임 호출된다.
   *
   * ## 처리 내용
   * 1. `this._headers`와 `options.headers`를 병합하여 공통 헤더를 주입한다.
   * 2. `response.ok` 검사 → `false`이면 `HttpError` 구조체를 throw한다.
   * 3. 응답 본문을 `response.text()`로 읽어 반환한다.
   * 4. 응답 본문이 비어있으면 (`204 No Content` 등) `null`을 반환한다.
   *
   * ## 헤더 병합 우선순위
   * `options.headers`가 `this._headers`보다 우선 적용된다. (스프레드 오버라이드)
   * ```
   * { ...this._headers, ...options.headers }
   * ```
   *
   * @param {string}      url            - `buildURL()`이 반환한 완성된 요청 URL
   * @param {RequestInit} [options={}]   - `fetch()` 두 번째 인자와 동일. `method`, `body`, `headers` 포함.
   * @returns {Promise<string | null>} 응답 본문 텍스트. 빈 응답이면 `null`.
   * @throws {HttpError} `response.ok === false`인 경우 (`{ status, statusText, body }`)
   *
   * @example <caption>DomainState.save() 내부에서의 POST 호출</caption>
   * await this._handler._fetch(url, {
   *     method: 'POST',
   *     body:   JSON.stringify({ name: 'Davi' }),
   * });
   *
   * @example <caption>DomainState.save() 내부에서의 PATCH 호출</caption>
   * await this._handler._fetch(url, {
   *     method: 'PATCH',
   *     body:   JSON.stringify([{ op: 'replace', path: '/name', value: 'Davi' }]),
   * });
   *
   * @example <caption>DomainState.remove() 내부에서의 DELETE 호출</caption>
   * await this._handler._fetch(url, { method: 'DELETE' });
   * // 204 No Content → null 반환
   */
  async _fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this._headers,
        ...options.headers ?? {}
      }
    });
    const text = await res.text();
    if (!res.ok) {
      throw (
        /** @type {HttpError} */
        {
          status: res.status,
          statusText: res.statusText,
          body: text
        }
      );
    }
    return text || null;
  }
  /**
   * 이 `ApiHandler` 인스턴스의 정규화된 URL 설정을 반환한다.
   *
   * `DomainState._resolveURL()`에서 `requestPath`와 조합할 때 참조한다.
   * 인스턴스 생성 시 `normalizeUrlConfig()`가 반환한 값을 그대로 반환한다.
   *
   * @returns {NormalizedUrlConfig} `{ protocol, host, basePath }` 정규화된 URL 설정
   *
   * @example <caption>DomainState._resolveURL() 내부에서의 사용</caption>
   * // DomainState 내부:
   * _resolveURL(requestPath) {
   *     const config = this._urlConfig ?? this._handler?.getUrlConfig() ?? {};
   *     return buildURL(config, requestPath ?? '');
   * }
   */
  getUrlConfig() {
    return this._urlConfig;
  }
  /**
   * 이 `ApiHandler` 인스턴스의 디버그 플래그를 반환한다.
   *
   * `get()`으로 생성한 `DomainState.fromJSON()`에 `debug` 옵션으로 전달되어
   * 반환된 `DomainState`의 디버그 채널 연결 여부를 결정한다.
   *
   * @returns {boolean} 디버그 모드 활성화 여부
   *
   * @example
   * const api = new ApiHandler({ host: 'localhost:8080', debug: true });
   * api.isDebug(); // → true
   *
   * const user = await api.get('/api/users/1');
   * user._debug; // → true (ApiHandler의 debug 플래그가 전파됨)
   */
  isDebug() {
    return this._debug;
  }
}
function renderSelect(container, dataArray, config) {
  const {
    valueField,
    labelField,
    class: cls = "",
    css: cssObj = {},
    events: evtMap = {},
    placeholder,
    multiple = false
  } = config;
  const select = document.createElement("select");
  select.name = valueField;
  select.multiple = multiple;
  if (cls) select.className = cls;
  _applyCSS$1(select, cssObj);
  if (placeholder) {
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    ph.disabled = true;
    ph.selected = true;
    ph.hidden = true;
    select.appendChild(ph);
  }
  for (const item of dataArray) {
    const opt = document.createElement("option");
    opt.value = String(item[valueField] ?? "");
    opt.textContent = String(item[labelField] ?? "");
    select.appendChild(opt);
  }
  _bindEvents$1(select, evtMap);
  container.appendChild(select);
  return select;
}
function _applyCSS$1(el, cssObj) {
  Object.assign(el.style, cssObj);
}
function _bindEvents$1(el, evtMap) {
  for (const [eventName, handler] of Object.entries(evtMap)) {
    if (typeof handler === "function") el.addEventListener(eventName, handler);
  }
}
function renderRadioCheckbox(container, dataArray, config) {
  const {
    type,
    valueField,
    labelField,
    name: inputName = valueField,
    // 미명시 시 valueField를 name으로 사용 (MyBatis 자동 매핑)
    class: inputCls = "",
    css: inputCss = {},
    events: evtMap = {},
    containerClass: conCls = "",
    containerCss: conCss = {},
    labelClass: lblCls = "",
    labelCss: lblCss = {}
  } = config;
  const inputs = [];
  const prefix = container.id || `dsm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  dataArray.forEach((item, idx) => {
    const itemValue = item[valueField] ?? "";
    const itemLabel = item[labelField] ?? "";
    const inputId = `${prefix}_${inputName}_${idx}`;
    const wrapper = document.createElement("div");
    if (conCls) wrapper.className = conCls;
    _applyCSS(wrapper, conCss);
    const input = document.createElement("input");
    input.type = type;
    input.id = inputId;
    input.name = inputName;
    input.value = itemValue;
    if (inputCls) input.className = inputCls;
    _applyCSS(input, inputCss);
    _bindEvents(input, evtMap);
    const label = document.createElement("label");
    label.htmlFor = inputId;
    label.textContent = itemLabel;
    if (lblCls) label.className = lblCls;
    _applyCSS(label, lblCss);
    wrapper.appendChild(input);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
    inputs.push(input);
  });
  return inputs;
}
function _applyCSS(el, cssObj) {
  Object.assign(el.style, cssObj);
}
function _bindEvents(el, evtMap) {
  for (const [eventName, handler] of Object.entries(evtMap)) {
    if (typeof handler === "function") el.addEventListener(eventName, handler);
  }
}
function renderButton(container, dataArray, config) {
  const {
    valueField,
    labelField,
    class: cls = "",
    css: cssObj = {},
    events: evtMap = {}
  } = config;
  return dataArray.map((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.value = String(item[valueField] ?? "");
    btn.textContent = String(item[labelField] ?? "");
    if (cls) btn.className = cls;
    Object.assign(btn.style, cssObj);
    for (const [eventName, handler] of Object.entries(evtMap)) {
      if (typeof handler === "function") btn.addEventListener(eventName, handler);
    }
    container.appendChild(btn);
    return btn;
  });
}
const RENDERER_TYPE = Object.freeze(
  /** @type {const} */
  {
    /** `<select>` 드롭다운 렌더러를 사용한다. */
    SELECT: "select",
    /** `<input type="radio">` 그룹 렌더러를 사용한다. */
    RADIO: "radio",
    /** `<input type="checkbox">` 그룹 렌더러를 사용한다. */
    CHECKBOX: "checkbox",
    /** `<button>` 그룹 렌더러를 사용한다. */
    BUTTON: "button"
  }
);
Object.freeze(
  /* @__PURE__ */ new Set([
    "text",
    "email",
    "password",
    "number",
    "tel",
    "url",
    "search",
    "date",
    "time",
    "textarea"
  ])
);
const DomainRenderer = {
  /**
   * `DomainState` 클래스에 `renderTo()` 메서드를 주입한다.
   * `DomainState.use(DomainRenderer)` 호출 시 자동으로 실행된다.
   *
   * `DomainState.prototype.renderTo`에 함수를 직접 할당하여
   * 모든 인스턴스에서 메서드를 사용할 수 있도록 한다.
   *
   * @param {typeof import('../../domain/DomainState.js').DomainState} DomainStateClass
   *   `DomainState` 클래스 생성자. `prototype`을 통해 메서드를 확장한다.
   * @returns {void}
   */
  install(DomainStateClass) {
    DomainStateClass.prototype.renderTo = function renderTo(container, config) {
      const el = container instanceof HTMLElement ? container : document.getElementById(
        /** @type {string} */
        container.replace(/^#/, "")
      );
      if (!el) throw new Error(ERR.RENDERER_CONTAINER_NOT_FOUND(String(container)));
      const { type, valueField, labelField } = config;
      if (!Object.values(RENDERER_TYPE).includes(type)) {
        throw new Error(ERR.RENDERER_TYPE_UNKNOWN(type));
      }
      if (!valueField) throw new Error(ERR.RENDERER_VALUE_FIELD_MISSING);
      if (!labelField) throw new Error(ERR.RENDERER_LABEL_FIELD_MISSING);
      const rawData = this._getTarget();
      if (!Array.isArray(rawData)) {
        throw new Error(ERR.RENDERER_DATA_NOT_ARRAY(this._label));
      }
      el.innerHTML = "";
      switch (type) {
        case RENDERER_TYPE.SELECT:
          return renderSelect(el, rawData, config);
        case RENDERER_TYPE.RADIO:
        case RENDERER_TYPE.CHECKBOX:
          return renderRadioCheckbox(el, rawData, config);
        case RENDERER_TYPE.BUTTON:
          return renderButton(el, rawData, config);
      }
    };
  }
};
const FormBinder = {
  /**
   * `DomainState` 클래스에 폼 바인딩 기능을 주입한다.
   * `DomainState.use(FormBinder)` 호출 시 자동으로 실행된다.
   *
   * ## 주입 대상
   * 1. `DomainStateClass.fromForm` — 정적 팩토리 메서드
   * 2. `DomainStateClass.prototype.bindForm` — 인스턴스 메서드
   *
   * @param {typeof import('../../domain/DomainState.js').DomainState} DomainStateClass
   *   `DomainState` 클래스 생성자. 정적 멤버와 prototype을 동적으로 확장한다.
   * @returns {void}
   */
  install(DomainStateClass) {
    DomainStateClass.fromForm = function(formOrId, handler, options = (
      /** @type {FromFormOptions} */
      {}
    )) {
      const formEl = _resolveForm(formOrId);
      if (!formEl) throw new Error("[DSM] 유효한 HTMLFormElement가 아닙니다.");
      let state = null;
      const skeleton = _formToSkeleton(formEl);
      const wrapper = createProxy(skeleton, () => {
        state == null ? void 0 : state._scheduleFlush();
      });
      state = new DomainStateClass(wrapper, {
        handler,
        urlConfig: options.urlConfig,
        isNew: true,
        debug: options.debug,
        label: options.label ?? formEl.id ?? "form_state"
      });
      _bindFormEvents(formEl, wrapper.getTarget(), wrapper.proxy);
      return state;
    };
    DomainStateClass.prototype.bindForm = function(formOrId) {
      const formEl = _resolveForm(formOrId);
      if (!formEl) return this;
      _syncToForm(formEl, this._getTarget());
      _bindFormEvents(formEl, this._getTarget(), this.data);
      return this;
    };
  }
};
function _resolveForm(formOrId) {
  if (typeof formOrId === "string")
    return (
      /** @type {HTMLFormElement | null} */
      document.getElementById(formOrId)
    );
  if (formOrId instanceof HTMLFormElement) return formOrId;
  return null;
}
function _formToSkeleton(formEl) {
  const obj = {};
  const elements = (
    /** @type {any[]} */
    Array.from(formEl.elements)
  );
  for (const el of elements) {
    if (!el.name) continue;
    const val = el.type === "checkbox" ? el.checked : el.value;
    _setNestedValue(obj, el.name.split("."), val);
  }
  return obj;
}
function _syncToForm(formEl, targetObj) {
  const elements = (
    /** @type {any[]} */
    Array.from(formEl.elements)
  );
  for (const el of elements) {
    if (!el.name) continue;
    const keys = el.name.split(".");
    let val = targetObj;
    for (const k of keys) {
      if (val == null) break;
      val = /** @type {any} */
      val[k];
    }
    if (val !== void 0 && val !== null) {
      if (el.type === "checkbox" || el.type === "radio")
        el.checked = el.value === String(val);
      else el.value = val;
    }
  }
}
function _bindFormEvents(formEl, targetObj, proxyObj) {
  formEl.addEventListener("input", (e) => {
    const target = (
      /** @type {any} */
      e.target
    );
    if (!target.name) return;
    if (["text", "password", "email", "textarea"].includes(target.type)) return;
    const val = target.type === "checkbox" ? target.checked : target.value;
    _setNestedValue(proxyObj, target.name.split("."), val);
  });
  formEl.addEventListener("focusout", (e) => {
    const target = (
      /** @type {any} */
      e.target
    );
    if (!target.name) return;
    if (["text", "password", "email", "textarea"].includes(target.type)) {
      _setNestedValue(proxyObj, target.name.split("."), target.value);
    }
  });
}
DomainState.PipelineConstructor = DomainPipeline;
export {
  ApiHandler,
  DomainPipeline,
  DomainRenderer,
  DomainState,
  DomainVO,
  FormBinder,
  closeDebugChannel
};
//# sourceMappingURL=index.js.map
