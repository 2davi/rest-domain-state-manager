# DomainPipeline

<span class="badge badge-stable">Stable</span>

`DomainState.all()` 을 사용하면 여러 API를 병렬로 호출하고, 각 응답에 대한 후처리를 체인 형태로 선언할 수 있습니다. 개별 `await` 를 여러 번 작성하는 대신 병렬성과 순차 처리를 동시에 표현합니다.

## 기본 구조

```javascript
import { DomainState, DomainPipeline } from '@2davi/rest-domain-state-manager'
DomainState.PipelineConstructor = DomainPipeline  // 진입점 없이 직접 사용 시 필요

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

## after() 핸들러 유효성 검사

`after()` 에 전달하는 키는 `all()` 의 `resourceMap` 에 선언된 키여야 합니다. 존재하지 않는 키를 지정하면 즉시 `Error` 가 throw됩니다. 이는 타이핑 실수를 런타임에 조기 발견하기 위한 설계입니다.

```javascript
const pipeline = new DomainPipeline({ user: api.get('/users/1') })

pipeline.after('usr', () => {})
// → Error: 'usr' 키는 resourceMap에 존재하지 않습니다. ('user'를 의도하셨나요?)

pipeline.after('admin', 'not a function')
// → TypeError: after() 핸들러는 함수여야 합니다.
```

## 진입점 없이 직접 사용

`index.js` 진입점을 통해 임포트하면 `PipelineConstructor` 가 자동으로 주입됩니다. 직접 파일을 import하는 경우에는 수동으로 주입이 필요합니다.

```javascript
// 진입점 사용 (권장)
import { DomainState } from '@2davi/rest-domain-state-manager'
// PipelineConstructor 자동 주입됨

// 직접 사용 (테스트 환경 등)
import { DomainState }    from '../../src/domain/DomainState.js'
import { DomainPipeline } from '../../src/domain/DomainPipeline.js'
DomainState.PipelineConstructor = DomainPipeline
```
