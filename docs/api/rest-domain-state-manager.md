# rest-domain-state-manager

## File

rest-domain-state-manager — 단일 진입점

라이브러리의 모든 공개 API를 이 파일 하나에서 import한다.
외부 개발자는 이 파일만 알면 된다.

── 내보내는 것 ──────────────────────────────────────────────────────────────
  ApiHandler     HTTP 전송 레이어 클래스 (인스턴스 생성은 소비자가 담당)
  DomainState    팩토리 3종 + save / remove / log / openDebugger
  DomainVO       도메인 구조 선언 베이스 클래스
  DomainPipeline 병렬 fetch + 순차 after() 체이닝
  DomainRenderer DOM 렌더링 플러그인 (DomainState.use(DomainRenderer)로 설치)

## References

### ApiHandler

Re-exports [ApiHandler](network.api-handler.Class.ApiHandler.md)

***

### closeDebugChannel

Re-exports [closeDebugChannel](debug.debug-channel.Function.closeDebugChannel.md)

***

### DomainPipeline

Re-exports [DomainPipeline](domain.DomainPipeline.Class.DomainPipeline.md)

***

### DomainRenderer

Re-exports [DomainRenderer](plugins.domain-renderer.DomainRenderer.Variable.DomainRenderer.md)

***

### DomainState

Re-exports [DomainState](domain.DomainState.Class.DomainState.md)

***

### DomainVO

Re-exports [DomainVO](domain.DomainVO.Class.DomainVO.md)

***

### FormBinder

Re-exports [FormBinder](plugins.form-binder.FormBinder.Variable.FormBinder.md)
