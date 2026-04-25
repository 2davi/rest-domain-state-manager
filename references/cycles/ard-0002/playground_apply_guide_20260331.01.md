# Playground 적용 가이드

## 1. 파일 교체 위치

`docs/.vitepress/components/playground/` 안의 파일을 아래와 같이 교체/추가한다.

| 이 디렉터리의 파일 | 작업 |
|---|---|
| `MockApiHandler.js` | **덮어쓰기** |
| `PlaygroundHttpMethod.vue` | **덮어쓰기** |
| `PlaygroundRollback.vue` | **덮어쓰기** |
| `PlaygroundDirtyFields.vue` | **덮어쓰기** |
| `PlaygroundBatching.vue` | **덮어쓰기** |
| `PlaygroundCsrf.vue` | **신규 추가** |
| `PlaygroundShadowState.vue` | **신규 추가** |
| `PlaygroundPipeline.vue` | **신규 추가** |

`PlaygroundFormBinder.vue`, `PlaygroundRenderer.vue` 는 이 패치에서 건드리지 않는다.

---

## 2. docs/.vitepress/config.mts — vite alias 추가

모든 Playground 컴포넌트는 `@2davi/rest-domain-state-manager` 패키지명으로 import한다.
VitePress dev/build 환경에서 이 이름이 실제 `src/index.js`를 가리키도록 alias를 추가해야 한다.

```typescript
// docs/.vitepress/config.mts
import { fileURLToPath } from 'url'
import { defineConfig }  from 'vitepress'

export default defineConfig({
    // ... 기존 설정 유지 ...

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

`new URL('../../src/index.js', import.meta.url)` 의 상대 경로는
`docs/.vitepress/config.mts` 기준으로 레포 루트 `src/index.js`를 가리킨다.
프로젝트 구조가 다르면 이 경로를 조정한다.

---

## 3. docs/.vitepress/theme/index.js — 신규 컴포넌트 전역 등록

신규 컴포넌트 3개를 `enhanceApp`에 추가한다.
기존 등록된 컴포넌트는 그대로 유지한다.

```javascript
// docs/.vitepress/theme/index.js
import DefaultTheme from 'vitepress/theme'
import './custom.css'

// 기존 컴포넌트
import PlaygroundHttpMethod  from '../components/playground/PlaygroundHttpMethod.vue'
import PlaygroundRollback    from '../components/playground/PlaygroundRollback.vue'
import PlaygroundDirtyFields from '../components/playground/PlaygroundDirtyFields.vue'
import PlaygroundBatching    from '../components/playground/PlaygroundBatching.vue'
import PlaygroundFormBinder  from '../components/playground/PlaygroundFormBinder.vue'
import PlaygroundRenderer    from '../components/playground/PlaygroundRenderer.vue'

// 신규 컴포넌트 (추가)
import PlaygroundCsrf        from '../components/playground/PlaygroundCsrf.vue'
import PlaygroundShadowState from '../components/playground/PlaygroundShadowState.vue'
import PlaygroundPipeline    from '../components/playground/PlaygroundPipeline.vue'

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('PlaygroundHttpMethod',  PlaygroundHttpMethod)
        app.component('PlaygroundRollback',    PlaygroundRollback)
        app.component('PlaygroundDirtyFields', PlaygroundDirtyFields)
        app.component('PlaygroundBatching',    PlaygroundBatching)
        app.component('PlaygroundFormBinder',  PlaygroundFormBinder)
        app.component('PlaygroundRenderer',    PlaygroundRenderer)
        // 신규 등록
        app.component('PlaygroundCsrf',        PlaygroundCsrf)
        app.component('PlaygroundShadowState', PlaygroundShadowState)
        app.component('PlaygroundPipeline',    PlaygroundPipeline)
    }
}
```

---

## 4. 마크다운 파일에 컴포넌트 삽입

신규 컴포넌트를 실제 docs 페이지에 추가한다.

### docs/guide/api-handler.md

`init()` 섹션 아래 (3-상태 표 다음):

```markdown
<PlaygroundCsrf />
```

### docs/architecture/state-lifecycle.md

Shadow State 섹션 아래 (subscribe/getSnapshot 설명 다음):

```markdown
<PlaygroundShadowState />
```

Microtask Batching 섹션:

```markdown
<PlaygroundBatching />
```

(기존 `<PlaygroundBatching />` 태그 교체)

### docs/guide/pipeline.md

failurePolicy 섹션 아래:

```markdown
<PlaygroundPipeline />
```

### docs/guide/save-strategy.md

기존 `<PlaygroundDirtyFields />` 와 `<PlaygroundHttpMethod />` 는 재구축된 파일로 자동 교체됨 (태그 변경 불필요).
기존 `<PlaygroundRollback />` 도 동일.
