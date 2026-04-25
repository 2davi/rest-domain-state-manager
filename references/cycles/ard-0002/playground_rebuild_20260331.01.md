# Playground 전면 재구축 계획서 (2026-03-31)

## 배경 및 목적

ard-0002 사이클을 통해 v1.0.0 ~ v1.5.0 마일스톤이 완료되었다.
신규 구현된 기능들(CSRF 인터셉터, Shadow State, 보상 트랜잭션, Web Worker 직렬화)에 대한
인터랙티브 시연이 전혀 없으며, 기존 컴포넌트 다수가 구현 변경 이후 방치된 상태다.
v1.0.0 공식 릴리즈 전 WebDoc 문서와 함께 Playground를 전면 재구축한다.

---

## 1. 현황 진단

### 1.1. 기능 측면 문제

| 컴포넌트 | 문제 |
|---|---|
| `PlaygroundFormBinder` | `fromForm()`을 `fromJSON + isNew:true`로 가짜 시뮬레이션. 실제 기능 미시연. |
| `PlaygroundBatching` | `_broadcast` 내부 메서드 직접 스파이. 내부 구조 변경 시 즉시 파괴. |
| `PlaygroundRenderer` | DomainRenderer 플러그인 설치 여부 불확실, 타입별 렌더링 결과 검증 없음. |
| `PlaygroundHttpMethod` | `api._fetch`를 런타임에 monkey-patch. `MockApiHandler.getLastCall()`로 대체 가능. |
| 전체 | Shadow State `subscribe()`/`getSnapshot()`을 활용하는 컴포넌트 없음. |
| 전체 | v1.1.0 `init()` CSRF, v1.3.0 Shadow State, v1.5.0 보상 트랜잭션을 시연하는 Playground 없음. |

### 1.2. UX 측면 문제

- **진입 장벽 없음**: 어떤 순서로 조작해야 하는지 안내가 전무하다. 사용자가 무엇을 해야 할지 모른다.
- **학습 목표 불명확**: 컴포넌트마다 "이 Playground에서 무엇을 확인해야 하는가"를 명시하지 않는다.
- **정보 과부하**: 내부 상태 패널에 changeLog, dirtyFields, ratio가 한 번에 쏟아진다. 무엇이 핵심인지 강조가 없다.
- **Playground-per-page 없음**: `quick-start.md`, `api-handler.md`, `pipeline.md`, `react-adapter.md`, `state-lifecycle.md`에 Playground가 없다.

---

## 2. 문서-Playground 배치 계획

### 2.1. 페이지별 Playground 배치 (최종)

| 문서 파일 | 배치할 Playground | 비고 |
|---|---|---|
| `quick-start.md` | `PlaygroundQuickStart` (NEW) | GET → 편집 → save() 전체 흐름을 한 컴포넌트에서 |
| `save-strategy.md` | `PlaygroundDirtyFields` (REBUILD) | dirtyFields Set 동작 단독 시연 |
| `save-strategy.md` | `PlaygroundHttpMethod` (REBUILD) | POST/PUT/PATCH 분기 + RFC 6902 payload |
| `save-strategy.md` | `PlaygroundRollback` (REBUILD) | 자동 롤백 + `restore()` 수동 보상 시연 통합 |
| `api-handler.md` | `PlaygroundCsrf` (NEW) | `init()` 3-상태 설계 시연 |
| `state-lifecycle.md` | `PlaygroundBatching` (REBUILD) | microtask 배칭 — `getSnapshot()` 기반으로 전면 재설계 |
| `state-lifecycle.md` | `PlaygroundShadowState` (NEW) | `subscribe()`/`getSnapshot()` + Structural Sharing 시각화 |
| `pipeline.md` | `PlaygroundPipeline` (NEW) | `failurePolicy` + 보상 트랜잭션 + `dsm:pipeline-rollback` |
| `react-adapter.md` | `PlaygroundShadowState` (재사용) | 동일 컴포넌트 재사용. Vanilla JS subscribe 관점으로 설명 |
| `form-binder.md` | `PlaygroundFormBinder` (REBUILD) | jsdom 의존성 없이 순수 Proxy 동작만 시연 |
| `domain-renderer.md` | `PlaygroundRenderer` (minor fix) | import 경로 수정, 오류 처리 추가 |

