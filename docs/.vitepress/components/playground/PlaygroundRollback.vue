<script setup>
/**
 * PlaygroundRollback — 롤백 시연
 *
 * 학습 목표:
 *   (1) save() 실패 시 인메모리 상태가 자동으로 복원된다.
 *   (2) restore()는 save() 성공 후에도 수동으로 이전 상태로 돌릴 수 있다 (보상 트랜잭션).
 *   두 경로의 차이를 직접 확인한다.
 *
 * TC: TC-DS-006 (4xx → 롤백), TC-DS-009 (롤백 후 재시도 → 동일 메서드)
 */
import { shallowRef, ref, reactive, onMounted, onUnmounted } from 'vue'

const ready = ref(false)
let DomainState, MockApiHandler, unsub

const stateRef = shallowRef(null)
const apiRef   = ref(null)
const INITIAL  = { userId:'user_001', name:'Davi', email:'davi@example.com', role:'admin' }

const form      = reactive({ ...INITIAL })
const failMode  = ref(false)
const log       = ref([])
const loading   = ref(false)
const snapshot  = reactive({ before: null, after: null })  // 마지막 save() 전후 data

// dsm:rollback 이벤트 리스너 핸들러 참조 (cleanup용)
let rollbackListener = null

onMounted(async () => {
    const lib  = await import('@2davi/rest-domain-state-manager')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    MockApiHandler = mock.MockApiHandler
    doReset()
    ready.value = true

    // dsm:rollback 이벤트 구독
    rollbackListener = (e) => {
        addLog('event', `🔔 dsm:rollback 이벤트 발생 — label: "${e.detail?.label}"`)
    }
    window.addEventListener('dsm:rollback', rollbackListener)
})

onUnmounted(() => {
    if (unsub) unsub()
    if (rollbackListener) window.removeEventListener('dsm:rollback', rollbackListener)
})

function doReset() {
    if (unsub) unsub()
    apiRef.value   = new MockApiHandler(INITIAL, { latency: 500 })
    stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL), apiRef.value)
    Object.assign(form, INITIAL)
    log.value      = []
    snapshot.before = null
    snapshot.after  = null
    addLog('info', '인스턴스 초기화 완료')
    unsub = stateRef.value.subscribe(() => {
        Object.assign(form, stateRef.value._getTarget())
    })
}

function onFieldInput(key, val) {
    if (!stateRef.value) return
    stateRef.value.data[key] = val
}

async function doSave() {
    if (!stateRef.value || loading.value) return
    loading.value = true
    apiRef.value.setFailMode(failMode.value)

    const before = { ...stateRef.value._getTarget() }
    snapshot.before = before.name
    addLog('info', `save() 호출 — name: "${before.name}", failMode: ${failMode.value}`)

    try {
        await stateRef.value.save('/api/users/user_001')
        const last = apiRef.value.getLastCall()
        snapshot.after = stateRef.value._getTarget().name
        addLog('success', `✓ ${last.method} 성공 — changeLog 초기화됨`)
        addLog('info', `  → restore() 버튼으로 수동 보상 가능 (save() 이전 상태로 복원)`)
    } catch (e) {
        snapshot.after = stateRef.value._getTarget().name
        addLog('error', `✗ HTTP ${e.status} — 자동 롤백 완료`)
        addLog('info', `  → name 복원: "${stateRef.value._getTarget().name}"`)
    } finally {
        loading.value = false
    }
}

function doRestore() {
    if (!stateRef.value) return
    const result = stateRef.value.restore()
    if (result) {
        addLog('warn', `restore() 수동 호출 — 인메모리 상태 복원됨`)
        addLog('info', `  → name: "${stateRef.value._getTarget().name}"`)
    } else {
        addLog('warn', `restore(): 스냅샷 없음 (save() 미호출 또는 이미 복원됨)`)
    }
}

