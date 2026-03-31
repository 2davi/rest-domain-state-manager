<script setup>
/**
 * PlaygroundBatching — Microtask 배칭 시연
 *
 * 학습 목표:
 *   동기 블록에서 여러 필드를 변경해도 getSnapshot()은
 *   microtask 완료 후 1회만 갱신된다.
 *   await 경계가 생기면 각 경계마다 별도 갱신이 발생한다.
 *
 * 핵심 변화: _broadcast 내부 스파이 제거 →
 *   subscribe()로 스냅샷 참조 변경 횟수를 카운팅하는 방식으로 전환.
 */
import { shallowRef, ref, reactive, onMounted, onUnmounted } from 'vue'

const ready = ref(false)
let DomainState, MockApiHandler, unsub

const stateRef = shallowRef(null)

const INITIAL = { name: 'Davi', email: 'davi@example.com', role: 'admin' }

// 시나리오별 결과
const scenarios = reactive([
    {
        id:       'sync',
        label:    '동기 블록 (3개 필드 연속 변경)',
        code:     `state.data.name  = 'Lee'\nstate.data.email = 'lee@example.com'\nstate.data.role  = 'guest'`,
        desc:     'Call Stack이 비워진 후 microtask가 한 번에 처리됨 → snapshot 갱신 1회',
        expected: 1,
        count:    null,   // null = 미실행
        running:  false,
        result:   null,   // 'pass' | 'fail'
    },
    {
        id:       'async',
        label:    'await 사이 변경 (경계마다 flush)',
        code:     `state.data.name  = 'Lee'      // flush 예약\nawait delay(0)               // ← microtask 실행\nstate.data.email = 'lee@ex.com'\nawait delay(0)               // ← microtask 실행\nstate.data.role  = 'guest'`,
        desc:     '각 await 경계마다 microtask가 처리됨 → snapshot 갱신 3회',
        expected: 3,
        count:    null,
        running:  false,
        result:   null,
    },
])

onMounted(async () => {
    try {
        const lib  = await import('@2davi/rest-domain-state-manager')
        const mock = await import('./MockApiHandler.js')
        DomainState    = lib.DomainState
        MockApiHandler = mock.MockApiHandler
        initState()
        ready.value = true
    } catch (e) {
        console.error(e)
    }
})

onUnmounted(() => { if (unsub) unsub() })

function initState() {
    if (unsub) unsub()
    stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL), new MockApiHandler(INITIAL, { latency: 0 }))
    // subscribe를 통한 snapshot 변경 카운팅용 — 시나리오 실행 중에만 활성
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function runScenario(s) {
    if (s.running) return
    s.running = true
    s.count   = 0
    s.result  = null

    // 인스턴스 새로 만들어서 이전 시나리오 changeLog가 안 섞이게
    if (unsub) unsub()
    stateRef.value = DomainState.fromJSON(
        JSON.stringify(INITIAL),
        new MockApiHandler(INITIAL, { latency: 0 })
    )

    // subscribe로 snapshot 갱신 횟수 카운팅
    unsub = stateRef.value.subscribe(() => { s.count++ })

    if (s.id === 'sync') {
        // 동기 블록 — 3개 필드 한 번에 변경
        stateRef.value.data.name  = 'Lee'
        stateRef.value.data.email = 'lee@example.com'
        stateRef.value.data.role  = 'guest'
        // microtask 완료 대기
        await delay(50)
    } else {
        // await 사이 변경 — 각 경계마다 flush
        stateRef.value.data.name  = 'Lee'
        await delay(0)
        stateRef.value.data.email = 'lee@example.com'
        await delay(0)
        stateRef.value.data.role  = 'guest'
        await delay(50)
    }

    s.result  = s.count === s.expected ? 'pass' : 'fail'
    s.running = false
}

function resetAll() {
    scenarios.forEach(s => {
        s.count  = null
        s.result = null
        s.running = false
    })
    initState()
}
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">Microtask 배칭 — subscribe() 갱신 횟수 시연</div>
    <div v-if="!ready" class="pg-loading">초기화 중…</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            각 시나리오의 <strong>실행</strong> 버튼을 클릭하여 subscribe() 콜백이 몇 회 호출되는지 확인하세요.
        </div>

        <div v-for="s in scenarios" :key="s.id" class="pg-scenario">
            <div class="pg-scenario-header">
                <span class="pg-scenario-label">{{ s.label }}</span>
                <div class="pg-scenario-actions">
                    <div v-if="s.count !== null" :class="['pg-badge', s.result]">
                        호출 {{ s.count }}회
                        <span v-if="s.result === 'pass'"> ✓ (예상 {{ s.expected }}회)</span>
                        <span v-else-if="s.result === 'fail'"> ✗ (예상 {{ s.expected }}회)</span>
                    </div>
                    <button
                        :class="['pg-btn', s.running && 'running']"
                        :disabled="s.running"
                        @click="runScenario(s)">
                        {{ s.running ? '실행 중…' : '실행' }}
                    </button>
                </div>
            </div>

            <pre class="pg-code">{{ s.code }}</pre>
            <div class="pg-desc">{{ s.desc }}</div>
        </div>

        <!-- 원리 요약 -->
        <div class="pg-summary">
            <div class="pg-summary-row">
                <span class="sum-icon">⚡</span>
                <span><strong>동기 블록</strong>: 여러 set 트랩이 발화해도 queueMicrotask는 1회만 예약됨 → subscribe 콜백 1회</span>
            </div>
            <div class="pg-summary-row">
                <span class="sum-icon">⏸</span>
                <span><strong>await 경계</strong>: 각 await 직전에 microtask 큐가 비워짐 → 경계마다 subscribe 콜백 발화</span>
            </div>
        </div>

        <button class="pg-reset" @click="resetAll">결과 초기화</button>
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
.pg-scenario{border:1px solid var(--vp-c-divider);border-radius:9px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
.pg-scenario-header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.pg-scenario-label{font-size:.82rem;font-weight:600;color:var(--vp-c-text-1);}
.pg-scenario-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.pg-badge{font-size:.76rem;font-weight:600;padding:3px 10px;border-radius:20px;font-family:var(--vp-font-family-mono,monospace);}
.pg-badge.pass{background:rgba(16,185,129,.12);color:#059669;}
.pg-badge.fail{background:rgba(239,68,68,.1);color:#dc2626;}
.pg-code{font-size:.72rem;background:var(--vp-c-code-bg);padding:8px 10px;border-radius:6px;margin:0;overflow-x:auto;white-space:pre;font-family:var(--vp-font-family-mono,monospace);color:var(--vp-c-text-2);line-height:1.6;}
.pg-desc{font-size:.76rem;color:var(--vp-c-text-3);}
.pg-btn{padding:5px 14px;border:1px solid var(--vp-c-brand-1);border-radius:6px;background:var(--vp-c-brand-1);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer;transition:opacity .15s;}
.pg-btn:disabled,.pg-btn.running{opacity:.5;cursor:not-allowed;}
.pg-summary{background:var(--vp-c-default-soft);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;}
.pg-summary-row{display:flex;gap:10px;align-items:flex-start;font-size:.77rem;color:var(--vp-c-text-2);line-height:1.6;}
.sum-icon{flex-shrink:0;font-size:.9rem;}
.pg-reset{align-self:flex-start;padding:5px 14px;border:1px solid var(--vp-c-divider);border-radius:6px;background:transparent;font-size:.76rem;cursor:pointer;color:var(--vp-c-text-3);}
</style>
