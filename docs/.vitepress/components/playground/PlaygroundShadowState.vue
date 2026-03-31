<script setup>
/**
 * PlaygroundShadowState — Shadow State & Structural Sharing 시연
 *
 * 학습 목표:
 *   subscribe() + getSnapshot()의 동작 원리를 이해한다.
 *   필드를 변경하면 새 snapshot 참조가 생성되고,
 *   변경되지 않은 중첩 객체는 기존 참조가 재사용됨(Structural Sharing)을 확인한다.
 */
import { shallowRef, ref, reactive, onMounted, onUnmounted } from 'vue'

const ready   = ref(false)
const err     = ref(null)
let DomainState, MockApiHandler, unsub

const stateRef    = shallowRef(null)
const snapHistory = ref([])   // { snap, changedKeys, ts }
const updateCount = ref(0)
const loading     = ref(false)

const INITIAL = {
    name:    'Davi',
    email:   'davi@example.com',
    role:    'admin',
    address: { city: 'Seoul', zip: '04524' },
}

// 편집 필드 목록 (flat)
const fields = reactive([
    { key:'name',         label:'name',         path:['name'],                 val:'Davi'            },
    { key:'email',        label:'email',         path:['email'],                val:'davi@example.com'},
    { key:'role',         label:'role',          path:['role'],                 val:'admin'           },
    { key:'address.city', label:'address.city',  path:['address','city'],       val:'Seoul'           },
    { key:'address.zip',  label:'address.zip',   path:['address','zip'],        val:'04524'           },
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
        err.value = e.message
    }
})

onUnmounted(() => { if (unsub) unsub() })

function initState() {
    if (unsub) unsub()
    stateRef.value = DomainState.fromJSON(
        JSON.stringify(INITIAL),
        new MockApiHandler(INITIAL, { latency: 0 })
    )
    fields.forEach(f => {
        f.val = f.path.length === 2
            ? INITIAL[f.path[0]][f.path[1]]
            : INITIAL[f.path[0]]
    })
    snapHistory.value = []
    updateCount.value = 0

    // 초기 스냅샷 기록
    const snap0 = stateRef.value.getSnapshot()
    snapHistory.value.push({ snap: snap0, changedKeys: [], ts: Date.now(), idx: 0 })

    // subscribe 등록
    unsub = stateRef.value.subscribe(() => {
        const prev = snapHistory.value.at(-1)
        const next = stateRef.value.getSnapshot()
        updateCount.value++

        // 어떤 최상위 키가 새 참조인지 계산
        const changedKeys = Object.keys(next).filter(k => next[k] !== prev?.snap?.[k])

        snapHistory.value.push({
            snap:        next,
            changedKeys,
            ts:          Date.now(),
            idx:         snapHistory.value.length,
        })
        if (snapHistory.value.length > 6) snapHistory.value.shift()
    })
}

function onInput(f, val) {
    f.val = val
    if (!stateRef.value) return
    if (f.path.length === 2) {
        stateRef.value.data[f.path[0]][f.path[1]] = val
    } else {
        stateRef.value.data[f.path[0]] = val
    }
}

function doReset() {
    fields.forEach((f, i) => {
        const defaults = ['Davi','davi@example.com','admin','Seoul','04524']
        f.val = defaults[i]
    })
    initState()
}

