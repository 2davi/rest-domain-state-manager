<script setup>
/**
 * PlaygroundBatching
 *
 * TC-DS-010: 동기 블록 다중 변경 → _broadcast 1회
 *
 * 핵심 시연 포인트:
 * - 3개 필드를 동기 블록 안에서 한 번에 바꾸면 _broadcast는 microtask 이후 정확히 1회만 호출된다.
 * - 반면 각 필드를 await 사이에 하나씩 바꾸면 3회 호출된다.
 * - 디버그 패널과 직접 연결하지 않고 _broadcast를 직접 spy해서 횟수를 시각화한다.
 */
import { ref, reactive, onMounted } from 'vue'

const ready = ref(false)
const error = ref(null)

let DomainState, MockApiHandler

const stateRef = ref(null)

// 시나리오별 broadcast 횟수 기록
const scenarios = reactive([
    {
        id:        'sync',
        label:     '동기 블록 변경',
        code:      `state.data.name  = 'Lee'\nstate.data.email = 'lee@example.com'\nstate.data.role  = 'guest'`,
        desc:      '3개 필드를 동기적으로 연속 변경. Call Stack이 비워진 후 microtask가 한 번에 실행된다.',
        count:     null,     // null = 미실행, 숫자 = 실행됨
        expected:  1,
        running:   false,
        result:    null,     // 'pass' | 'fail'
    },
    {
        id:        'async',
        label:     'await 사이 변경',
        code:      `state.data.name  = 'Lee'         // flush 예약\nawait delay(0)                  // ← microtask 실행됨\nstate.data.email = 'lee@ex.com'\nawait delay(0)                  // ← microtask 실행됨\nstate.data.role  = 'guest'`,
        desc:      '각 변경 사이에 await를 삽입. await 경계마다 microtask가 처리되어 별도의 flush가 실행된다.',
        count:     null,
        expected:  3,
        running:   false,
        result:    null,
    },
])

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

const INITIAL_DATA = { name: 'Davi', email: 'davi@example.com', role: 'admin' }

function initState() {
    const api  = new MockApiHandler(INITIAL_DATA)
    stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL_DATA), api, { debug: true })
    scenarios.forEach(s => { s.count = null; s.result = null; s.running = false })
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function runScenario(scenario) {
    if (!stateRef.value || scenario.running) return
    scenario.running = true
    scenario.count   = null
    scenario.result  = null

    // 인스턴스 재생성 (이전 실행 오염 방지)
    initState()
    await delay(50)   // initState의 constructor _broadcast 완료 대기

    // _broadcast 호출 횟수 spy
    let callCount = 0
    const original = stateRef.value._broadcast.bind(stateRef.value)
    stateRef.value._broadcast = function() {
        callCount++
        original()
    }

    if (scenario.id === 'sync') {
        // ── 시나리오 1: 동기 블록 ──────────────────────────────
        stateRef.value.data.name  = 'Lee'
        stateRef.value.data.email = 'lee@example.com'
        stateRef.value.data.role  = 'guest'
        // 동기 블록 끝 — 아직 microtask 미실행
        // queueMicrotask 로 기다려서 flush 완료 후 카운트 읽기
        await new Promise(r => queueMicrotask(r))
        await new Promise(r => queueMicrotask(r))   // 한 단계 더 (flush 내부 처리 완료 보장)

    } else {
        // ── 시나리오 2: await 사이 변경 ───────────────────────
        stateRef.value.data.name = 'Lee'
        await delay(0)          // microtask 처리 → 1회 flush
        stateRef.value.data.email = 'lee@example.com'
        await delay(0)          // microtask 처리 → 2회 flush
        stateRef.value.data.role = 'guest'
        await new Promise(r => queueMicrotask(r))
        await new Promise(r => queueMicrotask(r))   // 마지막 flush 완료 대기
    }

    scenario.count  = callCount
    scenario.result = callCount === scenario.expected ? 'pass' : 'fail'
    scenario.running = false
}

