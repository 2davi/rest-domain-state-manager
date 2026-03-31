# 시스템 개요

이 문서는 `rest-domain-state-manager` 의 전체 아키텍처 레이어 구조와 모듈 간 의존 방향을 기술합니다.

## 레이어 구조

라이브러리는 다섯 개의 계층으로 구성됩니다. 의존성은 단방향이며 상위 계층이 하위 계층을 호출합니다. 역방향 의존은 허용되지 않습니다.

```javascript
           ┌─────────────────────────────────────────────────────────────────────┐
           │                      진입점 (Entry Point)                           │// [!code highlight]
           │                          src/index.js                               │
           │                  Composition Root — 의존성 조립                     │
           │    { DomainState, ApiHandler, DomainVO, DomainPipeline,             │
           │      DomainRenderer, FormBinder, closeDebugChannel }                │
           └───────────────────────────┬─────────────────────────────────────────┘
                                       │
                   ┌───────────────────┼─────────────────────┐
                   ▼                   ▼                     ▼
           ┌─────────────────┐  ┌──────────────┐  ┌────────────────────────────┐
           │  src/domain/    │  │ src/network/ │  │       src/plugins/         │// [!code highlight]
           │                 │  │              │  │                            │
           │  DomainState    │  │  ApiHandler  │  │   domain-renderer/         │
           │  DomainVO       │  │              │  │   DomainRenderer.js        │
           │  DomainPipeline │  │              │  │   form-binder/             │
           │                 │  │              │  │   FormBinder.js            │
           └───────┬─────────┘  └──────┬───────┘  └────────────────────────────┘
                   │                   │
                   │                   │     ┌─────────────────────────────┐
                   │                   │     │     src/adapters/           │// [!code highlight]
                   │                   │     │                             │
                   │                   │     │  react.js (React 어댑터)    │
                   │                   │     │  (subpath export)           │
                   │                   │     └─────────────────────────────┘
                   │                   │ 
                   │                   │     ┌─────────────────────────────┐
                   │                   │     │      src/workers/           │// [!code highlight]
                   │                   │     │                             │
                   │                   │     │  serializer.worker.js       │
                   │                   │     │  (BroadcastChannel 오프로드)│
                   │                   │     └─────────────────────────────┘
                   │                   │
                   └────────┬──────────┘
                            ▼
           ┌─────────────────────────────────────────────────────────────────────┐
           │                        src/ (내부 계층)                             │// [!code highlight]
           │                                                                     │
           │  core/               debug/            common/                      │
           │  api-proxy.js        debug-channel.js  clone.js (safeClone)         │
           │  api-mapper.js                         freeze.js (deepFreeze)       │
           │  url-resolver.js     constants/        logger.js (devWarn)          │
           │                      dirty.const.js                                 │
           │                      error.messages.js                              │
           │                      log.messages.js                                │
           │                      op.const.js                                    │
           │                      channel.const.js                               │
           │                      protocol.const.js                              │
           └─────────────────────────────────────────────────────────────────────┘
```

## 핵심 모듈 역할