### 2.2. 제거 대상

`PlaygroundDirtyFields`는 기존에 `save-strategy.md`에서 `PlaygroundHttpMethod` 직전에 배치했으나,
HttpMethod 컴포넌트 자체에 dirtyFields 패널이 이미 있어 중복이다.
재구축 후 `PlaygroundDirtyFields`는 **독립 컴포넌트로 단순화**하여 Set 동작 원리만 시연한다.

---

## 3. 구현 원칙 (신규/재구축 공통)

### 3.1. Import 표준화

모든 컴포넌트는 `@2davi/rest-domain-state-manager` 패키지명으로 import한다.
`docs/.vitepress/config.mts`에 vite alias를 추가해야 한다. (§4 참고)

```javascript
// 기존 (fragile, 상대경로)
const lib = await import('../../../../index.js')

// 신규 (권장)
const lib = await import('@2davi/rest-domain-state-manager')
```

### 3.2. 상태 동기화 패턴 전환

`subscribe()` + `getSnapshot()`으로 라이브러리 공개 API를 활용한다.
내부 메서드 직접 호출은 `_getChangeLog()`, `_getDirtyFields()` 최소한으로만 유지한다.
monkey-patching은 전면 금지. `MockApiHandler.getLastCall()`로 대체한다.

```javascript
// 신규 패턴
let unsub = null

function initState() {
    if (unsub) unsub()
    stateRef.value = DomainState.fromJSON(...)
    unsub = stateRef.value.subscribe(() => syncDisplay())
    syncDisplay()
}

onUnmounted(() => { if (unsub) unsub() })
```

### 3.3. UX 원칙

- **한 컴포넌트 = 한 가지 학습 목표**: 컴포넌트 제목 아래 1줄 학습 목표 명시
- **Step 가이드**: "① 필드 수정 → ② save() 클릭 → ③ 결과 확인" 형태의 안내 텍스트 포함
- **원인-결과 레이아웃**: 좌측 조작 패널, 우측 상태/결과 패널. 일관되게 유지
- **강조 포인트**: 핵심 변화(새 참조, 새 메서드, 롤백)는 색상/배지로 강조
- **공통 CSS 변수**: `--vp-c-brand-1`, `--vp-c-divider`, `--vp-c-bg` 등 VitePress 테마 변수 전용 사용

---

## 4. 설정 파일 변경 사항

### 4.1. docs/.vitepress/config.mts — vite alias 추가

```typescript
import { fileURLToPath } from 'url'
import { defineConfig }   from 'vitepress'

export default defineConfig({
    // ... 기존 설정 ...
    vite: {
        resolve: {
            alias: {
                '@2davi/rest-domain-state-manager': fileURLToPath(
                    new URL('../../src/index.js', import.meta.url)
                ),
            },
        },
    },
})
```

### 4.2. docs/.vitepress/theme/index.js — 신규 컴포넌트 전역 등록

```javascript
import PlaygroundQuickStart  from '../components/playground/PlaygroundQuickStart.vue'
import PlaygroundCsrf        from '../components/playground/PlaygroundCsrf.vue'
import PlaygroundShadowState from '../components/playground/PlaygroundShadowState.vue'
import PlaygroundPipeline    from '../components/playground/PlaygroundPipeline.vue'

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        // 기존 등록 컴포넌트 유지
        app.component('PlaygroundHttpMethod',  PlaygroundHttpMethod)
        app.component('PlaygroundRollback',    PlaygroundRollback)
        app.component('PlaygroundDirtyFields', PlaygroundDirtyFields)
        app.component('PlaygroundBatching',    PlaygroundBatching)
        app.component('PlaygroundFormBinder',  PlaygroundFormBinder)
        app.component('PlaygroundRenderer',    PlaygroundRenderer)
        // 신규 등록
        app.component('PlaygroundQuickStart',  PlaygroundQuickStart)
        app.component('PlaygroundCsrf',        PlaygroundCsrf)
        app.component('PlaygroundShadowState', PlaygroundShadowState)
        app.component('PlaygroundPipeline',    PlaygroundPipeline)
    }
}
```

---

## 5. 컴포넌트별 실천 과제

### 5.1. PlaygroundHttpMethod (REBUILD)

**학습 목표**: `save()` 호출 시 POST / PUT / PATCH 중 무엇이 선택되는지, 그리고 왜 선택되는지 이해한다.