function handleReset() { initState() }
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">Microtask 배칭 — _broadcast 호출 횟수 시연</div>

        <div v-if="!ready && !error" class="playground-body pg-loading">초기화 중...</div>
        <div v-else-if="error" class="playground-body pg-error">⚠ {{ error }}</div>

        <div v-else class="playground-body">

            <div class="pg-explain">
                <code>_scheduleFlush()</code> 스케줄러는 동기 블록 내 다중 변경을 단일 microtask로 병합합니다.
                두 시나리오를 직접 실행하고 <code>_broadcast()</code> 호출 횟수를 확인해보세요.
            </div>

            <div class="pg-scenarios">
                <div v-for="s in scenarios" :key="s.id" class="pg-scenario">

                    <!-- 시나리오 헤더 -->
                    <div class="pg-scenario-header">
                        <div class="pg-scenario-title">{{ s.label }}</div>
                        <div class="pg-scenario-expected">예상: _broadcast {{ s.expected }}회</div>
                    </div>

                    <!-- 코드 블록 -->
                    <pre class="pg-code">{{ s.code }}</pre>

                    <!-- 설명 -->
                    <div class="pg-scenario-desc">{{ s.desc }}</div>

                    <!-- 실행 버튼 + 결과 -->
                    <div class="pg-scenario-footer">
                        <button
                            class="pg-btn-run"
                            :disabled="s.running"
                            @click="runScenario(s)"
                        >
                            {{ s.running ? '실행 중...' : '▶ 실행' }}
                        </button>

                        <div v-if="s.count !== null" :class="['pg-result', s.result]">
                            <span class="pg-result-icon">{{ s.result === 'pass' ? '✓' : '✗' }}</span>
                            <span class="pg-result-text">
                                _broadcast() 호출 <strong>{{ s.count }}회</strong>
                                <span class="pg-result-badge">{{ s.result === 'pass' ? '예상과 일치' : '예상과 다름' }}</span>
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            <!-- 원리 설명 다이어그램 -->
            <div class="pg-diagram">
                <div class="pg-diagram-title">이벤트 루프 실행 순서</div>
                <div class="pg-timeline">
                    <div class="tl-row">
                        <div class="tl-label call-stack">Call Stack</div>
                        <div class="tl-blocks">
                            <div class="tl-block change">name='A'</div>
                            <div class="tl-block change">email='B'</div>
                            <div class="tl-block change">role='C'</div>
                            <div class="tl-spacer"></div>
                        </div>
                    </div>
                    <div class="tl-row">
                        <div class="tl-label microtask">Microtask</div>
                        <div class="tl-blocks">
                            <div class="tl-spacer wide"></div>
                            <div class="tl-block flush">flush() → _broadcast() × 1</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pg-footer-actions">
                <button class="pg-btn-reset" @click="handleReset">초기화</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.playground-wrapper { border:1px solid var(--dsm-playground-border,#ccc9e0); border-radius:12px; overflow:hidden; margin:2rem 0; background:var(--dsm-playground-bg,#faf9fd); }
.playground-header { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(90,90,143,0.08); border-bottom:1px solid var(--dsm-playground-border,#ccc9e0); font-size:0.82rem; font-weight:600; color:var(--vp-c-brand-1,#5a5a8f); }
.playground-header::before { content:'▶'; font-size:0.7rem; }
.playground-body { padding:1.5rem; display:flex; flex-direction:column; gap:1.4rem; }
.pg-loading,.pg-error { text-align:center; color:var(--vp-c-text-3); }
.pg-error { color:#ef4444; }

.pg-explain { font-size:0.82rem; color:var(--vp-c-text-2); line-height:1.6; }
.pg-explain code { font-size:0.8rem; background:var(--dsm-badge-new-bg); color:var(--vp-c-brand-1); padding:1px 5px; border-radius:3px; }

.pg-scenarios { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
@media(max-width:640px){ .pg-scenarios{grid-template-columns:1fr;} }

.pg-scenario { border:1px solid var(--vp-c-divider); border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px; background:var(--vp-c-bg); }
.pg-scenario-header { display:flex; align-items:center; justify-content:space-between; }
.pg-scenario-title { font-weight:600; font-size:0.85rem; color:var(--vp-c-text-1); }
.pg-scenario-expected { font-size:0.75rem; color:var(--vp-c-text-3); font-family:monospace; }
.pg-code { font-size:0.72rem; background:var(--vp-c-code-bg); padding:8px 10px; border-radius:6px; margin:0; color:var(--vp-c-brand-1); font-family:monospace; line-height:1.7; overflow-x:auto; white-space:pre; }
.pg-scenario-desc { font-size:0.76rem; color:var(--vp-c-text-3); line-height:1.5; }
.pg-scenario-footer { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.pg-btn-run { padding:5px 14px; background:var(--vp-c-brand-1,#5a5a8f); color:#fff; border:none; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer; }
.pg-btn-run:disabled { opacity:.5; cursor:not-allowed; }

.pg-result { display:flex; align-items:center; gap:6px; font-size:0.8rem; padding:4px 10px; border-radius:6px; }
.pg-result.pass { background:var(--dsm-badge-new-bg); color:var(--dsm-badge-new-color); }
.pg-result.fail { background:var(--dsm-badge-dep-bg); color:var(--dsm-badge-dep-color); }
.pg-result-icon { font-weight:700; font-size:0.9rem; }
.pg-result-badge { font-size:0.72rem; opacity:.8; margin-left:4px; }

/* 이벤트 루프 다이어그램 */
.pg-diagram { border:1px solid var(--vp-c-divider); border-radius:8px; padding:12px 14px; background:var(--vp-c-bg); }
.pg-diagram-title { font-size:0.75rem; font-weight:600; color:var(--vp-c-text-3); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px; }
.pg-timeline { display:flex; flex-direction:column; gap:6px; }
.tl-row { display:flex; align-items:center; gap:8px; }
.tl-label { font-size:0.72rem; font-weight:600; font-family:monospace; min-width:72px; text-align:right; }
.tl-label.call-stack { color:#3b82f6; }
.tl-label.microtask  { color:#f59e0b; }
.tl-blocks { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.tl-block { font-size:0.7rem; padding:3px 8px; border-radius:4px; font-family:monospace; white-space:nowrap; }
.tl-block.change { background:rgba(59,130,246,0.12); color:#1d4ed8; border:1px solid rgba(59,130,246,0.25); }
.tl-block.flush  { background:rgba(245,158,11,0.12); color:#b45309; border:1px solid rgba(245,158,11,0.3); }
.tl-spacer { width:16px; }
.tl-spacer.wide { width:96px; }

.pg-footer-actions { display:flex; justify-content:flex-end; }
.pg-btn-reset { padding:4px 12px; border:1px solid var(--vp-c-divider); border-radius:6px; background:transparent; font-size:0.78rem; cursor:pointer; color:var(--vp-c-text-3); }
</style>
