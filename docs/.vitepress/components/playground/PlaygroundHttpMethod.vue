<script setup>
/**
 * PlaygroundHttpMethod — save() HTTP 메서드 자동 분기 시연
 *
 * 학습 목표:
 *   save() 호출 시 POST / PUT / PATCH 중 무엇이 선택되는지, 그 이유를 이해한다.
 *
 * TC: TC-DS-001 (POST), TC-DS-003 (PUT 변경없음),
 *     TC-DS-004 (PUT dirtyRatio≥0.7), TC-DS-005 (PATCH)
 */
import { shallowRef, ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const ready  = ref(false)
const err    = ref(null)

let DomainState, MockApiHandler, unsub

const stateRef = shallowRef(null)
const apiRef    = ref(null)
const isNewMode = ref(false)

const INITIAL = {
    userId:  'user_001',
    name:    'Davi',
    email:   'davi@example.com',
    role:    'admin',
    address: '서울특별시',
}

const form = reactive({ ...INITIAL })

const display = reactive({
    dirtyFields:  [],
    totalFields:  5,
    dirtyRatio:   0,
    isNew:        false,
    changeLog:    [],
})

const saveStatus = reactive({
    loading: false,
    method:  null,
    payload: null,
    success: null,
    errMsg:  null,
})

onMounted(async () => {
    try {
        const lib  = await import('@2davi/rest-domain-state-manager')
        const mock = await import('./MockApiHandler.js')
        DomainState    = lib.DomainState
        MockApiHandler = mock.MockApiHandler
        initState()
        ready.value = true
    } catch (e) {
        err.value = e.message
    }
})

onUnmounted(() => { if (unsub) unsub() })

function initState() {
    if (unsub) unsub()
    apiRef.value   = new MockApiHandler(INITIAL, { latency: 500 })
    const data     = isNewMode.value
        ? { userId:'', name:'', email:'', role:'', address:'' }
        : INITIAL
    stateRef.value = DomainState.fromJSON(JSON.stringify(data), apiRef.value, {
        isNew: isNewMode.value,
    })
    //DEBUG
    stateRef.value._isNew = isNewMode.value;
    //console.debug("[initState()] stateRef.value._isNew = ", stateRef.value._isNew);
    Object.assign(form, stateRef.value._getTarget())
    unsub = stateRef.value.subscribe(syncDisplay)
    syncDisplay()
    clearSave()
}

function syncDisplay() {
    if (!stateRef.value) return
    const target          = stateRef.value._getTarget()
    display.dirtyFields   = [...stateRef.value._getDirtyFields()]
    display.totalFields   = Object.keys(target).length
    display.dirtyRatio    = display.totalFields > 0 ? display.dirtyFields.length / display.totalFields : 0
    display.isNew         = stateRef.value._isNew
    display.changeLog     = stateRef.value._getChangeLog()
}

function clearSave() {
    saveStatus.loading = false
    saveStatus.method  = null
    saveStatus.payload = null
    saveStatus.success = null
    saveStatus.errMsg  = null
}

function onFieldInput(key, val) {
    // Vue 표시용 로컬 상태만 즉시 업데이트
    form[key] = val
}

function onFieldBlur(key, val) {
    // 포커스 이탈 시 1회 DomainState 반영
    if (!stateRef.value) return
    stateRef.value.data[key] = val
}

async function doSave() {
    if (!stateRef.value || saveStatus.loading) return
    saveStatus.loading = true
    saveStatus.errMsg  = null
    try {
        await stateRef.value.save('/api/users/user_001')
        const last = apiRef.value.getLastCall()
        saveStatus.method  = last.method
        saveStatus.payload = last.body ? JSON.parse(last.body) : null
        saveStatus.success = true
        syncDisplay()
        setTimeout(() => { saveStatus.success = null }, 5000)
    } catch (e) {
        const last = apiRef.value.getLastCall()
        saveStatus.method  = last?.method ?? null
        saveStatus.success = false
        saveStatus.errMsg  = e.status ? `HTTP ${e.status} ${e.statusText}` : String(e)
        syncDisplay()
    } finally {
        saveStatus.loading = false
    }
}

function doReset() {
    Object.assign(form, isNewMode.value ? { userId:'', name:'', email:'', role:'', address:'' } : INITIAL)
    initState()
}

function toggleMode() {
    isNewMode.value = !isNewMode.value
    stateRef.value._isNew = isNewMode.value;
    //DEBUG
    //console.debug("stateRef.value._isNew = ", stateRef.value._isNew);
    initState()
}

const predicted = computed(() => {
    //DEBUG
    //console.debug("[predicted] stateRef.value._isNew = ", stateRef.value._isNew);
    if (display.isNew) return 'POST'
    if (display.dirtyFields.length === 0) return 'PUT'
    if (display.dirtyRatio >= 0.7) return 'PUT'
    return 'PATCH'
})

const METHOD_COLOR = { POST:'#10b981', PUT:'#3b82f6', PATCH:'#f59e0b' }
const methodColor  = computed(() => METHOD_COLOR[predicted.value] ?? '#6b7280')
const reasonText   = computed(() => {
    if (display.isNew)                       return 'isNew = true → POST'
    if (display.dirtyFields.length === 0)    return '변경된 필드 없음 → PUT'
    if (display.dirtyRatio >= 0.7)           return `dirtyRatio = ${(display.dirtyRatio*100).toFixed(0)}% ≥ 70% → PUT`
    return `dirtyRatio = ${(display.dirtyRatio*100).toFixed(0)}% < 70% → PATCH`
})
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">save() HTTP 메서드 자동 분기</div>

    <div v-if="!ready && !err" class="pg-loading">라이브러리 초기화 중…</div>
    <div v-else-if="err" class="pg-loading" style="color:#ef4444">⚠ {{ err }}</div>

    <div v-else class="pg-body">
        <!-- 가이드 -->
        <div class="pg-guide">
            ① 필드를 수정하세요 &nbsp;→&nbsp; ② save() 클릭 &nbsp;→&nbsp; ③ 선택된 HTTP 메서드 확인
        </div>

        <div class="pg-2col">
            <!-- 좌: 입력 패널 -->
            <div class="pg-col">
                <div class="pg-row-between">
                    <span class="pg-label">도메인 데이터</span>
                    <div class="pg-toggle">
                        <button :class="['tgl-btn', !isNewMode && 'on']" @click="isNewMode && toggleMode()">기존 (fromJSON)</button>
                        <button :class="['tgl-btn', isNewMode && 'on']" @click="!isNewMode && toggleMode()">신규 (_isNew)</button>
                    </div>
                </div>

                <div class="pg-fields">
                    <div v-for="key in Object.keys(form)" :key="key" class="pg-field">
                        <label :class="['pg-field-label', display.dirtyFields.includes(key) && 'dirty']">
                            {{ key }}
                            <span v-if="display.dirtyFields.includes(key)" class="dirty-mark">●</span>
                        </label>
                        <input
                            class="pg-input"
                            :value="form[key]"
                            @input="e => onFieldInput(key, e.target.value)"
                            @blur="e => onFieldBlur(key, e.target.value)"
                        />
                    </div>
                </div>

                <div class="pg-row" style="gap:8px">
                    <button class="pg-btn pg-btn-primary" :disabled="saveStatus.loading" @click="doSave">
                        {{ saveStatus.loading ? '저장 중…' : 'save()' }}
                    </button>
                    <button class="pg-btn pg-btn-ghost" @click="doReset">초기화</button>
                </div>

                <!-- 저장 결과 -->
                <div v-if="saveStatus.method" :class="['pg-result', saveStatus.success ? 'ok' : saveStatus.success===false ? 'fail' : '']">
                    <span class="pg-method-badge" :style="{background: methodColor+'22', color: methodColor, borderColor: methodColor}">
                        {{ saveStatus.method }}
                    </span>
                    <span v-if="saveStatus.success" style="color:#059669;font-size:.8rem">✓ 동기화 완료</span>
                    <span v-else-if="saveStatus.success===false" style="color:#dc2626;font-size:.8rem">✗ {{ saveStatus.errMsg }}</span>
                </div>

                <!-- PATCH payload -->
                <div v-if="saveStatus.method==='PATCH' && saveStatus.payload">
                    <div class="pg-label">RFC 6902 PATCH Payload</div>
                    <pre class="pg-pre">{{ JSON.stringify(saveStatus.payload, null, 2) }}</pre>
                </div>
            </div>

            <!-- 우: 상태 패널 -->
            <div class="pg-col">
                <div class="pg-label">예측 HTTP 메서드</div>
                <div class="pg-predict-badge" :style="{background: methodColor+'1a', color: methodColor, borderColor: methodColor}">
                    {{ predicted }}
                </div>
                <div class="pg-reason">{{ reasonText }}</div>

                <div class="pg-label" style="margin-top:4px">
                    dirtyFields ({{ display.dirtyFields.length }} / {{ display.totalFields }})
                </div>
                <div class="pg-chips">
                    <span v-for="f in display.dirtyFields" :key="f" class="pg-chip">{{ f }}</span>
                    <span v-if="!display.dirtyFields.length" class="pg-empty">없음</span>
                </div>

                <div class="pg-label" style="margin-top:4px">changeLog ({{ display.changeLog.length }})</div>
                <div class="pg-changelog">
                    <div v-for="(e, i) in display.changeLog.slice(-6)" :key="i" class="pg-log-row">
                        <span :class="['op', e.op]">{{ e.op }}</span>
                        <span class="pg-mono path">{{ e.path }}</span>
                    </div>
                    <div v-if="!display.changeLog.length" class="pg-empty">변경 없음</div>
                    <div v-if="display.changeLog.length > 6" class="pg-empty">… 외 {{ display.changeLog.length - 6 }}건</div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<style scoped>
.pg-wrap{border:1px solid var(--vp-c-divider);border-radius:12px;overflow:hidden;margin:2rem 0;}
.pg-header{display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--vp-c-brand-soft);border-bottom:1px solid var(--vp-c-divider);font-size:.8rem;font-weight:700;color:var(--vp-c-brand-1);}
.pg-header::before{content:'▶';font-size:.65rem;}
.pg-body{padding:1.25rem;display:flex;flex-direction:column;gap:1rem;}
.pg-loading{padding:2rem;text-align:center;color:var(--vp-c-text-3);font-style:italic;}
.pg-guide{font-size:.78rem;color:var(--vp-c-text-2);background:var(--vp-c-default-soft);padding:7px 12px;border-radius:7px;}
.pg-2col{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
@media(max-width:640px){.pg-2col{grid-template-columns:1fr;}}
.pg-col{display:flex;flex-direction:column;gap:.65rem;}
.pg-row-between{display:flex;align-items:center;justify-content:space-between;}
.pg-row{display:flex;align-items:center;}
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-toggle{display:flex;gap:3px;}
.tgl-btn{padding:2px 9px;border:1px solid var(--vp-c-divider);border-radius:20px;background:transparent;font-size:.72rem;cursor:pointer;color:var(--vp-c-text-3);transition:all .15s;}
.tgl-btn.on{background:var(--vp-c-brand-1);border-color:var(--vp-c-brand-1);color:#fff;}
.pg-fields{display:flex;flex-direction:column;gap:6px;}
.pg-field{display:flex;flex-direction:column;gap:2px;}
.pg-field-label{font-size:.73rem;font-weight:500;color:var(--vp-c-text-3);display:flex;align-items:center;gap:4px;transition:color .2s;}
.pg-field-label.dirty{color:#d97706;}
.dirty-mark{font-size:.55rem;color:#f59e0b;}
.pg-input{padding:5px 9px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font-size:.82rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-input:focus{outline:none;border-color:var(--vp-c-brand-1);}
.pg-btn{padding:7px 16px;border:none;border-radius:7px;font-size:.82rem;font-weight:600;cursor:pointer;transition:opacity .15s;}
.pg-btn:disabled{opacity:.45;cursor:not-allowed;}
.pg-btn-primary{background:var(--vp-c-brand-1);color:#fff;flex:1;}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-result{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--vp-c-divider);}
.pg-result.ok{border-color:#10b981;}
.pg-result.fail{border-color:#ef4444;}
.pg-method-badge{display:inline-block;padding:3px 12px;border-radius:20px;border:1.5px solid;font-weight:700;font-size:.9rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-predict-badge{display:inline-block;padding:5px 16px;border-radius:20px;border:2px solid;font-weight:700;font-size:1.1rem;font-family:var(--vp-font-family-mono,monospace);align-self:flex-start;}
.pg-reason{font-size:.78rem;color:var(--vp-c-text-2);font-family:var(--vp-font-family-mono,monospace);}
.pg-chips{display:flex;flex-wrap:wrap;gap:4px;}
.pg-chip{padding:2px 8px;background:rgba(245,158,11,.12);color:#b45309;border-radius:10px;font-size:.75rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-empty{font-size:.75rem;color:var(--vp-c-text-3);font-style:italic;}
.pg-changelog{display:flex;flex-direction:column;gap:3px;max-height:140px;overflow-y:auto;}
.pg-log-row{display:flex;gap:8px;align-items:center;font-size:.76rem;}
.op{font-weight:700;min-width:52px;font-family:var(--vp-font-family-mono,monospace);}
.op.replace{color:#3b82f6;}.op.add{color:#10b981;}.op.remove{color:#ef4444;}
.path{color:var(--vp-c-text-2);}
.pg-pre{font-size:.73rem;background:var(--vp-c-code-bg);padding:8px 10px;border-radius:6px;overflow-x:auto;margin:0;color:var(--vp-c-brand-1);}
.pg-mono{font-family:var(--vp-font-family-mono,monospace);}
</style>