1. monkey-patching 제거 → `api.getLastCall()`로 메서드/payload 캡처
2. `subscribe()` 기반 상태 동기화로 전환
3. 가이드 텍스트 추가: "① 필드 수정 → ② save() → ③ 선택된 메서드 확인"
4. PATCH 선택 시 RFC 6902 payload 자동 표시

### 5.2. PlaygroundRollback (REBUILD)

**학습 목표**: `save()` 실패 시 자동 롤백, `restore()` 수동 보상 트랜잭션의 차이를 이해한다.

1. 기존 자동 롤백 시연 유지
2. `restore()` 수동 호출 버튼 추가 (save() 성공 후 → 수동 restore())
3. `dsm:rollback` 이벤트 리스너 등록 → 이벤트 발생 시 로그 표시
4. 두 가지 롤백 경로를 명확히 구분하는 UX

### 5.3. PlaygroundDirtyFields (REBUILD — 단순화)

**학습 목표**: 중첩 키를 변경해도 `dirtyFields`에는 최상위 키만 기록됨을 이해한다.

1. 핵심 포인트만 남김: address.city 변경 → dirtyFields에 'address' 등록
2. Set 특성: 같은 키 여러 번 변경해도 크기 증가 없음
3. 컴포넌트 크기 대폭 축소

### 5.4. PlaygroundCsrf (NEW)

**학습 목표**: `init()` 호출 여부와 토큰 파싱 결과에 따라 CSRF 동작이 어떻게 달라지는지 이해한다.

1. DOM에 `<meta name="_csrf" content="demo-token">` 실제 추가/제거 토글
2. `init()` 미호출 상태 → 변이 요청 전송 확인 (CSRF 없음)
3. `init()` 호출 + meta 있음 → X-CSRF-Token 헤더 포함 확인
4. `init()` 호출 + meta 없음 → Error throw 확인

### 5.5. PlaygroundBatching (REBUILD)

**학습 목표**: 동기 블록에서 여러 필드를 변경해도 `getSnapshot()`은 microtask 완료 후 1회만 갱신됨을 이해한다.

1. `_broadcast` 스파이 제거 → `getSnapshot()` 참조 변경 횟수 카운팅으로 대체
2. 동기 변경 3개 → snapshot 갱신 1회 카운터로 시각화
3. `await` 사이 변경 3개 → snapshot 갱신 3회 카운터로 시각화

### 5.6. PlaygroundShadowState (NEW)

**학습 목표**: `subscribe()` + `getSnapshot()`의 동작 원리와 Structural Sharing을 이해한다.

1. 필드 편집 → snapshot 참조 변경 시각화
2. 변경 전후 snapshot 나란히 비교
3. 변경된 경로만 새 참조, 미변경 경로는 기존 참조 재사용 (Structural Sharing) 시각화

### 5.7. PlaygroundPipeline (NEW)

**학습 목표**: `DomainState.all()`의 병렬 fetch + `failurePolicy` 보상 트랜잭션 동작을 이해한다.

1. 리소스 A, B 각각 성공/실패 토글
2. `failurePolicy`: ignore / rollback-all / fail-fast 선택
3. 실행 후 결과: 어떤 리소스가 성공/실패했는지, restore()가 호출됐는지 로그
4. `dsm:pipeline-rollback` 이벤트 발생 시 시각화

---

## 6. 컴포넌트 파일 목록

| 파일명 | 위치 | 상태 |
|---|---|---|
| `MockApiHandler.js` | `docs/.vitepress/components/playground/` | REBUILD |
| `PlaygroundHttpMethod.vue` | 동일 | REBUILD |
| `PlaygroundRollback.vue` | 동일 | REBUILD |
| `PlaygroundDirtyFields.vue` | 동일 | REBUILD |
| `PlaygroundBatching.vue` | 동일 | REBUILD |
| `PlaygroundCsrf.vue` | 동일 | NEW |
| `PlaygroundShadowState.vue` | 동일 | NEW |
| `PlaygroundPipeline.vue` | 동일 | NEW |
| `PlaygroundFormBinder.vue` | 동일 | 기존 유지 (v2.0 deprecated 대상) |
| `PlaygroundRenderer.vue` | 동일 | import 경로만 수정 |
