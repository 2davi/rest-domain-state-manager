<script setup>
/**
 * PlaygroundDirtyFields — dirtyFields Set 동작 원리 시연
 *
 * 학습 목표:
 *   (1) 중첩 키를 변경해도 dirtyFields에는 최상위 키만 등록된다.
 *       address.city 수정 → dirtyFields: Set { 'address' }
 *   (2) 동일 키를 여러 번 수정해도 Set이므로 크기가 늘지 않는다.
 *   (3) dirtyRatio = dirtyFields.size / totalFields
 *
 * TC: TC-C-010, TC-C-011
 */
import { shallowRef, ref, reactive, computed, onMounted, onUnmounted } from 'vue'

const ready = ref(false)
let DomainState, MockApiHandler, unsub

const stateRef = shallowRef(null)
const lastAdded = ref(null)  // 방금 새로 등록된 key (하이라이트용)

const INITIAL = {
    userId:  'user_001',
    name:    'Davi',
    email:   'davi@example.com',
    role:    'admin',
    address: { city: 'Seoul', zip: '04524' },
}

// 편집 필드 (flat)
const fields = reactive([
    { key:'name',         label:'name',         topKey:'name',    path:['name'],          val:'Davi',             nested:false },
    { key:'email',        label:'email',         topKey:'email',   path:['email'],         val:'davi@example.com', nested:false },
    { key:'role',         label:'role',          topKey:'role',    path:['role'],          val:'admin',            nested:false },
    { key:'address.city', label:'address.city',  topKey:'address', path:['address','city'],val:'Seoul',            nested:true  },
    { key:'address.zip',  label:'address.zip',   topKey:'address', path:['address','zip'], val:'04524',            nested:true  },
])

const display = reactive({ dirtyFields:[], totalFields:5, dirtyRatio:0 })

onMounted(async () => {
    const lib  = await import('@2davi/rest-domain-state-manager')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    MockApiHandler = mock.MockApiHandler
    initState()
    ready.value = true
})

onUnmounted(() => { if (unsub) unsub() })

function initState() {
    if (unsub) unsub()
    stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL), new MockApiHandler(INITIAL, { latency:0 }))
    fields.forEach((f, i) => {
        const defaults = ['Davi','davi@example.com','admin','Seoul','04524']
        f.val = defaults[i]
    })
    lastAdded.value = null
    unsub = stateRef.value.subscribe(syncDisplay)
    syncDisplay()
}

