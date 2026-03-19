# model/DomainState

DomainState — REST API 연동 도메인 상태 관리자

REST 리소스(또는 Aggregate Root) 단위로 인스턴스 하나를 생성한다.
`DomainState` 인스턴스는 **현재 상태(Proxy) + 변경 이력(changeLog) + 동기화 단위**의 세 역할을 동시에 수행한다.

## 생성 경로 (팩토리 메서드)

| 팩토리               | 입력            | `isNew` | 주 용도                                        |
|---------------------|-----------------|---------|------------------------------------------------|
| `fromJSON()`        | JSON 문자열     | `false` | GET 응답 수신 후 변경·저장                      |
| `fromVO()`          | `DomainVO` 인스턴스 | `true` | 신규 리소스 생성(POST)                        |
| `fromForm()` ¹      | HTML Form 요소  | `true`  | FormBinder 플러그인 설치 후 사용 가능           |

¹ `fromForm()`은 `FormBinder` 플러그인이 `DomainState.use(FormBinder)` 호출 후
  `DomainState.fromForm`으로 동적 주입된다.

## 외부 인터페이스

| 멤버              | 종류            | 설명                                                  |
|------------------|-----------------|-------------------------------------------------------|
| `.data`          | getter (Proxy)  | 변경 추적 Proxy 객체. 유일한 외부 데이터 진입점.        |
| `.save(path?)`   | async method    | `isNew` + `changeLog` 기반 POST / PATCH / PUT 자동 분기 |
| `.remove(path?)` | async method    | DELETE 요청 전송                                      |
| `.log()`         | method          | changeLog를 콘솔 테이블로 출력 (`debug: true` 시만)    |
| `.openDebugger()`| method          | 디버그 팝업 열기 (`debug: true` 시만)                  |

## 플러그인 시스템
`DomainState.use(plugin)` 호출 시 `plugin.install(DomainState)`가 실행되어
`prototype` 또는 클래스 레벨에 기능을 동적으로 주입할 수 있다.

## 의존성 주입 (순환 참조 해소)
`DomainState`와 `DomainPipeline`의 상호 참조를 막기 위해
진입점(`rest-domain-state-manager.js`)에서
`DomainState.PipelineConstructor = DomainPipeline`으로 생성자를 주입한다.

## See

 - module:model/DomainVO DomainVO
 - module:model/DomainPipeline DomainPipeline
 - module:handler/api-handler ApiHandler

## Classes

- [DomainState](model.DomainState.Class.DomainState.md)

## Interfaces

- [DomainStateOptions](model.DomainState.Interface.DomainStateOptions.md)
- [DsmPlugin](model.DomainState.Interface.DsmPlugin.md)
- [FromJsonOptions](model.DomainState.Interface.FromJsonOptions.md)
- [FromVoOptions](model.DomainState.Interface.FromVoOptions.md)
- [NormalizedUrlConfig](model.DomainState.Interface.NormalizedUrlConfig.md)
- [PipelineOptions](model.DomainState.Interface.PipelineOptions.md)
- [ProxyWrapper](model.DomainState.Interface.ProxyWrapper.md)

## Type Aliases

- [PipelineResult](model.DomainState.TypeAlias.PipelineResult.md)
- [ResourceMap](model.DomainState.TypeAlias.ResourceMap.md)
- [TransformerMap](model.DomainState.TypeAlias.TransformerMap.md)
- [ValidatorMap](model.DomainState.TypeAlias.ValidatorMap.md)