function shortRef(obj) {
    // 참조 식별용 — JSON + 길이로 간략 표현
    try {
        const s = JSON.stringify(obj)
        return s.length > 28 ? s.slice(0, 28) + '…' : s
    } catch { return '?' }
}
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">Shadow State — subscribe() · getSnapshot() · Structural Sharing</div>
    <div v-if="!ready && !err" class="pg-loading">초기화 중…</div>
    <div v-else-if="err" class="pg-loading" style="color:#ef4444">⚠ {{ err }}</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            ① 필드를 수정하세요 &nbsp;→&nbsp;
            ② snapshot 참조 변경 횟수 확인 &nbsp;→&nbsp;
            ③ 변경된 키 vs 재사용 키 구분 확인 (Structural Sharing)
        </div>

        <div class="pg-2col">
            <!-- 좌: 편집 패널 -->
            <div class="pg-col">
                <div class="pg-label">도메인 데이터 편집</div>
                <div class="pg-fields">
                    <div v-for="f in fields" :key="f.key" class="pg-field">
                        <label class="pg-field-label">{{ f.label }}</label>
                        <input
                            class="pg-input"
                            :value="f.val"
                            @input="e => onInput(f, e.target.value)"
                        />
                    </div>
                </div>

                <button class="pg-btn pg-btn-ghost" @click="doReset">초기화</button>

                <!-- 구독 카운터 -->
                <div class="pg-counter-box">
                    <div class="pg-counter-num">{{ updateCount }}</div>
                    <div class="pg-counter-label">subscribe() 콜백 호출 횟수</div>
                    <div class="pg-counter-hint">필드를 변경하면 microtask 완료 후 1회씩 증가합니다</div>
                </div>
            </div>

            <!-- 우: snapshot 히스토리 -->
            <div class="pg-col">
                <div class="pg-label">Snapshot 히스토리 (최근 {{ snapHistory.length }}개)</div>
                <div class="pg-snap-list">
                    <div
                        v-for="(item, i) in [...snapHistory].reverse()"
                        :key="item.idx"
                        :class="['pg-snap-item', i === 0 && 'latest']">

                        <div class="pg-snap-header">
                            <span class="snap-idx">#{{ item.idx }}</span>
                            <span v-if="i === 0" class="snap-badge-latest">현재</span>
                            <span class="snap-time">{{ new Date(item.ts).toLocaleTimeString() }}</span>
                        </div>

                        <!-- 키별 참조 상태 -->
                        <div class="pg-snap-keys">
                            <div
                                v-for="key in Object.keys(item.snap)"
                                :key="key"
                                :class="['snap-key', item.changedKeys.includes(key) ? 'new-ref' : 'same-ref']">
                                <span class="snap-key-name">{{ key }}</span>
                                <span class="snap-key-val">{{ shortRef(item.snap[key]) }}</span>
                                <span class="snap-key-badge">
                                    {{ item.changedKeys.includes(key) ? '🆕 새 참조' : '♻ 재사용' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div v-if="snapHistory.length <= 1" class="pg-empty">
                        필드를 수정하면 snapshot 히스토리가 쌓입니다
                    </div>
                </div>

                <div class="pg-hint">
                    🆕 <strong>새 참조</strong>: 변경된 경로의 노드 → 새 객체 생성<br>
                    ♻ <strong>재사용</strong>: 변경되지 않은 노드 → 기존 메모리 참조 공유 (Structural Sharing)
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
.pg-fields{display:flex;flex-direction:column;gap:5px;}
.pg-field{display:flex;flex-direction:column;gap:2px;}
.pg-field-label{font-size:.72rem;font-weight:500;color:var(--vp-c-text-3);}
.pg-input{padding:5px 9px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font-size:.82rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-input:focus{outline:none;border-color:var(--vp-c-brand-1);}
.pg-btn{padding:6px 14px;border:none;border-radius:7px;font-size:.78rem;font-weight:600;cursor:pointer;}
.pg-btn-ghost{background:var(--vp-c-default-soft);color:var(--vp-c-text-2);}
.pg-counter-box{border:1px solid var(--vp-c-divider);border-radius:9px;padding:14px;text-align:center;display:flex;flex-direction:column;gap:4px;}
.pg-counter-num{font-size:2.4rem;font-weight:800;color:var(--vp-c-brand-1);font-family:var(--vp-font-family-mono,monospace);line-height:1;}
.pg-counter-label{font-size:.78rem;font-weight:600;color:var(--vp-c-text-2);}
.pg-counter-hint{font-size:.71rem;color:var(--vp-c-text-3);}
.pg-snap-list{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;}
.pg-snap-item{border:1px solid var(--vp-c-divider);border-radius:7px;padding:8px 10px;display:flex;flex-direction:column;gap:5px;transition:border-color .2s;}
.pg-snap-item.latest{border-color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft);}
.pg-snap-header{display:flex;align-items:center;gap:6px;}
.snap-idx{font-family:var(--vp-font-family-mono,monospace);font-size:.74rem;font-weight:700;color:var(--vp-c-text-3);}
.snap-badge-latest{font-size:.66rem;background:var(--vp-c-brand-1);color:#fff;padding:1px 6px;border-radius:8px;font-weight:700;}
.snap-time{font-size:.68rem;color:var(--vp-c-text-3);font-family:var(--vp-font-family-mono,monospace);margin-left:auto;}
.pg-snap-keys{display:flex;flex-direction:column;gap:2px;}
.snap-key{display:flex;align-items:center;gap:6px;font-size:.72rem;padding:2px 4px;border-radius:4px;}
.snap-key.new-ref{background:rgba(16,185,129,.07);}
.snap-key.same-ref{opacity:.7;}
.snap-key-name{font-family:var(--vp-font-family-mono,monospace);font-weight:600;color:var(--vp-c-text-2);min-width:70px;}
.snap-key-val{font-family:var(--vp-font-family-mono,monospace);color:var(--vp-c-text-3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.snap-key-badge{font-size:.65rem;flex-shrink:0;color:var(--vp-c-text-3);}
.snap-key.new-ref .snap-key-badge{color:#059669;font-weight:600;}
.pg-hint{font-size:.74rem;color:var(--vp-c-text-3);background:var(--vp-c-default-soft);padding:8px 10px;border-radius:6px;line-height:1.7;}
.pg-empty{font-size:.75rem;color:var(--vp-c-text-3);font-style:italic;padding:.5rem 0;}
</style>
