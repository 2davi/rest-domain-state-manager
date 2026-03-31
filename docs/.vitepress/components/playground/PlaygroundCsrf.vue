<script setup>
/**
 * PlaygroundCsrf — ApiHandler.init() CSRF 인터셉터 3-상태 시연
 *
 * 학습 목표:
 *   init() 호출 여부와 meta 태그 유무에 따라
 *   X-CSRF-Token 헤더 주입 동작이 어떻게 달라지는지 이해한다.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

const STATE_DEFS = [
    { val:'undefined', color:'#6b7280', desc:'init() 미호출. CSRF 비활성. 토큰 없이 요청 전송됨.' },
    { val:'null',      color:'#ef4444', desc:'init() 호출됐으나 토큰 파싱 실패. 변이 요청 시 즉시 throw.' },
    { val:'string',    color:'#10b981', desc:'토큰 정상 파싱됨. X-CSRF-Token 헤더 자동 주입됨.' },
]
const TOKEN_VALUE = 'csrf-demo-abc123'
const INITIAL_DATA = { userId:'user_001', name:'Davi', role:'admin' }

const ready      = ref(false)
const metaAdded  = ref(false)
const initCalled = ref(false)
const tokenFound = ref(false)
const log        = ref([])
const loading    = ref(false)

let ApiHandlerClass, DomainStateClass, apiInst, stateInst, mockInst

onMounted(async () => {
    const lib  = await import('@2davi/rest-domain-state-manager')
    const mock = await import('./MockApiHandler.js')
    ApiHandlerClass  = lib.ApiHandler
    DomainStateClass = lib.DomainState
    buildInstances(mock.MockApiHandler)
    ready.value = true
})

onUnmounted(() => removeMeta())

function buildInstances(MockApiHandler) {
    removeMeta()
    metaAdded.value  = false
    initCalled.value = false
    tokenFound.value = false
    log.value        = []
    mockInst  = new MockApiHandler(INITIAL_DATA, { latency: 400 })
    apiInst   = new ApiHandlerClass({ host: 'api.example.dev' })
    // MockApiHandler로 _fetch 교체 (SSR 환경에서는 실제 fetch 대신 mock 사용)
    apiInst._fetch      = (url, opts) => mockInst._fetch(url, opts)
    apiInst.getLastCall = () => mockInst.getLastCall()
    stateInst = DomainStateClass.fromJSON(JSON.stringify(INITIAL_DATA), apiInst)
    addLog('info', '초기화 완료 — init() 미호출 상태 (undefined)')
}

function toggleMeta() {
    if (metaAdded.value) {
        removeMeta()
        metaAdded.value = false
        addLog('info', 'meta[name="_csrf"] 제거됨')
    } else {
        const m = document.createElement('meta')
        m.name    = '_csrf'
        m.content = TOKEN_VALUE
        document.head.appendChild(m)
        metaAdded.value = true
        addLog('info', `meta[name="_csrf"] 추가됨 — content: "${TOKEN_VALUE}"`)
    }
}

function removeMeta() {
    document.querySelector('meta[name="_csrf"]')?.remove()
}

function doInit() {
    apiInst.init({})
    initCalled.value = true
    const found = document.querySelector('meta[name="_csrf"]')?.content ?? null
    tokenFound.value = !!found
    if (found) {
        addLog('success', `init() 완료 → #csrfToken = "${found}"`)
    } else {
        addLog('error', 'init() 완료 → 토큰 파싱 실패 → #csrfToken = null')
    }
}

async function doSave() {
    if (!stateInst || loading.value) return
    loading.value = true
    stateInst.data.name = 'Davi-' + Date.now()
    addLog('info', 'save() → PATCH 요청 시도…')
    try {
        await stateInst.save('/api/users/user_001')
        const last  = apiInst.getLastCall()
        const token = last?.headers?.['X-CSRF-Token']
        if (token) {
            addLog('success', `✓ ${last.method} 성공 — X-CSRF-Token: "${token}"`)
        } else {
            addLog('success', `✓ ${last.method} 성공 — X-CSRF-Token 헤더 없음 (init() 미호출)`)
        }
    } catch (e) {
        const msg = e?.message ?? String(e)
        if (msg.toLowerCase().includes('csrf')) {
            addLog('error', '✗ CSRF 토큰 없음 — 요청 서버 미전달 (throw)')
            addLog('error', `  → ${msg}`)
        } else if (e?.status) {
            addLog('error', `✗ HTTP ${e.status} ${e.statusText}`)
        } else {
            addLog('error', `✗ ${msg}`)
        }
    } finally {
        loading.value = false
    }
}

function doReset() {
    buildInstances(mockInst.constructor)
    addLog('info', '전체 초기화')
}

function addLog(type, msg) {
    log.value.unshift({ type, msg, time: new Date().toLocaleTimeString() })
    if (log.value.length > 12) log.value.pop()
}

const currentState = computed(() => {
    if (!initCalled.value) return 'undefined'
    return tokenFound.value ? 'string' : 'null'
})
const currentColor = computed(() => STATE_DEFS.find(s => s.val === currentState.value)?.color ?? '#6b7280')
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">ApiHandler.init() — CSRF 인터셉터 3-상태 시연</div>
    <div v-if="!ready" class="pg-loading">초기화 중…</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            ① meta 태그 추가/제거 &nbsp;→&nbsp;
            ② api.init() 호출 &nbsp;→&nbsp;
            ③ save() 실행 &nbsp;→&nbsp;
            ④ 헤더 포함 여부 로그 확인
        </div>

        <div class="pg-2col">
            <!-- 좌: 단계별 제어 -->
            <div class="pg-col">
                <!-- STEP 1 -->
                <div class="pg-step-box">
                    <div class="pg-step-num">STEP 1 — DOM meta 태그</div>
                    <div class="pg-meta-preview" :class="metaAdded ? 'present' : 'absent'">
                        <code v-if="metaAdded">&lt;meta name="_csrf" content="{{ TOKEN_VALUE }}"&gt;</code>
                        <span v-else class="pg-empty">meta[name="_csrf"] 없음</span>
                    </div>
                    <button
                        :class="['pg-btn', metaAdded ? 'pg-btn-ghost' : 'pg-btn-primary']"
                        @click="toggleMeta">
                        {{ metaAdded ? '태그 제거' : '태그 추가' }}
                    </button>
                </div>

                <!-- STEP 2 -->
                <div class="pg-step-box">
                    <div class="pg-step-num">STEP 2 — init() 호출</div>
                    <div class="pg-token-state"
                        :style="{background:currentColor+'18', color:currentColor, borderColor:currentColor+'60'}">
                        #csrfToken = <strong>{{ currentState }}</strong>
                    </div>
                    <button class="pg-btn pg-btn-primary" @click="doInit">
                        api.init({})
                    </button>
                </div>

                <!-- STEP 3 -->
                <div class="pg-step-box">
                    <div class="pg-step-num">STEP 3 — 변이 요청</div>
                    <button class="pg-btn pg-btn-primary" :disabled="loading" @click="doSave">
                        {{ loading ? '처리 중…' : 'save() 실행' }}
                    </button>
                </div>

                <button class="pg-btn pg-btn-ghost" style="margin-top:2px" @click="doReset">
                    전체 초기화
                </button>
            </div>

            <!-- 우: 3-상태 표 + 로그 -->
            <div class="pg-col">
                <div class="pg-label">3-상태 설계</div>
                <div class="pg-state-table">
                    <div
                        v-for="s in STATE_DEFS"
                        :key="s.val"
                        :class="['pg-state-row', currentState === s.val && 'active']">
                        <span class="state-val" :style="{color:s.color}">{{ s.val }}</span>
                        <span class="state-desc">{{ s.desc }}</span>
                    </div>
                </div>

                <div class="pg-label" style="margin-top:8px">실행 로그</div>
                <div class="pg-log-panel">
                    <div v-for="(e, i) in log" :key="i" :class="['pg-log-item', e.type]">
                        <span class="log-time">{{ e.time }}</span>
                        <span class="log-msg">{{ e.msg }}</span>
                    </div>
                    <div v-if="!log.length" class="pg-empty">버튼을 클릭하면 로그가 표시됩니다</div>
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
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-step-box{border:1px solid var(--vp-c-divider);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;}
.pg-step-num{font-size:.7rem;font-weight:700;color:var(--vp-c-brand-1);letter-spacing:.05em;}
.pg-meta-preview{font-size:.73rem;padding:7px 10px;border-radius:5px;font-family:var(--vp-font-family-mono,monospace);min-height:30px;display:flex;align-items:center;}
.pg-meta-preview.present{background:rgba(16,185,129,.1);color:#059669;}
.pg-meta-preview.absent{background:var(--vp-c-default-soft);color:var(--vp-c-text-3);}
.pg-token-state{padding:5px 10px;border-radius:6px;border:1px solid;font-size:.8rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-btn{padding:7px 14px;border:none;border-radius:7px;font-size:.8rem;font-weight:600;cursor:pointer;transition:opacity .15s;width:100%;}
.pg-btn:disabled{opacity:.45;cursor:not-allowed;}
.pg-btn-primary{background:var(--vp-c-brand-1);color:#fff;}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-state-table{display:flex;flex-direction:column;gap:4px;}
.pg-state-row{display:flex;gap:10px;align-items:flex-start;padding:6px 8px;border-radius:6px;border:1px solid transparent;transition:background .2s;}
.pg-state-row.active{background:var(--vp-c-default-soft);border-color:var(--vp-c-divider);}
.state-val{font-family:var(--vp-font-family-mono,monospace);font-size:.78rem;font-weight:700;min-width:70px;flex-shrink:0;padding-top:1px;}
.state-desc{font-size:.74rem;color:var(--vp-c-text-2);line-height:1.55;}
.pg-log-panel{display:flex;flex-direction:column;gap:3px;max-height:180px;overflow-y:auto;}
.pg-log-item{display:flex;gap:8px;font-size:.75rem;padding:3px 7px;border-radius:4px;}
.pg-log-item.info   {background:rgba(99,102,241,.06);}
.pg-log-item.success{background:rgba(16,185,129,.08);}
.pg-log-item.error  {background:rgba(239,68,68,.08);}
.log-time{color:var(--vp-c-text-3);white-space:nowrap;font-family:var(--vp-font-family-mono,monospace);font-size:.68rem;}
.log-msg{color:var(--vp-c-text-1);line-height:1.5;}
.pg-log-item.success .log-msg{color:#059669;}
.pg-log-item.error   .log-msg{color:#dc2626;}
.pg-empty{font-size:.75rem;color:var(--vp-c-text-3);font-style:italic;}
code{font-family:var(--vp-font-family-mono,monospace);background:var(--vp-c-code-bg);padding:1px 5px;border-radius:3px;font-size:.75rem;}
</style>