<table class="param-table">
  <thead>
    <tr><th>모듈</th><th>레이어</th><th>역할</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>DomainState</code></td>
      <td>domain</td>
      <td>상태 추적의 중심. ProxyWrapper 조합, save() 분기 로직, Shadow State, 디버그 채널 연동.</td>
    </tr>
    <tr>
      <td><code>api-proxy.js</code></td>
      <td>core</td>
      <td>JS Proxy 엔진. set/get/deleteProperty 트랩, changeLog, dirtyFields, 복원 메서드 클로저.</td>
    </tr>
    <tr>
      <td><code>api-mapper.js</code></td>
      <td>core</td>
      <td>changeLog → HTTP payload 변환. <code>toPayload()</code>(PUT/POST), <code>toPatch()</code>(PATCH RFC 6902).</td>
    </tr>
    <tr>
      <td><code>ApiHandler</code></td>
      <td>network</td>
      <td>HTTP 전송 레이어. URL 결정, CSRF 토큰 주입, fetch() 래핑, HttpError 생성.</td>
    </tr>
    <tr>
      <td><code>DomainVO</code></td>
      <td>domain</td>
      <td>스키마 선언, Skeleton 생성, validate/transform 제공.</td>
    </tr>
    <tr>
      <td><code>DomainPipeline</code></td>
      <td>domain</td>
      <td>병렬 fetch 조율, after() 체이닝, strict 모드 오류 처리, 보상 트랜잭션(failurePolicy).</td>
    </tr>
    <tr>
      <td><code>debug-channel.js</code></td>
      <td>debug</td>
      <td>BroadcastChannel 싱글톤, 탭 등록/해제, Lazy Initialization. serializer.worker로 직렬화 오프로드.</td>
    </tr>
    <tr>
      <td><code>clone.js</code></td>
      <td>common</td>
      <td><code>safeClone()</code> — structuredClone 우선, 구형 환경 폴백. 스냅샷 깊은 복사 전담.</td>
    </tr>
    <tr>
      <td><code>freeze.js</code></td>
      <td>common</td>
      <td><code>deepFreeze()</code> / <code>maybeDeepFreeze()</code> — Shadow State 불변 스냅샷 동결. 프로덕션 no-op.</td>
    </tr>
    <tr>
      <td><code>logger.js</code></td>
      <td>common</td>
      <td><code>devWarn()</code> / <code>logError()</code> — silent 플래그 통합 로그 제어.</td>
    </tr>
    <tr>
      <td><code>react.js</code></td>
      <td>adapters</td>
      <td><code>useDomainState()</code> — useSyncExternalStore 기반 React 연동 훅. subpath export.</td>
    </tr>
    <tr>
      <td><code>serializer.worker.js</code></td>
      <td>workers</td>
      <td>_stateRegistry 직렬화 + BroadcastChannel 발화를 메인 스레드에서 오프로드.</td>
    </tr>
  </tbody>
</table>

## 순환 참조 해소 — Composition Root 패턴

`DomainState` 와 `DomainPipeline` 은 서로를 참조합니다. `DomainState.all()` 이 `DomainPipeline` 인스턴스를 생성하고, `DomainPipeline` 은 `DomainState` 인스턴스를 결과로 보유합니다. 정적 `import` 로 이를 연결하면 ES Module 순환 참조가 발생합니다.

이 문제는 **Composition Root 패턴**으로 해소됩니다. `src/index.js` 진입점이 두 모듈을 각각 import한 뒤 `DomainState.configure({ pipelineFactory })` 를 호출하여 의존성을 조립합니다. 소비자 코드에서 이 조립 과정을 직접 수행할 필요가 없습니다.

```javascript
의존 방향 (단방향) // [!code highlight]

  DomainPipeline ──→ DomainState
       ↑                  ↑
       └──── index.js ─────┘
          (Composition Root)
          configure({ pipelineFactory: (...args) => new DomainPipeline(...args) })
```

각 모듈 파일은 서로를 알지 못합니다. `DomainState` 는 `_pipelineFactory` 라는 모듈 레벨 클로저 변수를 통해 `DomainPipeline` 의 존재 없이 파이프라인 인스턴스를 생성합니다.

::: tip Vitest 환경에서의 활용
`DomainState.configure({ pipelineFactory: vi.fn() })` 으로 DomainPipeline 없이 DomainState 단독 테스트가 가능합니다. 두 모듈이 완전히 독립적으로 테스트될 수 있습니다.
:::

## Plugin Architecture

코어 엔진(`src/domain/`, `src/core/`)은 브라우저 DOM에 의존하지 않습니다. Node.js, 테스트 환경, Server-Side Rendering 어디서든 완전히 동작합니다.

DOM에 의존하는 기능(`FormBinder`, `DomainRenderer`)은 `DomainState.use(plugin)` 을 통해 런타임에 주입됩니다. 플러그인은 `DomainState.prototype` 에 메서드를 추가하는 방식으로 동작하며, 한 번 설치된 플러그인은 중복 설치되지 않습니다(`Set` 기반 설치 이력 추적).

## Silent 모드 — 전역 로그 제어

`DomainState.configure({ silent: true })` 를 호출하면 라이브러리 내부의 모든 `console` 출력이 억제됩니다. 운영 환경의 콘솔 노이즈를 막거나 통합 테스트에서 불필요한 로그를 제거할 때 사용합니다.

```javascript
// 운영 환경 // [!code highlight]

if (process.env.NODE_ENV === 'production') {
    DomainState.configure({ silent: true })
}
```
