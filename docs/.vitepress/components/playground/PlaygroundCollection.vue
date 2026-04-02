<script setup>
/**
 * PlaygroundCollection — DomainCollection add/remove/saveAll 시연
 *
 * 학습 목표:
 *   (1) DomainCollection.fromJSONArray()로 배열을 로드하고
 *       add() / remove()로 항목을 조작한다.
 *   (2) saveAll({ strategy: 'batch' })이 POST / PUT을 자동 분기하며
 *       요청 body에 배열 전체가 포함되는 것을 확인한다.
 *   (3) trackingMode 전환으로 realtime / lazy 동작 차이를 확인한다.
 *   (4) 실패 시 각 항목이 saveAll() 진입 이전 상태로 자동 복원된다.
 */
import { ref, reactive, computed, onMounted } from 'vue'

const ready    = ref(false)
const err      = ref(null)

let DomainCollection, MockApiHandler

const collRef    = ref(null)
const apiRef     = ref(null)
const trackMode  = ref('realtime')  // 'realtime' | 'lazy'
const failMode   = ref(false)
const loading    = ref(false)
const log        = ref([])
const lastCall   = reactive({ method: null, body: null })

// 초기 서버 데이터 (GET 응답 시뮬레이션)
const INITIAL_JSON = JSON.stringify([
    { certId: 1, certName: '정보처리기사', certType: 'IT' },
    { certId: 2, certName: '한국사능력검정', certType: 'HISTORY' },
])

// 새 항목 입력 폼
const newItem = reactive({ certName: '', certType: 'IT' })
const certTypes = ['IT', 'HISTORY', 'LANG', 'ETC']

// 체크 상태 (Vue 로컬 — DomainCollection은 UI 독립적이므로 직접 관리)
const checked = ref(new Set())

// 표시용 항목 목록 (collRef 조작 후 수동 갱신)
const items = ref([])

onMounted(async () => {
    try {
        const lib  = await import('@2davi/rest-domain-state-manager')
        const mock = await import('./MockApiHandler.js')
        DomainCollection = lib.DomainCollection
        MockApiHandler   = mock.MockApiHandler
        doReset()
        ready.value = true
    } catch (e) {
        err.value = e.message
    }
})

// ── 초기화 ──────────────────────────────────────────────────────────────────
function doReset() {
    apiRef.value  = new MockApiHandler({}, { latency: 600 })
    collRef.value = DomainCollection.fromJSONArray(INITIAL_JSON, apiRef.value, {
        trackingMode: trackMode.value,
        itemKey:      'certId',
    })
    checked.value = new Set()
    newItem.certName = ''
    newItem.certType = 'IT'
    log.value = []
    lastCall.method = null
    lastCall.body   = null
    syncItems()
    addLog('info', `fromJSONArray() — ${collRef.value.getCount()}개 항목 로드 (trackingMode: ${trackMode.value})`)
}

function syncItems() {
    items.value = collRef.value
        ? collRef.value.getItems().map(s => ({ ...s._getTarget() }))
        : []
}

// ── 항목 추가 ────────────────────────────────────────────────────────────────
function doAdd() {
    if (!newItem.certName.trim()) return
    collRef.value.add({
        certId:   Date.now(),
        certName: newItem.certName.trim(),
        certType: newItem.certType,
    })
    addLog('info', `add() — "${newItem.certName}" 추가 (총 ${collRef.value.getCount()}개)`)
    newItem.certName = ''
    syncItems()
}

// ── 항목 제거 (역순 LIFO) ────────────────────────────────────────────────────
function doRemoveChecked() {
    if (checked.value.size === 0) return

    const indices = [...checked.value].sort((a, b) => b - a) // 내림차순
    for (const idx of indices) {
        collRef.value.remove(idx)
    }
    addLog('info', `remove() — ${indices.length}개 제거 (LIFO 역순: [${indices.join(', ')}])`)
    checked.value = new Set()
    syncItems()
}

