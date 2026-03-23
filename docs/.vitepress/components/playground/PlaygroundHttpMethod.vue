<script setup>
/**
 * PlaygroundHttpMethod
 *
 * save() 분기 전략을 인터랙티브하게 시연한다.
 * TC-DS-001 (POST), TC-DS-003 (PUT 변경없음),
 * TC-DS-004 (PUT dirtyRatio≥0.7), TC-DS-005 (PATCH)에 대응.
 */
import { ref, reactive, computed, onMounted } from 'vue'

// ── 상태 ──────────────────────────────────────────────────────
const ready   = ref(false)
const error   = ref(null)

let DomainState, MockApiHandler

// DomainState 인스턴스
const stateRef = ref(null)

// 화면에 표시할 파생 상태
const display = reactive({
    data:        {},
    dirtyFields: [],
    dirtyRatio:  0,
    totalFields: 0,
    isNew:       false,
    changeLog:   [],
})

// 저장 동작 상태
const saveStatus = reactive({
    loading:    false,
    method:     null,   // 'POST' | 'PUT' | 'PATCH' | null
    success:    null,   // true | false | null
    error:      null,
    payload:    null,
})

// 초기 서버 데이터
const INITIAL_DATA = {
    userId:  'user_001',
    name:    'Davi',
    email:   'davi@example.com',
    role:    'admin',
    address: '서울특별시',
}

// 폼 입력 바인딩용 ref
const form = reactive({ ...INITIAL_DATA })
const isNewMode = ref(false)   // true: fromVO(신규), false: fromJSON(기존)

// ── 초기화 ─────────────────────────────────────────────────────
onMounted(async () => {
    try {
        const lib  = await import('../../../../index.js')
        const mock = await import('./MockApiHandler.js')
        DomainState    = lib.DomainState
        MockApiHandler = mock.MockApiHandler
        initState()
        ready.value = true
    } catch (e) {
        error.value = e.message
    }
})

function initState() {
    const api = new MockApiHandler(INITIAL_DATA, { latency: 600 })

    if (isNewMode.value) {
        // fromVO — isNew: true → POST
        const skeleton = { ...INITIAL_DATA, userId: '', name: '', email: '', role: '', address: '' }
        stateRef.value = DomainState.fromJSON(JSON.stringify(skeleton), api, { isNew: true })
    } else {
        // fromJSON — isNew: false
        stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL_DATA), api)
    }

    // 폼 초기값 동기화
    Object.assign(form, stateRef.value._getTarget())
    syncDisplay()
    clearSaveStatus()
}

function syncDisplay() {
    if (!stateRef.value) return
    const target      = stateRef.value._getTarget()
    display.data      = { ...target }
    display.dirtyFields = [...stateRef.value._getDirtyFields()]
    display.isNew     = stateRef.value._isNew
    display.changeLog = stateRef.value._getChangeLog()
    display.totalFields = Object.keys(target).length
    display.dirtyRatio  = display.totalFields > 0
        ? display.dirtyFields.length / display.totalFields
        : 0
}

function clearSaveStatus() {
    saveStatus.loading = false
    saveStatus.method  = null
    saveStatus.success = null
    saveStatus.error   = null
    saveStatus.payload = null
}

// ── 폼 변경 처리 ──────────────────────────────────────────────
function handleFieldChange(key, value) {
    if (!stateRef.value) return
    stateRef.value.data[key] = value
    syncDisplay()
}

// ── 저장 ───────────────────────────────────────────────────────
async function handleSave() {
    if (!stateRef.value || saveStatus.loading) return
    saveStatus.loading = true
    saveStatus.error   = null

    // _fetch를 가로채서 실제 선택된 메서드와 payload를 캡처
    const api = stateRef.value._handler
    const original = api._fetch.bind(api)
    api._fetch = async (url, opts) => {
        saveStatus.method  = opts.method
        saveStatus.payload = opts.body ? JSON.parse(opts.body) : null
        return original(url, opts)
    }

    try {
        await stateRef.value.save('/api/users/user_001')
        saveStatus.success = true
    } catch (e) {
        saveStatus.success = false
        saveStatus.error   = e.status ? `HTTP ${e.status} ${e.statusText}` : String(e)
    } finally {
        api._fetch = original
        saveStatus.loading = false
        syncDisplay()
        setTimeout(() => { saveStatus.success = null }, 4000)
    }
}

// ── 리셋 ───────────────────────────────────────────────────────
function handleReset() {
    Object.assign(form, isNewMode.value
        ? { userId: '', name: '', email: '', role: '', address: '' }
        : { ...INITIAL_DATA }
    )
    initState()
}

function toggleMode() {
    isNewMode.value = !isNewMode.value
    initState()
}

