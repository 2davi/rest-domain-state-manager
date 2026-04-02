<script setup>
/**
 * PlaygroundFormBinder
 * TC-FB-001: fromForm() — 폼 현재 값 → DomainState 생성
 * TC-FB-002: text input blur → data 갱신
 * TC-FB-003: bindForm() — DomainState.data → 폼 역동기화
 */
import { shallowRef, ref, reactive, onMounted, nextTick } from 'vue'

const ready = ref(false)
const mode  = ref('fromForm')   // 'fromForm' | 'bindForm'
const log   = ref([])

let DomainState, FormBinder, MockApiHandler
const stateRef = shallowRef(null)

const display = reactive({ data: {}, changeLog: [], isNew: false })

// fromForm 시나리오용 서버 데이터 (bindForm 역동기화 소스)
const SERVER_DATA = { name: '홍길동', email: 'hong@example.com', role: 'admin' }

onMounted(async () => {
    const lib  = await import('../../../../index.js')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    FormBinder     = lib.FormBinder
    MockApiHandler = mock.MockApiHandler
    if (!DomainState.prototype.fromForm) DomainState.use(FormBinder)
    initFromForm()
    ready.value = true
})

function initFromForm() {
    const api = new MockApiHandler(SERVER_DATA, { latency: 300 })
    // fromForm은 실제 DOM form이 필요하므로 여기선 fromJSON + isNew:true로 시뮬레이션
    stateRef.value = DomainState.fromJSON(
        JSON.stringify({ name: '', email: '', role: 'user' }),
        api,
        { isNew: true }
    )
    syncDisplay()
    addLog('info', 'fromForm() 시뮬레이션 — 빈 폼으로 초기화 (isNew: true)')
}

async function initBindForm() {
    const api = new MockApiHandler(SERVER_DATA, { latency: 300 })
    stateRef.value = DomainState.fromJSON(JSON.stringify(SERVER_DATA), api)
    syncDisplay()
    addLog('info', `bindForm() 시뮬레이션 — 서버 데이터로 폼 채움 (isNew: false)`)
    addLog('info', `  name: "${SERVER_DATA.name}", role: "${SERVER_DATA.role}"`)
}

function switchMode(m) {
    mode.value = m
    log.value = []
    if (m === 'fromForm') initFromForm()
    else initBindForm()
}

function handleFieldInput(key, value) {
    if (!stateRef.value) return
    stateRef.value.data[key] = value
    syncDisplay()
    addLog('change', `data.${key} = "${value}"`)
}

function handleFieldBlur(key, val) {
    // 포커스 이탈 시 1회 DomainState 반영
    if (!stateRef.value) return
    stateRef.value.data[key] = val
}

function syncDisplay() {
    if (!stateRef.value) return
    display.data      = { ...stateRef.value._getTarget() }
    display.changeLog = stateRef.value._getChangeLog()
    display.isNew     = stateRef.value._isNew
}

function addLog(type, msg) {
    log.value.unshift({ type, msg })
    if (log.value.length > 6) log.value.pop()
}

