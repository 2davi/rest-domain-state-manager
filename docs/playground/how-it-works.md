# Playground 구현 원리

이 문서 사이트의 각 가이드 페이지에는 라이브러리가 실제로 동작하는 인터랙티브 Playground가 포함되어 있습니다. Playground를 어떻게 구현했는지 설명합니다.

## 핵심 기술 스택

VitePress는 Markdown 안에 Vue 컴포넌트를 직접 삽입할 수 있습니다. Playground는 Vue 3 컴포넌트로 구현되었으며, 실제 라이브러리 소스코드를 브라우저에서 직접 실행합니다.

```text
docs/
└── .vitepress/
    ├── theme/
    │   └── index.js          ← 컴포넌트 전역 등록
    └── components/
        └── playground/
            ├── MockApiHandler.js       ← 가짜 서버 핸들러
            ├── PlaygroundHttpMethod.vue
            ├── PlaygroundRollback.vue
            ├── PlaygroundFormBinder.vue
            └── PlaygroundRenderer.vue
```

## 두 가지 핵심 문제와 해결법

### 문제 1: 실제 백엔드가 없다

라이브러리는 `ApiHandler._fetch(url, options)` 를 호출하여 HTTP 요청을 보냅니다. Playground 환경에는 백엔드 서버가 없으므로, `MockApiHandler` 가 이 메서드를 구현하여 가짜 응답을 반환합니다.

```javascript
// docs/.vitepress/components/playground/MockApiHandler.js
export class MockApiHandler {
    async _fetch(url, options = {}) {
        // 설정된 지연 시간만큼 대기 (네트워크 시뮬레이션)
        await new Promise(r => setTimeout(r, this._latency))

        if (this._shouldFail) {
            throw { status: this._failStatus, statusText: 'Conflict', body: '' }
        }

        return structuredClone(this._data)
    }
}
```

### 문제 2: VitePress SSR과의 충돌

VitePress는 빌드 시 서버(Node.js)에서 HTML을 pre-render합니다. Node.js에는 `window`, `BroadcastChannel` 이 없으므로, 라이브러리를 모듈 최상위에서 import하면 빌드가 실패합니다.

해결책은 `onMounted()` 훅 안에서 동적 import를 사용하는 것입니다. `onMounted()` 는 브라우저에서만 실행되므로 SSR 문제를 완전히 우회합니다.

```javascript
// Vue 컴포넌트 내부
onMounted(async () => {
    // 브라우저에서만 실행 — SSR 환경에서는 이 코드에 도달하지 않음
    const lib  = await import('/index.js')
    const mock = await import('./MockApiHandler.js')
    DomainState    = lib.DomainState
    MockApiHandler = mock.MockApiHandler
    initState()
})
```

## Playground 상태 동기화 패턴

Playground의 핵심 패턴은 Vue의 반응성이 아니라 **라이브러리 내부 상태를 직접 폴링**하는 방식입니다.

```javascript
// 라이브러리 상태 → Vue reactive 객체로 동기화
function syncDisplay() {
    display.data        = { ...state._getTarget() }
    display.dirtyFields = [...state._getDirtyFields()]
    display.changeLog   = state._getChangeLog()
    display.isNew       = state._isNew
}
```

`debug: true` 모드의 `BroadcastChannel` 을 사용하지 않고 직접 폴링하는 이유는, Playground 환경에서는 다른 탭과의 통신이 불필요하고 Vue의 반응성과 충돌을 최소화하기 위함입니다.

## 테스트케이스와의 연결

각 Playground 컴포넌트는 단위 테스트 케이스와 직접 연결됩니다.

| Vue 컴포넌트           | 연결된 TC                | 검증 동작           |
| ---------------------- | ------------------------ | ------------------- |
| `PlaygroundHttpMethod` | TC-DS-001, 003, 004, 005 | POST/PUT/PATCH 분기 |
| `PlaygroundRollback`   | TC-DS-006, 009, TC-C-013 | 롤백 및 재시도      |
| `PlaygroundFormBinder` | TC-FB-001, 002, 003      | 폼 바인딩           |
| `PlaygroundRenderer`   | TC-DR-001                | select 렌더링       |

Vitest로 Node 환경에서 검증한 로직을 그대로 브라우저에서 시연하므로, 문서와 구현 사이의 괴리가 발생하지 않습니다.