function addLog(type, msg) {
    log.value.unshift({ type, msg, time: new Date().toLocaleTimeString() })
    if (log.value.length > 10) log.value.pop()
}
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">Optimistic Update 롤백 &amp; restore() 보상 트랜잭션</div>
    <div v-if="!ready" class="pg-loading">초기화 중…</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            <strong>자동 롤백</strong>: 실패 모드 ON → save() 클릭 → 상태가 자동 복원됨<br>
            <strong>수동 보상</strong>: 성공 모드 → save() 클릭 → restore() 클릭 → 이전 상태로 복원됨
        </div>

        <div class="pg-2col">
            <!-- 좌: 조작 패널 -->
            <div class="pg-col">
                <div class="pg-row-between">
                    <span class="pg-label">데이터 편집</span>
                    <label class="pg-fail-toggle">
                        <input type="checkbox" v-model="failMode" />
                        <span :class="failMode ? 'mode-fail' : 'mode-ok'">
                            {{ failMode ? '실패 모드 ON' : '성공 모드' }}
                        </span>
                    </label>
                </div>

                <div class="pg-fields">
                    <div v-for="key in Object.keys(form)" :key="key" class="pg-field">
                        <label class="pg-field-label">{{ key }}</label>
                        <input class="pg-input" :value="form[key]"
                            @input="e => { form[key]=e.target.value; onFieldInput(key, e.target.value) }" />
                    </div>
                </div>

                <div class="pg-row" style="gap:8px">
                    <button class="pg-btn pg-btn-primary" :disabled="loading" @click="doSave">
                        {{ loading ? '처리 중…' : 'save()' }}
                    </button>
                    <button class="pg-btn pg-btn-warn" @click="doRestore">restore()</button>
                    <button class="pg-btn pg-btn-ghost" @click="doReset">초기화</button>
                </div>

                <!-- 스냅샷 비교 -->
                <div v-if="snapshot.before !== null" class="pg-snapshot-box">
                    <div class="pg-label">name 값 변화</div>
                    <div class="pg-snap-row">
                        <span class="snap-label">save() 전</span>
                        <span class="snap-val">{{ snapshot.before }}</span>
                    </div>
                    <div class="pg-snap-row">
                        <span class="snap-label">현재</span>
                        <span class="snap-val" :class="form.name === snapshot.before ? 'restored' : ''">
                            {{ form.name }}
                            <span v-if="form.name === snapshot.before" class="restored-badge">복원됨</span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- 우: 이벤트 로그 -->
            <div class="pg-col">
                <div class="pg-row-between">
                    <span class="pg-label">이벤트 로그</span>
                    <button class="pg-btn-sm" @click="log=[]">지우기</button>
                </div>
                <div class="pg-log-panel">
                    <div v-for="(e, i) in log" :key="i" :class="['pg-log-item', e.type]">
                        <span class="log-time">{{ e.time }}</span>
                        <span class="log-msg">{{ e.msg }}</span>
                    </div>
                    <div v-if="!log.length" class="pg-empty">save() 또는 restore()를 실행하면 로그가 표시됩니다</div>
                </div>

                <div class="pg-hint">
                    💡 <code>restore()</code>는 인메모리 상태만 복원합니다.<br>
                    서버에 커밋된 내역 롤백은 소비자 책임입니다.<br>
                    💡 <code>dsm:rollback</code> 이벤트로 UI 알림을 구현할 수 있습니다.
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
.pg-guide{font-size:.78rem;color:var(--vp-c-text-2);background:var(--vp-c-default-soft);padding:8px 12px;border-radius:7px;line-height:1.8;}
.pg-2col{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
@media(max-width:640px){.pg-2col{grid-template-columns:1fr;}}
.pg-col{display:flex;flex-direction:column;gap:.65rem;}
.pg-row-between{display:flex;align-items:center;justify-content:space-between;}
.pg-row{display:flex;align-items:center;}
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-fail-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.78rem;font-weight:600;}
.mode-fail{color:#ef4444;}
.mode-ok{color:#10b981;}
.pg-fields{display:flex;flex-direction:column;gap:5px;}
.pg-field{display:flex;flex-direction:column;gap:2px;}
.pg-field-label{font-size:.72rem;font-weight:500;color:var(--vp-c-text-3);}
.pg-input{padding:5px 9px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font-size:.82rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-input:focus{outline:none;border-color:var(--vp-c-brand-1);}
.pg-btn{padding:7px 12px;border:none;border-radius:7px;font-size:.8rem;font-weight:600;cursor:pointer;transition:opacity .15s;}
.pg-btn:disabled{opacity:.45;cursor:not-allowed;}
.pg-btn-primary{background:var(--vp-c-brand-1);color:#fff;flex:1;}
.pg-btn-warn{background:rgba(245,158,11,.15);color:#b45309;border:1px solid rgba(245,158,11,.4);}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-btn-sm{padding:2px 8px;border:1px solid var(--vp-c-divider);border-radius:4px;background:transparent;font-size:.7rem;cursor:pointer;color:var(--vp-c-text-3);}
.pg-snapshot-box{background:var(--vp-c-default-soft);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;}
.pg-snap-row{display:flex;align-items:center;gap:10px;}
.snap-label{font-size:.72rem;color:var(--vp-c-text-3);min-width:65px;}
.snap-val{font-family:var(--vp-font-family-mono,monospace);font-size:.82rem;color:var(--vp-c-text-1);display:flex;align-items:center;gap:6px;}
.snap-val.restored{color:#059669;}
.restored-badge{font-size:.68rem;background:rgba(16,185,129,.15);color:#059669;padding:1px 6px;border-radius:10px;font-family:sans-serif;font-weight:600;}
.pg-log-panel{display:flex;flex-direction:column;gap:3px;max-height:240px;overflow-y:auto;}
.pg-log-item{display:flex;gap:8px;font-size:.76rem;padding:4px 8px;border-radius:5px;}
.pg-log-item.info{background:rgba(99,102,241,.06);}
.pg-log-item.success{background:rgba(16,185,129,.08);}
.pg-log-item.error{background:rgba(239,68,68,.08);}
.pg-log-item.warn{background:rgba(245,158,11,.08);}
.pg-log-item.event{background:rgba(139,92,246,.08);}
.log-time{color:var(--vp-c-text-3);white-space:nowrap;font-family:var(--vp-font-family-mono,monospace);font-size:.7rem;}
.log-msg{color:var(--vp-c-text-1);line-height:1.5;}
.pg-log-item.success .log-msg{color:#059669;}
.pg-log-item.error .log-msg{color:#dc2626;}
.pg-log-item.event .log-msg{color:#7c3aed;}
.pg-empty{font-size:.76rem;color:var(--vp-c-text-3);font-style:italic;}
.pg-hint{font-size:.74rem;color:var(--vp-c-text-3);line-height:1.7;background:var(--vp-c-default-soft);padding:8px 10px;border-radius:6px;}
code{font-family:var(--vp-font-family-mono,monospace);background:var(--vp-c-code-bg);padding:1px 5px;border-radius:3px;font-size:.78rem;}
</style>
