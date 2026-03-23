# 시스템 개요

이 문서는 `rest-domain-state-manager` 의 전체 아키텍처 레이어 구조와 모듈 간 의존 방향을 기술합니다.

## 레이어 구조

라이브러리는 네 개의 계층으로 구성됩니다. 의존성은 단방향이며 상위 계층이 하위 계층을 호출합니다. 역방향 의존은 허용되지 않습니다.

```text
┌─────────────────────────────────────────────────────────────────┐
│                      진입점 (Entry Point)                       │
│                          index.js                               │
│        { DomainState, ApiHandler, DomainVO, DomainPipeline,     │
│          DomainRenderer, FormBinder, closeDebugChannel }        │
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌─────────────────┼──────────────────────┐
           ▼                 ▼                      ▼
  ┌─────────────────┐ ┌──────────────┐ ┌─────────────────────────┐ 
  │   src/domain/   │ │ src/network/ │ │      src/plugins/       │ 
  │                 │ │              │ │                         │ 
  │  DomainState    │ │  ApiHandler  │ │  domain-renderer/       │ 
  │  DomainVO       │ │              │ │    DomainRenderer.js    │ 
  │  DomainPipeline │ │              │ │  form-binder/           │ 
  │                 │ │              │ │    FormBinder.js        │ 
  └────────┬────────┘ └──────┬───────┘ └─────────────────────────┘ 
           │                 │
           └────────┬────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       src/ (내부 계층)                          │
│                                                                 │
│  core/             debug/            constants/                 │
│  api-proxy.js      debug-channel.js  dirty.const.js             │
│  api-mapper.js                       error.messages.js          │
│  url-resolver.js   common/           log.messages.js            │
│                    js-object-util.js op.const.js                │
│                                      channel.const.js           │
│                                      protocol.const.js          │
└─────────────────────────────────────────────────────────────────┘
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
      <td>상태 추적의 중심. ProxyWrapper 조합, save() 분기 로직, 디버그 채널 연동.</td>
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
      <td>HTTP 전송 레이어. URL 결정, fetch() 래핑, HttpError 생성.</td>
    </tr>
    <tr>
      <td><code>DomainVO</code></td>
      <td>domain</td>
      <td>스키마 선언, Skeleton 생성, validate/transform 제공.</td>
    </tr>
    <tr>
      <td><code>DomainPipeline</code></td>
      <td>domain</td>
      <td>병렬 fetch 조율, after() 체이닝, strict 모드 오류 처리.</td>
    </tr>
    <tr>
      <td><code>debug-channel.js</code></td>
      <td>debug</td>
      <td>BroadcastChannel 싱글톤, 탭 등록/해제, Lazy Initialization.</td>
    </tr>
  </tbody>
</table>

## 순환 참조 해소 — Constructor Injection

`DomainState` 와 `DomainPipeline` 은 서로를 참조합니다. `DomainState.all()` 이 `DomainPipeline` 인스턴스를 생성하고, `DomainPipeline` 은 `DomainState` 인스턴스를 결과로 보유합니다. 정적 `import` 로 이를 연결하면 ES Module 순환 참조가 발생합니다.

이 문제는 **Constructor Injection** 패턴으로 해소됩니다. `index.js` 진입점에서 `DomainState.PipelineConstructor = DomainPipeline` 을 한 번 할당함으로써 런타임에 의존성이 주입됩니다. 두 모듈은 서로를 직접 import하지 않으며 인터페이스 계약으로만 연결됩니다.

## Plugin Architecture

코어 엔진(`src/domain/`, `src/core/`)은 브라우저 DOM에 의존하지 않습니다. Node.js, 테스트 환경, Server-Side Rendering 어디서든 완전히 동작합니다.

DOM에 의존하는 기능(`FormBinder`, `DomainRenderer`)은 `DomainState.use(plugin)` 을 통해 런타임에 주입됩니다. 플러그인은 `DomainState.prototype` 에 메서드를 추가하는 방식으로 동작하며, 한 번 설치된 플러그인은 중복 설치되지 않습니다(`WeakMap` 기반 설치 이력 추적).