// ── 분기 예측 (UI 미리보기용) ────────────────────────────────
const predictedMethod = computed(() => {
    if (!stateRef.value) return null
    if (display.isNew) return 'POST'
    if (display.dirtyFields.length === 0) return 'PUT'
    if (display.dirtyRatio >= 0.7) return 'PUT'
    return 'PATCH'
})

const methodColor = computed(() => ({
    POST:  '#10b981',   // green
    PUT:   '#3b82f6',   // blue
    PATCH: '#f59e0b',   // amber
}[predictedMethod.value] ?? '#6b7280'))
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">
            save() HTTP 메서드 자동 분기 시연
        </div>

        <div v-if="!ready && !error" class="playground-body pg-loading">
            라이브러리 초기화 중...
        </div>

        <div v-else-if="error" class="playground-body pg-error">
            ⚠ 라이브러리를 불러오지 못했습니다: {{ error }}
        </div>

        <div v-else class="playground-body pg-layout">

            <!-- 좌: 입력 패널 -->
            <div class="pg-panel pg-input">
                <div class="pg-panel-header">
                    <span>도메인 데이터 편집</span>
                    <div class="pg-mode-switch">
                        <button
                            :class="['mode-btn', !isNewMode && 'active']"
                            @click="isNewMode && toggleMode()">기존 데이터</button>
                        <button
                            :class="['mode-btn', isNewMode && 'active']"
                            @click="!isNewMode && toggleMode()">신규 생성</button>
                    </div>
                </div>

                <div class="pg-fields">
                    <div v-for="key in Object.keys(form)" :key="key" class="pg-field">
                        <label :class="['pg-field-label', display.dirtyFields.includes(key) && 'dirty']">
                            {{ key }}
                            <span v-if="display.dirtyFields.includes(key)" class="dirty-dot">●</span>
                        </label>
                        <input
                            class="pg-field-input"
                            :value="form[key]"
                            @input="e => { form[key] = e.target.value; handleFieldChange(key, e.target.value) }"
                        />
                    </div>
                </div>

                <div class="pg-actions">
                    <button class="pg-btn pg-btn-save" :disabled="saveStatus.loading" @click="handleSave">
                        <span v-if="saveStatus.loading">저장 중...</span>
                        <span v-else>save() 실행</span>
                    </button>
                    <button class="pg-btn pg-btn-reset" @click="handleReset">초기화</button>
                </div>

                <!-- 저장 결과 -->
                <div v-if="saveStatus.method" :class="['pg-result', saveStatus.success ? 'success' : saveStatus.success === false ? 'fail' : '']">
                    <div class="pg-result-method" :style="{ color: methodColor }">
                        {{ saveStatus.method }}
                    </div>
                    <div v-if="saveStatus.success" class="pg-result-msg">✓ 서버 동기화 완료</div>
                    <div v-if="saveStatus.success === false" class="pg-result-msg err">✗ {{ saveStatus.error }}</div>
                </div>
            </div>

            <!-- 우: 상태 패널 -->
            <div class="pg-panel pg-state">
                <!-- 분기 예측 -->
                <div class="pg-state-section">
                    <div class="pg-state-label">예측 HTTP 메서드</div>
                    <div class="pg-method-badge" :style="{ background: methodColor + '22', color: methodColor, borderColor: methodColor }">
                        {{ predictedMethod ?? '계산 중...' }}
                    </div>
                    <div class="pg-state-reason">
                        <span v-if="display.isNew">isNew = true → POST</span>
                        <span v-else-if="display.dirtyFields.length === 0">변경 없음 → PUT</span>
                        <span v-else-if="display.dirtyRatio >= 0.7">
                            dirtyRatio = {{ (display.dirtyRatio * 100).toFixed(0) }}% ≥ 70% → PUT
                        </span>
                        <span v-else>
                            dirtyRatio = {{ (display.dirtyRatio * 100).toFixed(0) }}% &lt; 70% → PATCH
                        </span>
                    </div>
                </div>

                <!-- dirtyFields -->
                <div class="pg-state-section">
                    <div class="pg-state-label">dirtyFields ({{ display.dirtyFields.length }} / {{ display.totalFields }})</div>
                    <div class="pg-dirty-chips">
                        <span v-for="f in display.dirtyFields" :key="f" class="pg-chip">{{ f }}</span>
                        <span v-if="display.dirtyFields.length === 0" class="pg-empty">없음</span>
                    </div>
                </div>

                <!-- changeLog -->
                <div class="pg-state-section">
                    <div class="pg-state-label">changeLog ({{ display.changeLog.length }}건)</div>
                    <div class="pg-changelog">
                        <div v-for="(entry, i) in display.changeLog.slice(-5)" :key="i" class="pg-log-entry">
                            <span :class="['op', entry.op]">{{ entry.op }}</span>
                            <span class="path">{{ entry.path }}</span>
                        </div>
                        <div v-if="display.changeLog.length === 0" class="pg-empty">변경 없음</div>
                        <div v-if="display.changeLog.length > 5" class="pg-more">
                            … 외 {{ display.changeLog.length - 5 }}건
                        </div>
                    </div>
                </div>

                <!-- PATCH payload -->
                <div v-if="saveStatus.method === 'PATCH' && saveStatus.payload" class="pg-state-section">
                    <div class="pg-state-label">RFC 6902 PATCH Payload</div>
                    <pre class="pg-payload">{{ JSON.stringify(saveStatus.payload, null, 2) }}</pre>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.playground-wrapper {
    border: 1px solid var(--dsm-playground-border, #cbd5e1);
    border-radius: 12px;
    overflow: hidden;
    margin: 2rem 0;
    background: var(--dsm-playground-bg, #f8fafc);
}
.playground-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(13, 148, 136, 0.08);
    border-bottom: 1px solid var(--dsm-playground-border, #cbd5e1);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--vp-c-brand-1, #0d9488);
}
.playground-header::before { content: '▶'; font-size: 0.7rem; }
.playground-body { padding: 1.5rem; }
.pg-loading, .pg-error { text-align: center; color: var(--vp-c-text-3); font-size: 0.9rem; }
.pg-error { color: #ef4444; }

.pg-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}
@media (max-width: 640px) {
    .pg-layout { grid-template-columns: 1fr; }
}

.pg-panel { display: flex; flex-direction: column; gap: 1rem; }
.pg-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--vp-c-text-2);
}