function syncDisplay() {
    if (!stateRef.value) return
    const prev  = new Set(display.dirtyFields)
    const next  = [...stateRef.value._getDirtyFields()]
    const added = next.find(k => !prev.has(k))
    if (added) {
        lastAdded.value = added
        setTimeout(() => { lastAdded.value = null }, 1200)
    }
    display.dirtyFields  = next
    display.totalFields  = Object.keys(stateRef.value._getTarget()).length
    display.dirtyRatio   = display.totalFields > 0 ? display.dirtyFields.length / display.totalFields : 0
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

const ratioColor = computed(() => {
    if (display.dirtyRatio === 0)      return '#6b7280'
    if (display.dirtyRatio >= 0.7)     return '#3b82f6'
    return '#f59e0b'
})

const ratioMethod = computed(() => {
    if (display.dirtyFields.length === 0) return { method:'PUT',   reason:'변경 없음 → PUT' }
    if (display.dirtyRatio >= 0.7)        return { method:'PUT',   reason:`${(display.dirtyRatio*100).toFixed(0)}% ≥ 70% → PUT` }
    return                                       { method:'PATCH', reason:`${(display.dirtyRatio*100).toFixed(0)}% < 70% → PATCH` }
})
</script>

<template>
<div class="pg-wrap">
    <div class="pg-header">dirtyFields — Set 동작 원리 &amp; PUT/PATCH 임계값</div>
    <div v-if="!ready" class="pg-loading">초기화 중…</div>
    <div v-else class="pg-body">

        <div class="pg-guide">
            필드를 수정하고 <strong>dirtyFields Set</strong>이 어떻게 갱신되는지 관찰하세요.<br>
            특히 <strong>address.city / address.zip</strong>을 수정하면 'address.city'가 아닌
            <strong>'address'</strong>만 등록됩니다.
        </div>

        <div class="pg-2col">
            <!-- 좌: 편집 패널 -->
            <div class="pg-col">
                <div class="pg-row-between">
                    <span class="pg-label">도메인 데이터 편집</span>
                    <button class="pg-btn-sm" @click="initState">초기화</button>
                </div>
                <div class="pg-fields">
                    <div v-for="f in fields" :key="f.key" class="pg-field">
                        <label :class="['pg-field-label', display.dirtyFields.includes(f.topKey) && 'dirty']">
                            {{ f.label }}
                            <span v-if="f.nested" class="nested-badge">중첩</span>
                            <span v-if="display.dirtyFields.includes(f.topKey)" class="dirty-dot">●</span>
                        </label>
                        <input
                            class="pg-input"
                            :value="f.val"
                            @input="e => onInput(f, e.target.value)"
                        />
                        <div v-if="f.nested && display.dirtyFields.includes(f.topKey)" class="pg-nested-hint">
                            {{ f.label }} 수정 → dirtyFields에 <code>'{{ f.topKey }}'</code> 등록
                        </div>
                    </div>
                </div>
            </div>

            <!-- 우: 상태 패널 -->
            <div class="pg-col">
                <!-- dirtyFields Set -->
                <div class="pg-label">dirtyFields (Set)</div>
                <div class="pg-set-box">
                    <div class="pg-set-label">Set &#123;</div>
                    <div class="pg-set-items">
                        <span
                            v-for="f in display.dirtyFields"
                            :key="f"
                            :class="['pg-chip', lastAdded === f && 'new']">
                            '{{ f }}'
                        </span>
                        <span v-if="!display.dirtyFields.length" class="pg-empty">비어있음</span>
                    </div>
                    <div class="pg-set-label">&#125;</div>
                </div>

                <!-- ratio 게이지 -->
                <div class="pg-label" style="margin-top:4px">
                    dirtyRatio = {{ display.dirtyFields.length }} / {{ display.totalFields }}
                    = {{ (display.dirtyRatio * 100).toFixed(0) }}%
                </div>
                <div class="pg-gauge-track">
                    <div
                        class="pg-gauge-fill"
                        :style="{width: (display.dirtyRatio*100)+'%', background: ratioColor}"
                    />
                    <div class="pg-gauge-threshold" />
                </div>
                <div class="pg-gauge-labels">
                    <span>0%</span>
                    <span class="threshold-label">70% (threshold)</span>
                    <span>100%</span>
                </div>

                <!-- HTTP 메서드 예측 -->
                <div class="pg-method-row">
                    <div class="pg-predict-badge" :style="{background:ratioColor+'1a', color:ratioColor, borderColor:ratioColor}">
                        {{ ratioMethod.method }}
                    </div>
                    <div class="pg-predict-reason">{{ ratioMethod.reason }}</div>
                </div>

                <div class="pg-hint">
                    💡 <code>address.city</code>를 수정해도 dirtyFields에는<br>
                    &nbsp;&nbsp;&nbsp;<code>'address.city'</code>가 아닌 <strong><code>'address'</code></strong>가 등록됩니다.<br>
                    💡 동일 키를 여러 번 수정해도 <strong>Set</strong>이므로 크기는 증가하지 않습니다.
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
.pg-guide{font-size:.78rem;color:var(--vp-c-text-2);background:var(--vp-c-default-soft);padding:7px 12px;border-radius:7px;line-height:1.7;}
.pg-2col{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
@media(max-width:640px){.pg-2col{grid-template-columns:1fr;}}
.pg-col{display:flex;flex-direction:column;gap:.65rem;}
.pg-row-between{display:flex;align-items:center;justify-content:space-between;}
.pg-label{font-size:.7rem;font-weight:700;color:var(--vp-c-text-3);text-transform:uppercase;letter-spacing:.06em;}
.pg-fields{display:flex;flex-direction:column;gap:7px;}
.pg-field{display:flex;flex-direction:column;gap:2px;}
.pg-field-label{font-size:.73rem;font-weight:500;color:var(--vp-c-text-3);display:flex;align-items:center;gap:5px;transition:color .2s;}
.pg-field-label.dirty{color:#d97706;}
.nested-badge{font-size:.62rem;background:rgba(99,102,241,.1);color:#6366f1;padding:1px 5px;border-radius:4px;font-weight:600;}
.dirty-dot{font-size:.55rem;color:#f59e0b;}
.pg-input{padding:5px 9px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font-size:.82rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-input:focus{outline:none;border-color:var(--vp-c-brand-1);}
.pg-nested-hint{font-size:.68rem;color:#d97706;padding-left:2px;}
.pg-btn-sm{padding:3px 9px;border:1px solid var(--vp-c-divider);border-radius:5px;background:transparent;font-size:.72rem;cursor:pointer;color:var(--vp-c-text-3);}
.pg-set-box{border:1px solid var(--vp-c-divider);border-radius:7px;padding:8px 12px;background:var(--vp-c-code-bg);display:flex;flex-direction:column;gap:4px;}
.pg-set-label{font-family:var(--vp-font-family-mono,monospace);font-size:.78rem;color:var(--vp-c-text-3);}
.pg-set-items{display:flex;flex-wrap:wrap;gap:5px;min-height:24px;padding:2px 0;}
.pg-chip{padding:2px 9px;background:rgba(245,158,11,.12);color:#b45309;border-radius:10px;font-size:.76rem;font-family:var(--vp-font-family-mono,monospace);font-weight:500;transition:background .3s;}
.pg-chip.new{background:rgba(245,158,11,.35);animation:pop .4s ease;}
@keyframes pop{0%{transform:scale(1.25)}100%{transform:scale(1)}}
.pg-empty{font-size:.75rem;color:var(--vp-c-text-3);font-style:italic;}
.pg-gauge-track{position:relative;height:8px;background:var(--vp-c-divider);border-radius:4px;overflow:hidden;}
.pg-gauge-fill{height:100%;border-radius:4px;transition:width .3s, background .3s;}
.pg-gauge-threshold{position:absolute;top:0;left:70%;width:2px;height:100%;background:rgba(239,68,68,.6);}
.pg-gauge-labels{display:flex;justify-content:space-between;font-size:.65rem;color:var(--vp-c-text-3);margin-top:2px;}
.threshold-label{color:#ef4444;}
.pg-method-row{display:flex;align-items:center;gap:10px;}
.pg-predict-badge{display:inline-block;padding:4px 14px;border-radius:20px;border:1.5px solid;font-weight:700;font-size:.95rem;font-family:var(--vp-font-family-mono,monospace);}
.pg-predict-reason{font-size:.76rem;color:var(--vp-c-text-2);font-family:var(--vp-font-family-mono,monospace);}
.pg-hint{font-size:.74rem;color:var(--vp-c-text-3);background:var(--vp-c-default-soft);padding:8px 10px;border-radius:6px;line-height:1.7;}
code{font-family:var(--vp-font-family-mono,monospace);background:var(--vp-c-code-bg);padding:1px 5px;border-radius:3px;font-size:.75rem;}
</style>
