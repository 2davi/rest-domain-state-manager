# DomainPipeline

<span class="badge badge-stable">Stable</span>

`DomainState.all()` 을 사용하면 여러 API를 병렬로 호출하고, 각 응답에 대한 후처리를 체인 형태로 선언할 수 있습니다. 개별 `await` 를 여러 번 작성하는 대신 병렬성과 순차 처리를 동시에 표현합니다.

## 기본 구조

```javascript
import { DomainState } from '@2davi/rest-domain-state-manager'

const result = await DomainState.all({
    user:  api.get('/users/user_001'),
    roles: api.get('/roles'),
})
.after('roles', async (roles) => {
    roles.renderTo('#roleSelect', { type: 'select', valueField: 'roleId', labelField: 'roleName' })
})
.after('user', async (user) => {
    console.log('사용자 이름:', user.data.name)
})
.run()

// result.user, result.roles 로 DomainState 인스턴스에 접근
```

`after()` 핸들러는 네트워크 응답 도착 순서와 무관하게 **코드에 등록된 순서대로** 실행됩니다. 비동기 처리의 예측 가능성을 보장합니다.

## strict 모드 — 실패 동작 제어

파이프라인 실행 중 특정 API 호출 또는 `after()` 핸들러에서 오류가 발생했을 때의 동작을 `strict` 옵션으로 제어합니다.

### strict: false (기본값 — 부분 실패 허용)

하나의 리소스가 실패해도 나머지 처리를 계속 진행합니다. 실패 내역은 `result._errors` 배열에 누적됩니다.

```javascript
const result = await DomainState.all({
    user:  api.get('/users/user_001'),
    roles: api.get('/roles/INVALID'),  // 404 발생 가정
}, { strict: false }).run()

console.log(result.user)    // DomainState 인스턴스 — 정상
console.log(result.roles)   // undefined — 실패한 키는 결과에 없음

if (result._errors?.length > 0) {
    result._errors.forEach(({ key, error }) =>
        console.warn(`[${key}] 실패:`, error)
    )
}
```

### strict: true (첫 실패 시 즉시 중단)

모든 리소스가 완벽하게 로드되어야 화면을 그릴 수 있는 경우에 사용합니다. 첫 번째 오류 발생 시 전체 파이프라인이 reject됩니다.

```javascript
try {
    const result = await DomainState.all({
        user:  api.get('/users/user_001'),
        roles: api.get('/roles'),
    }, { strict: true }).run()
} catch (err) {
    console.error('파이프라인 중단:', err)
    showErrorPage()
}
```

## failurePolicy — 보상 트랜잭션 정책

파이프라인 내부에서 `after()` 핸들러가 실패했을 때 이미 처리된 상태들을 어떻게 처리할지 결정합니다. `save()` 호출 포함 핸들러에서 특히 유용합니다.

| 값 | 동작 |
|---|---|
| `'ignore'` (기본값) | 실패를 `_errors`에 기록하고 계속 진행. 보상 없음. |
| `'rollback-all'` | 모든 핸들러 완료 후 에러가 하나라도 있으면 성공한 모든 DomainState에 `restore()` 호출. |
| `'fail-fast'` | 첫 번째 핸들러 실패 시 즉시 중단. 이전 성공 상태들에 역순(LIFO)으로 `restore()` 호출. |

::: tip failurePolicy 선택 기준
독립적인 리소스(공통코드 로딩 등)에는 `'ignore'`가 적합합니다. 부모-자식 관계처럼 순차적으로 저장해야 하는 리소스에는 `'fail-fast'` 또는 `'rollback-all'` 을 사용하여 상태 불일치를 방지하세요.
:::

<PlaygroundPipeline />

### rollback-all 예시

A, B, C 세 리소스를 저장하는 중 C가 실패하면 A, B를 `restore()` 합니다.

```javascript
const result = await DomainState.all({
    a: api.get('/api/orders/1'),
    b: api.get('/api/items/1'),
    c: api.get('/api/shipments/1'),
}, { failurePolicy: 'rollback-all' })
.after('a', async a => { await a.save('/api/orders/1') })
.after('b', async b => { await b.save('/api/items/1') })
.after('c', async c => { await c.save('/api/shipments/1') })  // 실패 가정
.run()

// c 실패 → a, b 의 save() 이전 인메모리 상태가 restore()
// result._errors 에 실패 정보 포함
```

### fail-fast 예시

직렬 의존 관계(b는 a가 성공해야 의미가 있는 경우)에서 사용합니다.

```javascript
const result = await DomainState.all({
    a: api.get('/api/members/1'),
    b: api.get('/api/certs/1'),
}, { failurePolicy: 'fail-fast' })
.after('a', async a => { await a.save('/api/members/1') })  // 실패 가정
.after('b', async b => { await b.save('/api/certs/1') })    // 실행되지 않음
.run()

// a 실패 → 즉시 중단, a를 restore(), b 핸들러는 실행되지 않음
```

### dsm:pipeline-rollback 이벤트

보상 트랜잭션이 완료되면 `dsm:pipeline-rollback` CustomEvent 가 발행됩니다. 소비자 앱이 이 이벤트를 구독하여 서버 롤백 API 호출 또는 사용자 알림을 구현할 수 있습니다.

```javascript
window.addEventListener('dsm:pipeline-rollback', (e) => {
    console.warn('파이프라인 롤백 발생:', e.detail.errors)
    // e.detail.resolved — 성공했다가 rollback된 리소스 레이블 맵
    showNotification('일부 저장에 실패하여 이전 상태로 복원되었습니다.')
})
```

::: warning 인메모리 상태만 복원됩니다
`restore()` 는 프론트엔드 메모리 상태만 복원합니다. 서버에 이미 커밋된 요청을 되돌리는 것은 소비자 책임입니다. `dsm:pipeline-rollback` 이벤트를 구독하여 필요한 서버 롤백 API를 직접 호출하세요.
:::

## after() 핸들러 유효성 검사

`after()` 에 전달하는 키는 `all()` 의 `resourceMap` 에 선언된 키여야 합니다. 존재하지 않는 키를 지정하면 즉시 `Error` 가 throw됩니다. 이는 타이핑 실수를 런타임에 조기 발견하기 위한 설계입니다.

```javascript
const pipeline = new DomainPipeline({ user: api.get('/users/1') })

pipeline.after('usr', () => {})
// → Error: 'usr' 키는 resourceMap에 존재하지 않습니다. ('user'를 의도하셨나요?)
```

## 실행 흐름 요약

```text
DomainState.all(resourceMap, { strict?, failurePolicy? })
  │
  ▼
1단계: Promise.allSettled() — 모든 리소스 병렬 fetch
  │  fulfilled → resolved[key] 에 DomainState 저장
  │  rejected  → errors 에 기록 (strict: true 이면 즉시 throw)
  │
  ▼
2단계: _queue 순차 실행 (after() 등록 순서)
  │  핸들러 성공  → completedKeys 에 추가
  │  핸들러 실패  → errors 에 기록
  │               fail-fast: LIFO restore() + break
  │               strict: true 이면 즉시 throw
  │
  ▼
3단계: 보상 트랜잭션 (failurePolicy 에 따라)
  │  rollback-all: errors > 0 이면 전체 restore()
  │  fail-fast:    2단계에서 이미 처리됨
  │  ignore:       건너뜀
  │
  ▼
4단계: { ...resolved, _errors? } 반환
```
