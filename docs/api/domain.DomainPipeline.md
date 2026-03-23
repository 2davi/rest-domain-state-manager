# domain/DomainPipeline

DomainPipeline — 병렬 fetch + 순차 후처리 체이닝

`DomainState.all()`이 반환하는 파이프라인 객체.
여러 `DomainState`를 병렬로 fetch하고,
`after()`로 등록된 핸들러를 등록 순서대로 순차 실행한다.

## 실행 모델

```
DomainState.all(resourceMap, options)
  ↓
DomainPipeline 인스턴스 생성
  ↓ .after('roles', handler1)
  ↓ .after('user',  handler2)
  ↓ .run()
     ├─ 1단계: Promise.allSettled()로 모든 리소스 병렬 fetch
     ├─ 2단계: after() 큐를 등록 순서대로 순차 await
     └─ 3단계: { ...DomainStates, _errors? } 반환
```

## strict 옵션 동작

| strict | fetch 실패 시            | after() 핸들러 실패 시   | 반환값                          |
|--------|------------------------|------------------------|--------------------------------|
| `false`| `_errors`에 기록, 계속  | `_errors`에 기록, 계속  | `resolve` + `_errors` 배열 포함 |
| `true` | 즉시 `reject`           | 즉시 `reject`           | `reject`                        |

## 설계 원칙 — strict 기본값 `false`
HTTP Request/Response는 이미 완료된 비용이다.
독립적인 리소스의 fetch 실패가 전체 파이프라인을 중단시키는 것은 과잉 반응이다.
실패 항목은 `_errors`에 기록하고 나머지를 계속 진행하는 것이 유지보수에 유리하다.

## 에러 처리 패턴

```js
const result = await DomainState.all({ ... }, { strict: false }).run();
if (result._errors?.length) {
    result._errors.forEach(({ key, error }) => console.warn(key, error));
}
```

## See

 - DomainState
 - [MDN — Promise.allSettled](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)

## Classes

- [DomainPipeline](domain.DomainPipeline.Class.DomainPipeline.md)

## Interfaces

- [PipelineError](domain.DomainPipeline.Interface.PipelineError.md)
- [PipelineOptions](domain.DomainPipeline.Interface.PipelineOptions.md)
- [QueueEntry](domain.DomainPipeline.Interface.QueueEntry.md)

## Type Aliases

- [AfterHandler](domain.DomainPipeline.TypeAlias.AfterHandler.md)
- [PipelineResult](domain.DomainPipeline.TypeAlias.PipelineResult.md)
- [ResourceMap](domain.DomainPipeline.TypeAlias.ResourceMap.md)