function toggleCheck(idx) {
    const next = new Set(checked.value)
    next.has(idx) ? next.delete(idx) : next.add(idx)
    checked.value = next
}

// ── saveAll ──────────────────────────────────────────────────────────────────
async function doSaveAll() {
    if (!collRef.value || loading.value) return
    loading.value = true
    apiRef.value.setFailMode(failMode.value)

    const isNew = collRef.value._isNew
    addLog('info', `saveAll() 호출 — ${isNew ? 'POST (신규)' : 'PUT (기존 교체)'} 예상`)

    try {
        await collRef.value.saveAll({
            strategy: 'batch',
            path:     '/api/certificates',
        })
        const last = apiRef.value.getLastCall()
        lastCall.method = last.method
        lastCall.body   = last.body ? JSON.parse(last.body) : null
        addLog('success', `✓ ${last.method} 성공 — ${collRef.value.getCount()}개 전송`)
        syncItems()
    } catch (e) {
        const last = apiRef.value.getLastCall()
        lastCall.method = last?.method ?? null
        lastCall.body   = last?.body ? JSON.parse(last.body) : null
        addLog('error', `✗ HTTP ${e.status} — 자동 롤백 완료`)
        addLog('info', `  → 각 항목이 saveAll() 진입 이전 상태로 복원됨`)
        syncItems()
    } finally {
        loading.value = false
    }
}

// ── trackingMode 전환 ────────────────────────────────────────────────────────
function switchTrackMode(mode) {
    trackMode.value = mode
    doReset()
}

// ── 로그 ────────────────────────────────────────────────────────────────────
function addLog(type, msg) {
    log.value.unshift({ type, msg, time: new Date().toLocaleTimeString() })
    if (log.value.length > 12) log.value.pop()
}

// ── 계산값 ───────────────────────────────────────────────────────────────────
const checkedCount = computed(() => checked.value.size)

