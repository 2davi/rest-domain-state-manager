# Class: DomainPipeline

`run()`의 반환값 타입.
성공한 리소스의 `DomainState` 맵에 선택적으로 `_errors` 배열이 포함된다.

## Constructors

### Constructor

> **new DomainPipeline**(`resourceMap`, `options?`): `DomainPipeline`

`DomainPipeline` 인스턴스를 생성한다.

**직접 호출 금지.** `DomainState.all(resourceMap, options)`을 사용한다.
`DomainState.all()`은 내부적으로 `DomainState.PipelineConstructor`를 통해
이 생성자를 호출한다.

#### Parameters

##### resourceMap

[`ResourceMap`](domain.DomainPipeline.TypeAlias.ResourceMap.md)

키: 리소스 식별자, 값: `Promise<DomainState>`

##### options?

[`PipelineOptions`](domain.DomainPipeline.Interface.PipelineOptions.md) = `{}`

파이프라인 실행 옵션

#### Returns

`DomainPipeline`

#### Example

```ts
// ❌ 직접 생성 금지
// new DomainPipeline({ ... });

// ✅ DomainState.all()을 통해 사용
const result = await DomainState.all({ roles: api.get('/api/roles') }, { strict: false })
    .after('roles', async roles => { ... })
    .run();
```

## Properties

### \_failurePolicy

> **\_failurePolicy**: `"ignore"` \| `"rollback-all"` \| `"fail-fast"`

파이프라인 실패 시 보상 트랜잭션 정책.
`'ignore'`(기본값)이면 기존 동작과 동일하다.

***

### \_queue

> **\_queue**: [`QueueEntry`](domain.DomainPipeline.Interface.QueueEntry.md)[]

`after()` 핸들러 큐. 등록 순서가 곧 실행 순서다.
`run()` 2단계에서 이 배열을 순서대로 순차 `await`한다.

***

### \_resourceMap

> **\_resourceMap**: [`ResourceMap`](domain.DomainPipeline.TypeAlias.ResourceMap.md)

병렬 fetch 대상 리소스 맵.
키: 리소스 식별자, 값: `Promise<DomainState>`.
`run()` 실행 시 `Promise.allSettled()`에 전달된다.

***

### \_strict

> **\_strict**: `boolean`

strict 모드 플래그.
`true`이면 첫 실패에서 즉시 `reject`, `false`이면 `_errors`에 기록 후 계속.

## Methods

### \_compensate()

> **\_compensate**(`resolved`, `keys`): `void`

지정된 키 목록의 `DomainState`에 순서대로 `restore()`를 호출한다.

`fail-fast` 정책에서는 완료 키를 **역순(LIFO)**으로 전달하고,
`rollback-all` 정책에서는 `resolved`의 전체 키를 전달한다.
`restore()`는 멱등성이 보장되므로 스냅샷이 없는 인스턴스에 호출해도 안전하다.

#### Parameters

##### resolved

`Record`\<`string`, [`DomainState`](domain.DomainState.Class.DomainState.md)\>

1단계 fetch에서 성공한 DomainState 맵

##### keys

`string`[]

`restore()`를 호출할 키 목록. 배열 순서가 실행 순서가 된다.

#### Returns

`void`

***

### \_dispatchPipelineRollback()

> **\_dispatchPipelineRollback**(`errors`, `resolved`): `void`

파이프라인 보상 트랜잭션 완료 후 `dsm:pipeline-rollback` CustomEvent를 발행한다.

소비자 앱이 이 이벤트를 구독하여 어느 리소스가 실패했는지 파악하고
서버 롤백 API 호출 또는 UI 에러 모달 표시를 직접 구현할 수 있다.
Node.js / Vitest 환경에서는 window가 없으므로 건너뛴다.

#### Parameters

##### errors

[`PipelineError`](domain.DomainPipeline.Interface.PipelineError.md)[]

실패한 에러 목록

##### resolved

`Record`\<`string`, [`DomainState`](domain.DomainState.Class.DomainState.md)\>

성공한 DomainState 맵

#### Returns

`void`

***

### after()

> **after**(`key`, `handler`): `DomainPipeline`

특정 리소스에 대한 후처리 핸들러를 큐에 등록한다.

등록 순서가 `run()` 에서의 실행 순서가 된다.
`run()`이 호출될 때까지 핸들러는 실행되지 않는다.

