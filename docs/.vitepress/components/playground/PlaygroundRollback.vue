<script setup>
/**
 * PlaygroundRollback
 * TC-DS-006: HTTP 4xx → save() 진입 시점 상태가 오염되지 않음
 * TC-DS-009: 롤백 후 재시도 → 올바른 메서드로 전송됨
 * TC-C-013:  restoreTarget → domainObject 복원
 */
import { ref, reactive, onMounted } from 'vue'

const ready = ref(false)
let DomainState, MockApiHandler

const stateRef   = ref(null)
const handlerRef = ref(null)

const INITIAL = { userId: 'user_001', name: 'Davi', email: 'davi@example.com', role: 'admin' }

const form = reactive({ ...INITIAL })
const log  = ref([])   // 이벤트 로그

const saveStatus = reactive({
    loading: false,
    failMode: false,
    attempt: 0,
})

onMounted(async () => {
    const lib  = await import('../../../../index.js')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    MockApiHandler = mock.MockApiHandler
    reset()
    ready.value = true
})

function reset() {
    handlerRef.value = new MockApiHandler(INITIAL, { latency: 500 })
    stateRef.value   = DomainState.fromJSON(JSON.stringify(INITIAL), handlerRef.value)
    Object.assign(form, INITIAL)
    log.value = []
    saveStatus.attempt = 0
    addLog('info', '인스턴스 초기화 완료')
}

function handleFieldChange(key, value) {
    if (!stateRef.value) return
    stateRef.value.data[key] = value
}

async function handleSave() {
    if (!stateRef.value || saveStatus.loading) return
    saveStatus.loading = true
    saveStatus.attempt++

    handlerRef.value.setFailMode(saveStatus.failMode, 409)

    const snapName = stateRef.value._getTarget().name
    addLog('info', `save() 호출 (시도 #${saveStatus.attempt}) — name: "${snapName}"`)

    // 메서드 캡처
    const api = handlerRef.value
    const orig = api._fetch.bind(api)
    let capturedMethod = null
    api._fetch = async (url, opts) => {
        capturedMethod = opts.method
        return orig(url, opts)
    }

    try {
        await stateRef.value.save('/api/users/user_001')
        api._fetch = orig
        addLog('success', `✓ ${capturedMethod} 성공 — changeLog 초기화됨`)
        Object.assign(form, stateRef.value._getTarget())
    } catch (e) {
        api._fetch = orig
        const restoredName = stateRef.value._getTarget().name
        addLog('error', `✗ HTTP ${e.status} — 롤백 완료. name 복원: "${restoredName}"`)
        Object.assign(form, stateRef.value._getTarget())
    } finally {
        saveStatus.loading = false
    }
}