const formFields = ['name', 'email', 'role']
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">FormBinder 양방향 바인딩 시연</div>
        <div v-if="!ready" class="playground-body pg-loading">초기화 중...</div>
        <div v-else class="playground-body">

            <div class="pg-mode-bar">
                <button :class="['mode-btn', mode === 'fromForm' && 'active']" @click="switchMode('fromForm')">
                    fromForm() — 빈 폼 → 신규 생성
                </button>
                <button :class="['mode-btn', mode === 'bindForm' && 'active']" @click="switchMode('bindForm')">
                    bindForm() — 서버 데이터 → 폼 채우기
                </button>
            </div>

            <div class="pg-layout">
                <div class="pg-panel">
                    <div class="pg-panel-header">
                        HTML 폼 (시뮬레이션)
                        <span :class="['pg-isnew', display.isNew ? 'new' : 'exist']">
                            {{ display.isNew ? 'isNew: true → POST' : 'isNew: false → PUT/PATCH' }}
                        </span>
                    </div>
                    <div class="pg-form">
                        <div v-for="key in formFields" :key="key" class="pg-form-row">
                            <label class="pg-form-label">{{ key }}</label>
                            <input
                                class="pg-form-input"
                                :value="display.data[key] ?? ''"
                                @input="e => onFieldInput(key, e.target.value)"
                                @blur="e => onFieldBlur(key, e.target.value)"
                                :placeholder="mode === 'fromForm' ? '입력하세요' : ''"
                            />
                        </div>
                    </div>
                    <div class="pg-event-log">
                        <div v-for="(e, i) in log" :key="i" :class="['pg-log-entry', e.type]">
                            {{ e.msg }}
                        </div>
                        <div v-if="log.length === 0" class="pg-empty">필드를 수정하면 로그가 표시됩니다</div>
                    </div>
                </div>

                <div class="pg-panel">
                    <div class="pg-panel-header">DomainState 내부 상태</div>
                    <div class="pg-state-block">
                        <div class="pg-state-label">data (현재 값)</div>
                        <pre class="pg-pre">{{ JSON.stringify(display.data, null, 2) }}</pre>
                    </div>
                    <div class="pg-state-block">
                        <div class="pg-state-label">changeLog ({{ display.changeLog.length }}건)</div>
                        <div v-for="(e, i) in display.changeLog" :key="i" class="pg-cl-entry">
                            <span :class="['op', e.op]">{{ e.op }}</span>
                            <span class="path">{{ e.path }}</span>
                        </div>
                        <div v-if="display.changeLog.length === 0" class="pg-empty">변경 없음</div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.playground-wrapper { border:1px solid var(--dsm-playground-border,#cbd5e1); border-radius:12px; overflow:hidden; margin:2rem 0; background:var(--dsm-playground-bg,#f8fafc); }
.playground-header { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(90,90,143,0.08); border-bottom:1px solid var(--dsm-playground-border,#ccc9e0); font-size:.82rem; font-weight:600; color:var(--vp-c-brand-1,#5a5a8f); }
.playground-header::before { content:'▶'; font-size:.7rem; }
.playground-body { padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
.pg-loading { text-align:center; color:var(--vp-c-text-3); }
.pg-mode-bar { display:flex; gap:6px; }
.mode-btn { padding:5px 12px; border:1px solid var(--vp-c-divider); border-radius:20px; background:transparent; font-size:.78rem; cursor:pointer; color:var(--vp-c-text-3); transition:all .15s; }
.mode-btn.active { background:var(--vp-c-brand-1,#5a5a8f); border-color:var(--vp-c-brand-1,#5a5a8f); color:#fff; }
.pg-layout { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
@media(max-width:640px){ .pg-layout{grid-template-columns:1fr;} }
.pg-panel { display:flex; flex-direction:column; gap:.75rem; }
.pg-panel-header { display:flex; align-items:center; justify-content:space-between; font-size:.78rem; font-weight:600; color:var(--vp-c-text-2); }
.pg-isnew { font-size:.72rem; padding:2px 7px; border-radius:10px; font-weight:600; }
.pg-isnew.new  { background:rgba(90,90,143,.12); color:var(--vp-c-brand-1,#5a5a8f); }
.pg-isnew.exist{ background:rgba(16,185,129,.1); color:#059669; }
.pg-form { display:flex; flex-direction:column; gap:6px; }
.pg-form-row { display:flex; align-items:center; gap:8px; }
.pg-form-label { font-size:.75rem; font-weight:500; color:var(--vp-c-text-3); width:60px; flex-shrink:0; }
.pg-form-input { flex:1; padding:5px 9px; border:1px solid var(--vp-c-divider); border-radius:6px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font-size:.83rem; }
.pg-form-input:focus { outline:none; border-color:var(--vp-c-brand-1,#5a5a8f); }
.pg-event-log { display:flex; flex-direction:column; gap:3px; max-height:100px; overflow-y:auto; }
.pg-log-entry { font-size:.75rem; padding:2px 6px; border-radius:3px; color:var(--vp-c-text-2); font-family:monospace; }
.pg-log-entry.change { background:rgba(245,158,11,.08); color:#b45309; }
.pg-log-entry.info   { color:var(--vp-c-text-3); }
.pg-state-block { display:flex; flex-direction:column; gap:5px; }
.pg-state-label { font-size:.72rem; font-weight:600; color:var(--vp-c-text-3); text-transform:uppercase; letter-spacing:.05em; }
.pg-pre { font-size:.72rem; background:var(--vp-c-code-bg); padding:8px 10px; border-radius:6px; overflow-x:auto; margin:0; color:var(--vp-c-brand-1,#5a5a8f); max-height:120px; overflow-y:auto; }
.pg-cl-entry { display:flex; gap:8px; font-size:.75rem; font-family:monospace; padding:1px 0; }
.op { font-weight:700; min-width:55px; }
.op.replace { color:#3b82f6; }
.op.add     { color:#10b981; }
.op.remove  { color:#ef4444; }
.path { color:var(--vp-c-text-2); }
.pg-empty { font-size:.75rem; color:var(--vp-c-text-3); font-style:italic; }
</style>