.pg-mode-switch { display: flex; gap: 4px; }
.mode-btn {
    padding: 3px 10px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 20px;
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--vp-c-text-3);
    transition: all 0.15s;
}
.mode-btn.active {
    background: var(--vp-c-brand-1, #0d9488);
    border-color: var(--vp-c-brand-1, #0d9488);
    color: #fff;
}

.pg-fields { display: flex; flex-direction: column; gap: 8px; }
.pg-field { display: flex; flex-direction: column; gap: 3px; }
.pg-field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--vp-c-text-3);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.2s;
}
.pg-field-label.dirty { color: #f59e0b; }
.dirty-dot { font-size: 8px; color: #f59e0b; }
.pg-field-input {
    padding: 6px 10px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.85rem;
    font-family: var(--vp-font-family-mono, monospace);
    transition: border-color 0.15s;
}
.pg-field-input:focus { outline: none; border-color: var(--vp-c-brand-1, #0d9488); }

.pg-actions { display: flex; gap: 8px; }
.pg-btn {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
}
.pg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pg-btn-save { background: var(--vp-c-brand-1, #0d9488); color: #fff; }
.pg-btn-reset { background: var(--vp-c-default-soft); color: var(--vp-c-text-2); }

.pg-result {
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--vp-c-default-soft);
    border: 1px solid var(--vp-c-divider);
    display: flex;
    align-items: center;
    gap: 10px;
}
.pg-result.success { border-color: #10b981; }
.pg-result.fail    { border-color: #ef4444; }
.pg-result-method { font-family: monospace; font-weight: 700; font-size: 1rem; }
.pg-result-msg { font-size: 0.82rem; color: var(--vp-c-text-2); }
.pg-result-msg.err { color: #ef4444; }

.pg-state-section { display: flex; flex-direction: column; gap: 6px; }
.pg-state-label { font-size: 0.75rem; font-weight: 600; color: var(--vp-c-text-3); text-transform: uppercase; letter-spacing: 0.05em; }
.pg-state-reason { font-size: 0.8rem; color: var(--vp-c-text-2); font-family: monospace; }

.pg-method-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 20px;
    border: 1.5px solid;
    font-weight: 700;
    font-size: 1rem;
    font-family: monospace;
    letter-spacing: 0.05em;
    align-self: flex-start;
}

.pg-dirty-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.pg-chip {
    padding: 2px 8px;
    background: rgba(245, 158, 11, 0.12);
    color: #b45309;
    border-radius: 10px;
    font-size: 0.78rem;
    font-family: monospace;
    font-weight: 500;
}

.pg-changelog { display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow-y: auto; }
.pg-log-entry {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 0.78rem;
    font-family: monospace;
    padding: 2px 0;
}
.op { font-weight: 700; min-width: 55px; }
.op.replace { color: #3b82f6; }
.op.add     { color: #10b981; }
.op.remove  { color: #ef4444; }
.path { color: var(--vp-c-text-2); }
.pg-empty { font-size: 0.78rem; color: var(--vp-c-text-3); font-style: italic; }
.pg-more  { font-size: 0.75rem; color: var(--vp-c-text-3); }

.pg-payload {
    font-size: 0.75rem;
    background: var(--vp-c-code-bg);
    padding: 8px 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0;
    color: var(--vp-c-brand-1);
}
</style>