function addLog(type, msg) {
    log.value.unshift({ type, msg, time: new Date().toLocaleTimeString() })
    if (log.value.length > 8) log.value.pop()
}
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">Optimistic Update 롤백 시연</div>
        <div v-if="!ready" class="playground-body pg-loading">초기화 중...</div>
        <div v-else class="playground-body pg-layout">

            <div class="pg-panel">
                <div class="pg-panel-header">
                    <span>데이터 편집</span>
                    <label class="pg-fail-toggle">
                        <input type="checkbox" v-model="saveStatus.failMode" />
                        <span :class="saveStatus.failMode ? 'fail-on' : 'fail-off'">
                            {{ saveStatus.failMode ? '실패 모드 ON' : '성공 모드' }}
                        </span>
                    </label>
                </div>
                <div class="pg-fields">
                    <div v-for="key in Object.keys(form)" :key="key" class="pg-field">
                        <label class="pg-field-label">{{ key }}</label>
                        <input class="pg-field-input" :value="form[key]"
                            @input="e => { form[key] = e.target.value; handleFieldChange(key, e.target.value) }" />
                    </div>
                </div>
                <div class="pg-actions">
                    <button class="pg-btn pg-btn-save" :disabled="saveStatus.loading" @click="handleSave">
                        {{ saveStatus.loading ? '처리 중...' : 'save() 실행' }}
                    </button>
                    <button class="pg-btn pg-btn-reset" @click="reset">초기화</button>
                </div>
                <div class="pg-hint">
                    💡 "실패 모드 ON" 후 save() → 롤백 확인<br>
                    💡 롤백 후 "성공 모드"로 재시도 → 동일 메서드 전송 확인
                </div>
            </div>

            <div class="pg-panel">
                <div class="pg-panel-header">이벤트 로그</div>
                <div class="pg-log-panel">
                    <div v-for="(entry, i) in log" :key="i" :class="['pg-log-item', entry.type]">
                        <span class="log-time">{{ entry.time }}</span>
                        <span class="log-msg">{{ entry.msg }}</span>
                    </div>
                    <div v-if="log.length === 0" class="pg-empty">save()를 실행하면 로그가 표시됩니다</div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.playground-wrapper { border: 1px solid var(--dsm-playground-border,#cbd5e1); border-radius:12px; overflow:hidden; margin:2rem 0; background:var(--dsm-playground-bg,#f8fafc); }
.playground-header { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(90,90,143,0.08); border-bottom:1px solid var(--dsm-playground-border,#cbd5e1); font-size:.82rem; font-weight:600; color:var(--vp-c-brand-1,#5a5a8f); }
.playground-header::before { content:'▶'; font-size:.7rem; }
.playground-body { padding:1.5rem; }
.pg-loading { text-align:center; color:var(--vp-c-text-3); }
.pg-layout { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
@media(max-width:640px){ .pg-layout{ grid-template-columns:1fr; } }
.pg-panel { display:flex; flex-direction:column; gap:.75rem; }
.pg-panel-header { display:flex; align-items:center; justify-content:space-between; font-size:.8rem; font-weight:600; color:var(--vp-c-text-2); }
.pg-fail-toggle { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:.78rem; }
.fail-on { color:#ef4444; font-weight:700; }
.fail-off { color:#10b981; }
.pg-fields { display:flex; flex-direction:column; gap:6px; }
.pg-field { display:flex; flex-direction:column; gap:2px; }
.pg-field-label { font-size:.75rem; font-weight:500; color:var(--vp-c-text-3); }
.pg-field-input { padding:5px 9px; border:1px solid var(--vp-c-divider); border-radius:6px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font-size:.83rem; font-family:monospace; }
.pg-field-input:focus { outline:none; border-color:var(--vp-c-brand-1,#5a5a8f); }
.pg-actions { display:flex; gap:8px; }
.pg-btn { flex:1; padding:7px; border:none; border-radius:8px; font-size:.83rem; font-weight:600; cursor:pointer; }
.pg-btn:disabled { opacity:.5; cursor:not-allowed; }
.pg-btn-save { background:var(--vp-c-brand-1,#5a5a8f); color:#fff; }
.pg-btn-reset { background:var(--vp-c-default-soft); color:var(--vp-c-text-2); }
.pg-hint { font-size:.75rem; color:var(--vp-c-text-3); line-height:1.6; }
.pg-log-panel { display:flex; flex-direction:column; gap:4px; max-height:240px; overflow-y:auto; }
.pg-log-item { display:flex; gap:8px; font-size:.78rem; padding:4px 8px; border-radius:4px; }
.pg-log-item.info    { background:rgba(90,90,143,.06); }
.pg-log-item.success { background:rgba(16,185,129,.08); }
.pg-log-item.error   { background:rgba(239,68,68,.08); }
.log-time { color:var(--vp-c-text-3); white-space:nowrap; font-family:monospace; font-size:.73rem; }
.log-msg  { color:var(--vp-c-text-1); }
.pg-log-item.success .log-msg { color:#059669; }
.pg-log-item.error   .log-msg { color:#dc2626; }
.pg-empty { font-size:.78rem; color:var(--vp-c-text-3); font-style:italic; padding:1rem 0; }
</style>
