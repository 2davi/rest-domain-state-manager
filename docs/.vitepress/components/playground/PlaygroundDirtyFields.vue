<script setup>
/**
 * PlaygroundDirtyFields
 *
 * TC-C-010: 최상위 키 변경 → dirtyFields 등록
 * TC-C-011: 중첩 키(address.city) 변경 → 최상위 키('address')만 등록
 *
 * 핵심 시연 포인트:
 * - address.city 를 수정해도 dirtyFields에는 'address.city'가 아니라 'address' 가 들어간다.
 * - 같은 필드를 여러 번 수정해도 Set이므로 dirtyFields 크기는 변하지 않는다.
 * - dirtyRatio = dirtyFields.size / totalFields 계산이 실시간으로 보인다.
 */
import { ref, reactive, onMounted, computed } from 'vue'

const ready   = ref(false)
const error   = ref(null)

let DomainState, MockApiHandler

const stateRef = ref(null)

const INITIAL_DATA = {
    userId:  'user_001',
    name:    'Davi',
    email:   'davi@example.com',
    role:    'admin',
    address: { city: 'Seoul', zip: '04524' },
}

// 화면에 보여줄 평탄화 필드 목록 (입력 UI용)
const fields = reactive([
    { key: 'name',         label: 'name',          path: ['name'],                  value: 'Davi',      nested: false },
    { key: 'email',        label: 'email',          path: ['email'],                 value: 'davi@example.com', nested: false },
    { key: 'role',         label: 'role',           path: ['role'],                  value: 'admin',     nested: false },
    { key: 'address.city', label: 'address.city',   path: ['address', 'city'],       value: 'Seoul',     nested: true },
    { key: 'address.zip',  label: 'address.zip',    path: ['address', 'zip'],        value: '04524',     nested: true },
])

const display = reactive({
    dirtyFields:  [],
    totalFields:  0,
    dirtyRatio:   0,
    changeLog:    [],
})

// 어느 dirtyField가 방금 새로 추가됐는지 하이라이트용
const lastAdded = ref(null)

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

function initState() {
    const api = new MockApiHandler(INITIAL_DATA, { latency: 300 })
    stateRef.value = DomainState.fromJSON(JSON.stringify(INITIAL_DATA), api)
    fields.forEach(f => {
        f.value = f.path.length === 2
            ? INITIAL_DATA[f.path[0]][f.path[1]]
            : INITIAL_DATA[f.path[0]]
    })
    lastAdded.value = null
    syncDisplay()
}

function syncDisplay() {
    if (!stateRef.value) return
    const prev = new Set(display.dirtyFields)
    const next  = [...stateRef.value._getDirtyFields()]

    // 방금 추가된 키 감지 (하이라이트)
    const newKey = next.find(k => !prev.has(k))
    if (newKey) {
        lastAdded.value = newKey
        setTimeout(() => { lastAdded.value = null }, 1500)
    }

    display.dirtyFields = next
    display.totalFields  = Object.keys(stateRef.value._getTarget()).length
    display.dirtyRatio   = display.totalFields > 0
        ? display.dirtyFields.length / display.totalFields
        : 0
    display.changeLog    = stateRef.value._getChangeLog()
}

function handleChange(field, newValue) {
    if (!stateRef.value) return
    field.value = newValue

    // path를 따라 Proxy에 값 설정
    if (field.path.length === 2) {
        stateRef.value.data[field.path[0]][field.path[1]] = newValue
    } else {
        stateRef.value.data[field.path[0]] = newValue
    }
    syncDisplay()
}

function handleReset() { initState() }