fetch가 성공한 리소스만 핸들러가 실행된다.
fetch가 실패한 리소스의 핸들러는 `run()` 2단계에서 자동으로 건너뛰며
`_errors`에 스킵 이유가 기록된다.

#### Parameters

##### key

`string`

`resourceMap`의 키 이름. 존재하지 않는 키면 즉시 `Error` throw.

##### handler

[`AfterHandler`](domain.DomainPipeline.TypeAlias.AfterHandler.md)

해당 `DomainState`를 인자로 받는 핸들러 함수.
  async 함수 또는 일반 함수 모두 지원.

#### Returns

`DomainPipeline`

체이닝을 위한 `this` 반환

#### Throws

`key`가 `resourceMap`에 없는 경우

#### Throws

`handler`가 함수가 아닌 경우

#### Examples

```ts
DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/1'),
})
.after('roles', async roles => {
    roles.renderTo('#roleDiv', { type: 'select', valueField: 'roleId', labelField: 'roleName' });
})
.after('user', async user => {
    user.bindForm('#userForm');
})
.run();
```

```ts
pipeline.after('nonExistent', handler);
// → Error: [DSM] Pipeline: 'nonExistent' 키가 resourceMap에 없습니다.
```

***

### run()

> **run**(): `Promise`\<[`PipelineResult`](domain.DomainPipeline.TypeAlias.PipelineResult.md)\>

등록된 fetch Promise와 `after()` 핸들러를 순서대로 실행한다.

## 실행 흐름

### 1단계 — 병렬 fetch
`Promise.allSettled()`로 모든 리소스를 병렬로 fetch한다.
`allSettled`를 사용하므로 일부 실패가 나머지 fetch를 중단시키지 않는다.
- 성공(`fulfilled`): `resolved[key]`에 `DomainState` 저장
- 실패(`rejected`):
  - `strict: false` → `errors`에 `{ key, error: reason }` 기록 후 계속
  - `strict: true`  → `reason`을 즉시 `throw`
  - 디버그 채널에 `broadcastError(key, reason)` 전송

### 2단계 — after() 핸들러 순차 실행
`_queue`를 등록 순서대로 순회하며 각 핸들러를 `await`한다.
- fetch 실패로 `resolved[key]`가 없는 경우: 스킵 이유를 `errors`에 기록하고 `continue`
- 핸들러 성공: 정상 진행
- 핸들러 실패:
  - `strict: false` → `errors`에 기록 후 다음 핸들러 계속
  - `strict: true`  → 즉시 `throw`
  - 디버그 채널에 `broadcastError(key, err)` 전송

### 3단계 — 보상 트랜잭션 (failurePolicy에 따라)
- `'rollback-all'`: 모든 핸들러 완료 후 에러가 하나라도 있으면
  전체 `resolved`에 `restore()`를 호출한다.
- `'fail-fast'`: 첫 번째 핸들러 실패 시 즉시 중단하고
  이전 성공 상태들에 **역순(LIFO)**으로 `restore()`를 호출한다.
- `'ignore'`: 보상 없음. 기존 동작과 동일.

### 4단계 — 결과 반환
`errors`가 있으면 `output._errors`에 포함하여 반환한다.

#### Returns

`Promise`\<[`PipelineResult`](domain.DomainPipeline.TypeAlias.PipelineResult.md)\>

성공한 리소스의 `DomainState` 맵. 실패 항목이 있으면 `_errors` 포함.

#### Throws

`strict: true`이고 fetch 또는 핸들러가 실패한 경우 에러를 즉시 throw

#### Examples

```ts
const result = await DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/INVALID'), // 404 예상
}, { strict: false })
.after('roles', async roles => { roles.renderTo('#roleDiv', { ... }); })
.run();

// result.roles  → DomainState (성공)
// result.user   → undefined (fetch 실패)
// result._errors → [{ key: 'user', error: { status: 404, ... } }]
result._errors?.forEach(({ key, error }) => console.warn(key, error));
```

```ts
try {
    const result = await DomainState.all({ ... }, { strict: true })
        .after('roles', async roles => { ... })
        .run();
} catch (err) {
    console.error('Pipeline 중단:', err);
}
```

```ts
const { roles, user } = await DomainState.all({ roles: ..., user: ... }).run();
user.data.name = 'Davi';
await user.save('/api/users/1');
```