const changeLogSummary = computed(() => {
    if (!collRef.value) return []
    return collRef.value.getItems().map((s, i) => ({
        idx:       i,
        certName:  s._getTarget().certName,
        logCount:  s._getChangeLog().length,
    }))
})
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">DomainCollection — add / remove / saveAll 시연</div>
    <div v-if="!ready && !err" class="pg-loading">초기화 중…</div>
    <div v-else-if="err" class="pg-loading" style="color:#ef4444">⚠ {{ err }}</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            ① 행 추가/삭제 → ② saveAll() → ③ POST/PUT 분기 및 body 확인<br>
            <strong>trackingMode 전환</strong>으로 realtime/lazy의 changeLog 차이를 확인하세요.
        </div>

        <!-- 모드 토글 바 -->
        <div class="pg-mode-bar">
            <div class="pg-toggle">
                <button :class="['tgl-btn', trackMode === 'realtime' && 'on']"
                    @click="switchTrackMode('realtime')">
                    realtime (기본)
                </button>
                <button :class="['tgl-btn', trackMode === 'lazy' && 'on']"
                    @click="switchTrackMode('lazy')">
                    lazy
                </button>
            </div>
            <label class="pg-fail-toggle">
                <input type="checkbox" v-model="failMode" />
                <span :class="failMode ? 'mode-fail' : 'mode-ok'">
                    {{ failMode ? '실패 모드 ON' : '성공 모드' }}
                </span>
            </label>
        </div>

        <div class="pg-2col">
            <!-- 좌: 컬렉션 조작 -->
            <div class="pg-col">
                <div class="pg-label">컬렉션 항목 ({{ items.length }}개)</div>

                <!-- 항목 목록 -->
                <div class="pg-item-list">
                    <div v-if="items.length === 0" class="pg-empty" style="padding:12px">
                        항목이 없습니다. 아래에서 추가하세요.
                    </div>
                    <div v-for="(item, idx) in items" :key="item.certId"
                        :class="['pg-item', checked.has(idx) && 'checked']"
                        @click="toggleCheck(idx)">
                        <input type="checkbox" :checked="checked.has(idx)"
                            @click.stop="toggleCheck(idx)" class="pg-chk" />
                        <span class="pg-item-name">{{ item.certName }}</span>
                        <span class="pg-item-type">{{ item.certType }}</span>
                        <!-- realtime 모드에서만 changeLog 수 표시 -->
                        <span v-if="trackMode === 'realtime'"
                            :class="['pg-cl-badge', changeLogSummary[idx]?.logCount > 0 && 'has-change']">
                            log: {{ changeLogSummary[idx]?.logCount ?? 0 }}
                        </span>
                    </div>
                </div>

                <!-- 새 항목 입력 -->
                <div class="pg-label">행 추가</div>
                <div class="pg-add-form">
                    <input
                        class="pg-input" placeholder="자격증명"
                        :value="newItem.certName"
                        @input="e => { newItem.certName = e.target.value }"
                        @blur="e => { newItem.certName = e.target.value }"
                        @keyup.enter="doAdd"
                    />
                    <select class="pg-input pg-select" v-model="newItem.certType">
                        <option v-for="t in certTypes" :key="t" :value="t">{{ t }}</option>
                    </select>
                </div>

                <!-- 버튼 -->
                <div class="pg-row" style="gap:8px;flex-wrap:wrap">
                    <button class="pg-btn pg-btn-add" @click="doAdd"
                        :disabled="!newItem.certName.trim()">
                        add()
                    </button>
                    <button class="pg-btn pg-btn-warn" @click="doRemoveChecked"
                        :disabled="checkedCount === 0">
                        remove() {{ checkedCount > 0 ? `(${checkedCount})` : '' }}
                    </button>
                    <button class="pg-btn pg-btn-primary" :disabled="loading" @click="doSaveAll"
                        style="flex:1">
                        {{ loading ? '전송 중…' : `saveAll() → ${collRef?._isNew ? 'POST' : 'PUT'}` }}
                    </button>
                    <button class="pg-btn pg-btn-ghost" @click="doReset">초기화</button>
                </div>

                <!-- lazy 모드 안내 -->
                <div v-if="trackMode === 'lazy'" class="pg-hint">
                    💡 <strong>lazy 모드</strong>: 항목을 수정해도 changeLog가 기록되지 않습니다.<br>
                    saveAll() 시점에 <code>_initialSnapshot</code>과 현재 상태를 비교하여<br>
                    최종 변경분만 계산합니다.
                </div>
            </div>

            <!-- 우: 결과 표시 -->
            <div class="pg-col">
                <!-- 이벤트 로그 -->
                <div class="pg-row-between">
                    <span class="pg-label">이벤트 로그</span>
                    <button class="pg-btn-sm" @click="log=[]">지우기</button>
                </div>
                <div class="pg-log-panel">
                    <div v-for="(e, i) in log" :key="i" :class="['pg-log-item', e.type]">
                        <span class="log-time">{{ e.time }}</span>
                        <span class="log-msg">{{ e.msg }}</span>
                    </div>
                    <div v-if="!log.length" class="pg-empty">조작 후 로그가 표시됩니다</div>
                </div>

                <!-- 마지막 요청 body -->
                <div v-if="lastCall.method" class="pg-result-box">
                    <div class="pg-label" style="margin-bottom:6px">
                        마지막 요청 — {{ lastCall.method }}
                        <span class="pg-body-count" v-if="lastCall.body">
                            ({{ lastCall.body.length }}개 항목)
                        </span>
                    </div>
                    <pre class="pg-pre">{{ JSON.stringify(lastCall.body, null, 2) }}</pre>
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
.pg-mode-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.pg-toggle{display:flex;border:1px solid var(--vp-c-divider);border-radius:7px;overflow:hidden;}
.tgl-btn{padding:5px 14px;font-size:.75rem;font-weight:600;border:none;background:transparent;color:var(--vp-c-text-2);cursor:pointer;}
.tgl-btn.on{background:var(--vp-c-brand-1);color:#fff;}
.pg-fail-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.78rem;font-weight:600;}
.mode-fail{color:#ef4444;}
.mode-ok{color:#10b981;}
.pg-2col{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
@media(max-width:640px){.pg-2col{grid-template-columns:1fr;}}
.pg-col{display:flex;flex-direction:column;gap:.65rem;}
.pg-row-between{display:flex;align-items:center;justify-content:space-between;}
.pg-row{display:flex;align-items:center;}
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-item-list{display:flex;flex-direction:column;gap:4px;min-height:80px;}
.pg-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--vp-c-divider);border-radius:7px;cursor:pointer;transition:background .1s;font-size:.8rem;}
.pg-item:hover{background:var(--vp-c-default-soft);}
.pg-item.checked{background:rgba(99,102,241,.07);border-color:var(--vp-c-brand-2);}
.pg-chk{cursor:pointer;accent-color:var(--vp-c-brand-1);}
.pg-item-name{flex:1;font-weight:500;color:var(--vp-c-text-1);}
.pg-item-type{font-size:.7rem;color:var(--vp-c-text-3);background:var(--vp-c-default-soft);padding:1px 6px;border-radius:4px;}
.pg-cl-badge{font-size:.68rem;padding:1px 6px;border-radius:10px;background:var(--vp-c-default-soft);color:var(--vp-c-text-3);}
.pg-cl-badge.has-change{background:rgba(245,158,11,.12);color:#b45309;}
.pg-add-form{display:flex;gap:6px;}
.pg-input{padding:5px 9px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font-size:.82rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-input:focus{outline:none;border-color:var(--vp-c-brand-1);}
.pg-select{flex-shrink:0;width:80px;}
.pg-btn{padding:7px 12px;border:none;border-radius:7px;font-size:.8rem;font-weight:600;cursor:pointer;transition:opacity .15s;}
.pg-btn:disabled{opacity:.45;cursor:not-allowed;}
.pg-btn-primary{background:var(--vp-c-brand-1);color:#fff;}
.pg-btn-add{background:rgba(16,185,129,.15);color:#059669;border:1px solid rgba(16,185,129,.3);}
.pg-btn-warn{background:rgba(245,158,11,.15);color:#b45309;border:1px solid rgba(245,158,11,.4);}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-btn-sm{padding:2px 8px;border:1px solid var(--vp-c-divider);border-radius:4px;background:transparent;font-size:.7rem;cursor:pointer;color:var(--vp-c-text-3);}
.pg-log-panel{display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto;}
.pg-log-item{display:flex;gap:8px;font-size:.76rem;padding:4px 8px;border-radius:5px;}
.pg-log-item.info{background:rgba(99,102,241,.06);}
.pg-log-item.success{background:rgba(16,185,129,.08);}
.pg-log-item.error{background:rgba(239,68,68,.08);}
.pg-log-item.warn{background:rgba(245,158,11,.08);}
.log-time{color:var(--vp-c-text-3);white-space:nowrap;font-family:var(--vp-font-family-mono,monospace);font-size:.7rem;}
.log-msg{color:var(--vp-c-text-1);line-height:1.5;}
.pg-log-item.success .log-msg{color:#059669;}
.pg-log-item.error .log-msg{color:#dc2626;}
.pg-result-box{background:var(--vp-c-default-soft);border-radius:8px;padding:10px 12px;}
.pg-body-count{font-size:.68rem;color:var(--vp-c-text-3);font-weight:400;margin-left:4px;}
.pg-pre{font-size:.73rem;font-family:var(--vp-font-family-mono,monospace);color:var(--vp-c-text-1);white-space:pre-wrap;word-break:break-all;max-height:180px;overflow-y:auto;margin:0;}
.pg-hint{font-size:.74rem;color:var(--vp-c-text-3);line-height:1.7;background:var(--vp-c-default-soft);padding:8px 10px;border-radius:6px;}
.pg-empty{font-size:.76rem;color:var(--vp-c-text-3);font-style:italic;}
code{font-family:var(--vp-font-family-mono,monospace);background:var(--vp-c-code-bg);padding:1px 5px;border-radius:3px;font-size:.78rem;}
</style>