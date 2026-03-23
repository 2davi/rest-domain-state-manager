<script setup>
/**
 * PlaygroundRenderer
 * TC-DR-001: type:'select' → HTMLSelectElement 생성, option 수 일치
 */
import { ref, onMounted, nextTick } from 'vue'

const ready    = ref(false)
const renderType = ref('select')
const containerRef = ref(null)
const resultInfo   = ref(null)

let DomainState, DomainRenderer, MockApiHandler

const ROLE_DATA = [
    { roleId: 'R01', roleName: '시스템 관리자' },
    { roleId: 'R02', roleName: '일반 사용자' },
    { roleId: 'R03', roleName: '게스트' },
    { roleId: 'R04', roleName: '개발자' },
]

onMounted(async () => {
    const lib  = await import('../../../../index.js')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    DomainRenderer = lib.DomainRenderer
    MockApiHandler = mock.MockApiHandler
    if (!DomainState.prototype.renderTo) DomainState.use(DomainRenderer)
    ready.value = true
    await nextTick()
    render()
})

async function render() {
    if (!containerRef.value || !DomainState) return
    containerRef.value.innerHTML = ''

    const api     = new MockApiHandler(ROLE_DATA, { latency: 0 })
    const roles   = DomainState.fromJSON(JSON.stringify(ROLE_DATA), api)
    const targetId = 'pg-render-target'
    const el       = document.createElement('div')
    el.id = targetId
    containerRef.value.appendChild(el)

    const result = roles.renderTo(`#${targetId}`, {
        type:           renderType.value,
        valueField:     'roleId',
        labelField:     'roleName',
        placeholder:    '역할을 선택하세요',
        class:          'pg-render-item',
        containerClass: 'pg-radio-wrap',
        labelClass:     'pg-radio-label',
    })

    if (renderType.value === 'select') {
        resultInfo.value = `HTMLSelectElement 생성 — ${result.options.length}개 옵션`
    } else if (Array.isArray(result)) {
        resultInfo.value = `${result[0]?.type || '?'} 요소 ${result.length}개 생성`
    } else {
        resultInfo.value = `생성 완료`
    }
}

async function changeType(t) {
    renderType.value = t
    await nextTick()
    render()
}
</script>

<template>
    <div class="playground-wrapper">
        <div class="playground-header">DomainRenderer 렌더링 시연</div>
        <div v-if="!ready" class="playground-body pg-loading">초기화 중...</div>
        <div v-else class="playground-body">
            <div class="pg-type-bar">
                <button v-for="t in ['select','radio','checkbox','button']" :key="t"
                    :class="['type-btn', renderType === t && 'active']"
                    @click="changeType(t)">
                    {{ t }}
                </button>
            </div>

            <div class="pg-render-area">
                <div class="pg-render-label">렌더링 결과</div>
                <div ref="containerRef" class="pg-render-container"></div>
                <div v-if="resultInfo" class="pg-result-info">{{ resultInfo }}</div>
            </div>

            <div class="pg-code-hint">
                <pre class="pg-pre">roles.renderTo('#target', {
  type:       '{{ renderType }}',
  valueField: 'roleId',
  labelField: 'roleName',{{ renderType === 'select' ? "\n  placeholder: '역할을 선택하세요'," : '' }}
})</pre>
            </div>
        </div>
    </div>
</template>

<style scoped>
.playground-wrapper { border:1px solid var(--dsm-playground-border,#cbd5e1); border-radius:12px; overflow:hidden; margin:2rem 0; background:var(--dsm-playground-bg,#f8fafc); }
.playground-header { display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(90,90,143,0.08); border-bottom:1px solid var(--dsm-playground-border); font-size:.82rem; font-weight:600; color:var(--vp-c-brand-1,#5a5a8f); }
.playground-header::before { content:'▶'; font-size:.7rem; }
.playground-body { padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
.pg-loading { text-align:center; color:var(--vp-c-text-3); }
.pg-type-bar { display:flex; gap:6px; }
.type-btn { padding:4px 12px; border:1px solid var(--vp-c-divider); border-radius:6px; background:transparent; font-size:.78rem; cursor:pointer; color:var(--vp-c-text-3); font-family:monospace; transition:all .15s; }
.type-btn.active { background:var(--vp-c-brand-1,#5a5a8f); border-color:var(--vp-c-brand-1); color:#fff; }
.pg-render-area { display:flex; flex-direction:column; gap:6px; }
.pg-render-label { font-size:.75rem; font-weight:600; color:var(--vp-c-text-3); text-transform:uppercase; letter-spacing:.05em; }
.pg-render-container {
    padding:1rem;
    border:1px solid var(--vp-c-divider);
    border-radius:8px;
    background:var(--vp-c-bg);
    min-height:60px;
}
.pg-result-info { font-size:.75rem; color:var(--vp-c-text-3); font-style:italic; }
.pg-pre { font-size:.73rem; background:var(--vp-c-code-bg); padding:8px 12px; border-radius:6px; overflow-x:auto; margin:0; color:var(--vp-c-brand-1,#5a5a8f); white-space:pre; }
</style>

<style>
/* Playground 내부에서 생성되는 요소 스타일 — scoped 아님 */
.pg-render-item {
    padding: 6px 12px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background: var(--vp-c-bg);
    font-size: .85rem;
    cursor: pointer;
    width: 100%;
    max-width: 280px;
}
.pg-radio-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}
.pg-radio-label {
    font-size: .85rem;
    color: var(--vp-c-text-1);
    cursor: pointer;
}
</style>