// dirtyRatio 색상
const ratioColor = computed(() => {
    if (display.dirtyRatio === 0) return '#9ca3af'
    if (display.dirtyRatio >= 0.7) return '#3b82f6'  // PUT
    return '#f59e0b'                                  // PATCH
})
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">dirtyFields 실시간 추적 시연</div>

        <div v-if="!ready && !error" class="playground-body pg-loading">초기화 중...</div>
        <div v-else-if="error" class="playground-body pg-error">⚠ {{ error }}</div>

        <div v-else class="playground-body pg-layout">

            <!-- 좌: 입력 패널 -->
            <div class="pg-panel">
                <div class="pg-panel-header">
                    필드 수정
                    <button class="pg-btn-reset" @click="handleReset">초기화</button>
                </div>

                <div class="pg-fields">
                    <div
                        v-for="f in fields" :key="f.key"
                        :class="['pg-field', display.dirtyFields.includes(f.path[0]) && 'dirty']"
                    >
                        <label class="pg-field-label">
                            <span :class="['label-text', f.nested && 'nested']">{{ f.label }}</span>
                            <!-- TC-C-011 핵심: 중첩 키가 변경되면 최상위 키가 등록됨을 화살표로 표시 -->
                            <span v-if="f.nested && display.dirtyFields.includes(f.path[0])"
                                  class="dirty-hint">
                                → <code>{{ f.path[0] }}</code> 등록됨
                            </span>
                            <span v-else-if="!f.nested && display.dirtyFields.includes(f.path[0])"
                                  class="dirty-hint">
                                → <code>{{ f.path[0] }}</code> 등록됨
                            </span>
                        </label>
                        <input
                            class="pg-field-input"
                            :value="f.value"
                            @input="e => handleChange(f, e.target.value)"
                        />
                    </div>
                </div>

                <!-- TC-C-011 설명 박스 -->
                <div class="pg-callout">
                    💡 <code>address.city</code> 또는 <code>address.zip</code> 을 수정하면,
                    <code>dirtyFields</code> 에는 <strong>최상위 키 <code>'address'</code></strong>만 등록됩니다.
                    JSON Pointer <code>/address/city</code> 의 두 번째 세그먼트를 추출하기 때문입니다.
                </div>
            </div>

            <!-- 우: 상태 패널 -->
            <div class="pg-panel">

                <!-- dirtyFields Set -->
                <div class="pg-state-section">
                    <div class="pg-state-label">
                        dirtyFields
                        <span class="pg-count">{{ display.dirtyFields.length }} / {{ display.totalFields }}</span>
                    </div>
                    <div class="pg-chips">
                        <span
                            v-for="k in display.dirtyFields" :key="k"
                            :class="['pg-chip', lastAdded === k && 'flash']"
                        >{{ k }}</span>
                        <span v-if="display.dirtyFields.length === 0" class="pg-empty">없음</span>
                    </div>
                </div>

                <!-- dirtyRatio + 분기 예측 -->
                <div class="pg-state-section">
                    <div class="pg-state-label">dirtyRatio</div>
                    <div class="pg-ratio-bar-wrap">
                        <div class="pg-ratio-bar">
                            <div
                                class="pg-ratio-fill"
                                :style="{ width: (display.dirtyRatio * 100).toFixed(0) + '%', background: ratioColor }"
                            ></div>
                            <div class="pg-threshold-line" title="DIRTY_THRESHOLD = 0.7"></div>
                        </div>
                        <span class="pg-ratio-text" :style="{ color: ratioColor }">
                            {{ (display.dirtyRatio * 100).toFixed(0) }}%
                        </span>
                    </div>
                    <div class="pg-ratio-label" :style="{ color: ratioColor }">
                        <span v-if="display.dirtyFields.length === 0">변경 없음 → PUT (의도적 재저장)</span>
                        <span v-else-if="display.dirtyRatio >= 0.7">≥ 70% → PUT (전체 교체가 효율적)</span>
                        <span v-else>&lt; 70% → PATCH (변경분만 전송)</span>
                    </div>
                </div>

                <!-- changeLog -->
                <div class="pg-state-section">
                    <div class="pg-state-label">changeLog <span class="pg-count">{{ display.changeLog.length }}건</span></div>
                    <div class="pg-changelog">
                        <div v-for="(e, i) in display.changeLog.slice(-6)" :key="i" class="pg-log-entry">
                            <span :class="['op', e.op]">{{ e.op }}</span>
                            <span class="path">{{ e.path }}</span>
                        </div>
                        <div v-if="display.changeLog.length === 0" class="pg-empty">없음</div>
                        <div v-if="display.changeLog.length > 6" class="pg-more">… 외 {{ display.changeLog.length - 6 }}건</div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.playground-wrapper { border:1px solid var(--dsm-playground-border,#ccc9e0); border-radius:12px; overflow:hidden; margin:2rem 0; background:var(--dsm-playground-bg,#faf9fd); }
.playground-header { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(90,90,143,0.08); border-bottom:1px solid var(--dsm-playground-border,#ccc9e0); font-size:0.82rem; font-weight:600; color:var(--vp-c-brand-1,#5a5a8f); }
.playground-header::before { content:'▶'; font-size:0.7rem; }
.playground-body { padding:1.5rem; }
.pg-loading,.pg-error { text-align:center; color:var(--vp-c-text-3); font-size:0.9rem; }
.pg-error { color:#ef4444; }
.pg-layout { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }
@media(max-width:640px){ .pg-layout{grid-template-columns:1fr;} }
.pg-panel { display:flex; flex-direction:column; gap:1rem; }
.pg-panel-header { display:flex; align-items:center; justify-content:space-between; font-size:0.8rem; font-weight:600; color:var(--vp-c-text-2); }
.pg-btn-reset { padding:3px 10px; border:1px solid var(--vp-c-divider); border-radius:6px; background:transparent; font-size:0.75rem; cursor:pointer; color:var(--vp-c-text-3); }

.pg-fields { display:flex; flex-direction:column; gap:8px; }
.pg-field { display:flex; flex-direction:column; gap:3px; padding:6px 8px; border-radius:6px; border:1px solid transparent; transition:all .2s; }
.pg-field.dirty { border-color:rgba(245,158,11,0.35); background:rgba(245,158,11,0.06); }
.pg-field-label { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.label-text { font-size:0.75rem; font-weight:500; color:var(--vp-c-text-3); font-family:monospace; }
.label-text.nested { color:var(--vp-c-brand-1,#5a5a8f); }
.dirty-hint { font-size:0.72rem; color:#b45309; }
.dirty-hint code { font-size:0.72rem; padding:0 3px; background:rgba(245,158,11,0.12); border-radius:3px; color:#b45309; }
.pg-field-input { padding:5px 9px; border:1px solid var(--vp-c-divider); border-radius:6px; background:var(--vp-c-bg); color:var(--vp-c-text-1); font-size:0.85rem; font-family:monospace; }
.pg-field-input:focus { outline:none; border-color:var(--vp-c-brand-1); }

.pg-callout { font-size:0.78rem; color:var(--vp-c-text-2); background:var(--dsm-highlight-bg,#e8e4f3); padding:8px 12px; border-radius:6px; line-height:1.6; }
.pg-callout code { font-size:0.75rem; background:rgba(90,90,143,0.12); color:var(--vp-c-brand-1); padding:0 3px; border-radius:3px; }

.pg-state-section { display:flex; flex-direction:column; gap:6px; }
.pg-state-label { font-size:0.75rem; font-weight:600; color:var(--vp-c-text-3); text-transform:uppercase; letter-spacing:.05em; display:flex; align-items:center; gap:6px; }
.pg-count { font-weight:400; text-transform:none; letter-spacing:0; color:var(--vp-c-text-3); font-size:0.72rem; }
.pg-chips { display:flex; flex-wrap:wrap; gap:5px; min-height:26px; }
.pg-chip { padding:3px 10px; background:rgba(245,158,11,0.12); color:#b45309; border-radius:10px; font-size:0.78rem; font-family:monospace; font-weight:500; transition:all .2s; }
.pg-chip.flash { background:rgba(245,158,11,0.4); transform:scale(1.1); }
.pg-empty { font-size:0.78rem; color:var(--vp-c-text-3); font-style:italic; }

.pg-ratio-bar-wrap { display:flex; align-items:center; gap:10px; }
.pg-ratio-bar { flex:1; height:8px; background:var(--vp-c-default-soft); border-radius:4px; position:relative; overflow:hidden; }
.pg-ratio-fill { height:100%; border-radius:4px; transition:width .3s, background .3s; }
.pg-threshold-line { position:absolute; top:0; bottom:0; left:70%; width:2px; background:rgba(90,90,143,0.4); }
.pg-ratio-text { font-family:monospace; font-weight:700; font-size:0.9rem; min-width:36px; text-align:right; }
.pg-ratio-label { font-size:0.78rem; font-family:monospace; }

.pg-changelog { display:flex; flex-direction:column; gap:4px; max-height:140px; overflow-y:auto; }
.pg-log-entry { display:flex; gap:8px; font-size:0.78rem; font-family:monospace; }
.op { font-weight:700; min-width:55px; }
.op.replace { color:#3b82f6; }
.op.add     { color:#10b981; }
.op.remove  { color:#ef4444; }
.path { color:var(--vp-c-text-2); }
.pg-more { font-size:0.72rem; color:var(--vp-c-text-3); }
</style>
