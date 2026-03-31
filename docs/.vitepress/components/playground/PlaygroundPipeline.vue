<script setup>
/**
 * PlaygroundPipeline — DomainState.all() + failurePolicy 보상 트랜잭션 시연
 *
 * 학습 목표:
 *   DomainState.all()의 병렬 fetch와 after() 체이닝을 이해한다.
 *   failurePolicy에 따라 실패 시 restore()가 어떻게 동작하는지 확인한다.
 *   dsm:pipeline-rollback 이벤트가 발행되는 것을 확인한다.
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const ready = ref(false)
let DomainState, MockApiHandler

const log     = ref([])
const running = ref(false)

// 리소스 A, B, C — 각각 성공/실패 설정 가능
const resources = reactive([
    { key:'order',   label:'주문 정보',   fail:false, status:null },
    { key:'member',  label:'회원 정보',   fail:false, status:null },
    { key:'payment', label:'결제 정보',   fail:false, status:null },
])

const failurePolicy = ref('ignore')  // 'ignore' | 'rollback-all' | 'fail-fast'

const POLICY_OPTS = [
    { val:'ignore',      label:'ignore',      desc:'기본값. 실패를 _errors에 기록하고 계속 진행. 보상 없음.' },
    { val:'rollback-all',label:'rollback-all',desc:'모든 after() 완료 후 에러가 하나라도 있으면 전체 restore().' },
    { val:'fail-fast',   label:'fail-fast',   desc:'첫 번째 after() 실패 시 즉시 중단. 이전 성공분 LIFO restore().' },
]

// dsm:pipeline-rollback 이벤트 리스너
let pipelineRollbackListener = null

onMounted(async () => {
    const lib  = await import('@2davi/rest-domain-state-manager')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    MockApiHandler = mock.MockApiHandler
    ready.value    = true

    pipelineRollbackListener = (e) => {
        addLog('event', `🔔 dsm:pipeline-rollback 이벤트 발생`)
        addLog('event', `  실패 키: ${e.detail?.errors?.map(e=>e.key).join(', ')}`)
    }
    window.addEventListener('dsm:pipeline-rollback', pipelineRollbackListener)
})

onUnmounted(() => {
    if (pipelineRollbackListener)
        window.removeEventListener('dsm:pipeline-rollback', pipelineRollbackListener)
})

function makeHandler(r) {
    const data = { id: r.key + '_001', label: r.label, value: Math.floor(Math.random() * 1000) }
    return new MockApiHandler(data, { latency: 300 + Math.random() * 200, shouldFail: r.fail, failStatus: 500 })
}

async function runPipeline() {
    if (running.value) return
    running.value = true
    log.value     = []
    resources.forEach(r => { r.status = null })

    addLog('info', `파이프라인 시작 — failurePolicy: "${failurePolicy.value}"`)

    // 리소스맵 구성
    const resourceMap = {}
    resources.forEach(r => {
        const h = makeHandler(r)
        resourceMap[r.key] = h._fetch('/api/' + r.key, { method: 'GET' })
            .then(text => {
                const data = typeof text === 'string' ? JSON.parse(text) : text
                return DomainState.fromJSON(JSON.stringify(data), h)
            })
    })

    try {
        const result = await DomainState.all(resourceMap, { failurePolicy: failurePolicy.value })
            .after('order', async (state) => {
                addLog('info', `  after(order) — name 수정 후 save() 시도`)
                state.data.label = '주문-수정됨'
                // after() 내에서 실제 save()는 하지 않고 상태 변화만 기록
                // (서버 없으므로 변이 기록만 남김)
            })
            .after('member', async (state) => {
                if (resources.find(r=>r.key==='member')?.fail) {
                    throw new Error('member 처리 실패 (시뮬레이션)')
                }
                addLog('info', `  after(member) — 처리 완료`)
                state.data.label = '회원-수정됨'
            })
            .after('payment', async (state) => {
                if (resources.find(r=>r.key==='payment')?.fail) {
                    throw new Error('payment 처리 실패 (시뮬레이션)')
                }
                addLog('info', `  after(payment) — 처리 완료`)
                state.data.label = '결제-수정됨'
            })
            .run()

        // 결과 반영
        resources.forEach(r => {
            if (result[r.key]) {
                r.status = 'success'
                addLog('success', `✓ ${r.key} — 성공`)
            } else {
                r.status = 'fail'
            }
        })

        if (result._errors?.length) {
            result._errors.forEach(e => {
                const r = resources.find(r => r.key === e.key)
                if (r) r.status = 'fail'
                addLog('error', `✗ ${e.key} — ${e.error?.message ?? String(e.error)}`)
            })
        }

        addLog('info', `파이프라인 완료`)
    } catch (e) {
        addLog('error', `파이프라인 reject: ${e?.message ?? String(e)}`)
        resources.forEach(r => { if (r.status === null) r.status = 'skip' })
    } finally {
        running.value = false
    }
}

function doReset() {
    resources.forEach(r => { r.fail = false; r.status = null })
    log.value = []
}

function addLog(type, msg) {
    log.value.push({ type, msg, time: new Date().toLocaleTimeString() })
}

const anyFail = computed(() => resources.some(r => r.fail))
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">DomainState.all() — 병렬 fetch · failurePolicy · 보상 트랜잭션</div>
    <div v-if="!ready" class="pg-loading">초기화 중…</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            ① 각 리소스의 성공/실패를 설정 &nbsp;→&nbsp;
            ② failurePolicy 선택 &nbsp;→&nbsp;
            ③ 파이프라인 실행 &nbsp;→&nbsp;
            ④ 결과 및 보상 트랜잭션 로그 확인
        </div>

        <div class="pg-2col">
            <!-- 좌: 설정 패널 -->
            <div class="pg-col">
                <!-- 리소스 토글 -->
                <div class="pg-label">리소스 설정</div>
                <div class="pg-resources">
                    <div v-for="r in resources" :key="r.key" class="pg-resource-row">
                        <div class="pg-resource-info">
                            <span class="res-key">{{ r.key }}</span>
                            <span class="res-label">{{ r.label }}</span>
                            <span v-if="r.status" :class="['res-status', r.status]">
                                {{ r.status === 'success' ? '✓' : r.status === 'fail' ? '✗' : '—' }}
                            </span>
                        </div>
                        <label class="pg-toggle-label">
                            <input type="checkbox" v-model="r.fail" />
                            <span :class="r.fail ? 'mode-fail' : 'mode-ok'">
                                {{ r.fail ? '실패' : '성공' }}
                            </span>
                        </label>
                    </div>
                </div>

                <!-- failurePolicy 선택 -->
                <div class="pg-label" style="margin-top:4px">failurePolicy</div>
                <div class="pg-policy-list">
                    <label
                        v-for="p in POLICY_OPTS"
                        :key="p.val"
                        :class="['pg-policy-item', failurePolicy===p.val && 'selected']">
                        <input type="radio" :value="p.val" v-model="failurePolicy" />
                        <div>
                            <div class="policy-val">{{ p.label }}</div>
                            <div class="policy-desc">{{ p.desc }}</div>
                        </div>
                    </label>
                </div>

                <div class="pg-row" style="gap:8px;margin-top:4px">
                    <button class="pg-btn pg-btn-primary" :disabled="running" @click="runPipeline">
                        {{ running ? '실행 중…' : '파이프라인 실행' }}
                    </button>
                    <button class="pg-btn pg-btn-ghost" @click="doReset">초기화</button>
                </div>
            </div>

            <!-- 우: 실행 로그 -->
            <div class="pg-col">
                <div class="pg-label">실행 로그</div>
                <div class="pg-log-panel">
                    <div v-for="(e, i) in log" :key="i" :class="['pg-log-item', e.type]">
                        <span class="log-time">{{ e.time }}</span>
                        <span class="log-msg">{{ e.msg }}</span>
                    </div>
                    <div v-if="!log.length" class="pg-empty">파이프라인을 실행하면 로그가 표시됩니다</div>
                </div>

                <div class="pg-hint">
                    💡 <strong>ignore</strong>: 실패해도 나머지 진행. restore() 없음.<br>
                    💡 <strong>rollback-all</strong>: 에러 있으면 전체 restore().<br>
                    💡 <strong>fail-fast</strong>: 첫 실패 즉시 중단 + LIFO restore().<br>
                    🔔 보상 발생 시 <code>dsm:pipeline-rollback</code> 이벤트가 발행됩니다.
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
.pg-row{display:flex;align-items:center;}
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-resources{display:flex;flex-direction:column;gap:5px;}
.pg-resource-row{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid var(--vp-c-divider);border-radius:7px;}
.pg-resource-info{display:flex;align-items:center;gap:8px;}
.res-key{font-family:var(--vp-font-family-mono,monospace);font-size:.78rem;font-weight:700;color:var(--vp-c-text-1);}
.res-label{font-size:.76rem;color:var(--vp-c-text-3);}
.res-status{font-weight:700;font-size:.88rem;}
.res-status.success{color:#10b981;}
.res-status.fail{color:#ef4444;}
.pg-toggle-label{display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.76rem;font-weight:600;}
.mode-fail{color:#ef4444;}
.mode-ok{color:#10b981;}
.pg-policy-list{display:flex;flex-direction:column;gap:4px;}
.pg-policy-item{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;border:1px solid var(--vp-c-divider);border-radius:7px;cursor:pointer;transition:border-color .15s;}
.pg-policy-item input{margin-top:2px;flex-shrink:0;}
.pg-policy-item.selected{border-color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft);}
.policy-val{font-family:var(--vp-font-family-mono,monospace);font-size:.78rem;font-weight:700;color:var(--vp-c-text-1);}
.policy-desc{font-size:.72rem;color:var(--vp-c-text-3);line-height:1.5;}
.pg-btn{padding:7px 14px;border:none;border-radius:7px;font-size:.8rem;font-weight:600;cursor:pointer;transition:opacity .15s;}
.pg-btn:disabled{opacity:.45;cursor:not-allowed;}
.pg-btn-primary{background:var(--vp-c-brand-1);color:#fff;flex:1;}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-log-panel{display:flex;flex-direction:column;gap:3px;max-height:280px;overflow-y:auto;}
.pg-log-item{display:flex;gap:8px;font-size:.75rem;padding:3px 7px;border-radius:4px;}
.pg-log-item.info   {background:rgba(99,102,241,.06);}
.pg-log-item.success{background:rgba(16,185,129,.08);}
.pg-log-item.error  {background:rgba(239,68,68,.08);}
.pg-log-item.event  {background:rgba(139,92,246,.08);}
.log-time{color:var(--vp-c-text-3);white-space:nowrap;font-family:var(--vp-font-family-mono,monospace);font-size:.68rem;}
.log-msg{color:var(--vp-c-text-1);line-height:1.5;}
.pg-log-item.success .log-msg{color:#059669;}
.pg-log-item.error   .log-msg{color:#dc2626;}
.pg-log-item.event   .log-msg{color:#7c3aed;}
.pg-empty{font-size:.75rem;color:var(--vp-c-text-3);font-style:italic;}
.pg-hint{font-size:.74rem;color:var(--vp-c-text-3);background:var(--vp-c-default-soft);padding:8px 10px;border-radius:6px;line-height:1.7;}
code{font-family:var(--vp-font-family-mono,monospace);background:var(--vp-c-code-bg);padding:1px 5px;border-radius:3px;font-size:.75rem;}
</style>
