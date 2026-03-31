# 팩토리 메서드

<span class="badge badge-stable">Stable</span>

`DomainState` 인스턴스는 `new` 키워드로 직접 생성하지 않습니다. 데이터의 출처와 의도에 맞는 방법을 통해 생성합니다. 각 생성 경로는 `_isNew` 플래그를 자동으로 설정하여 이후 `save()` 의 HTTP 메서드 분기에 영향을 줍니다.

## 서버 데이터 조회 — api.get() (권장)

서버에서 데이터를 조회하고 `DomainState`를 생성하는 **권장 방법**입니다. GET 요청 전송부터 응답 파싱, `DomainState` 생성까지 한 번에 처리합니다.

```javascript
const user = await api.get('/api/users/user_001')
// GET /api/users/user_001 → 응답 JSON → DomainState (isNew: false)

console.log(user.data.name)   // 서버 응답 데이터 접근
user.data.name = '홍길동'      // 변경 추적 시작
await user.save('/api/users/user_001')  // → PUT 또는 PATCH
```

### DomainVO로 스키마 정합성 검증

`vo` 옵션을 전달하면 서버 응답 구조가 `DomainVO` 스키마와 일치하는지 자동으로 검증합니다.

```javascript
// 불일치 시 콘솔 경고 후 계속 진행 (기본값)
const user = await api.get('/api/users/1', { vo: new UserVO() })

// strict: true — 누락 필드 발견 시 즉시 Error throw
const user = await api.get('/api/users/1', { vo: new UserVO(), strict: true })
```

스키마 검증의 상세 동작은 [DomainVO 가이드](/guide/domain-vo) 를 참고하세요.

자세한 `api.get()` 옵션은 [ApiHandler 가이드](/guide/api-handler) 를 참고하세요.

---

## fromJSON — 이미 가진 JSON 문자열로 생성

`api.get()` 이 내부적으로 호출하는 저수준 메서드입니다. **직접 호출이 필요한 경우는 두 가지입니다.**

- 이미 다른 경로(axios, WebSocket, SSR 등)로 JSON 문자열을 확보한 경우
- `ApiHandler` 없이 순수하게 상태 추적 기능만 필요한 경우

```javascript
// ✓ axios 등 다른 HTTP 클라이언트로 이미 응답을 받은 경우
const { data } = await axios.get('/api/users/1')
const user = DomainState.fromJSON(JSON.stringify(data), api)

// ✓ ApiHandler 없이 로컬 상태 추적만 필요한 경우
const user = DomainState.fromJSON(JSON.stringify(localData), null)
```

::: warning api.get()이 있다면 fromJSON을 직접 호출할 필요가 없습니다

```javascript
// ✗ 불필요한 직접 호출
const text = await fetch('/api/users/1').then(r => r.text())
const user = DomainState.fromJSON(text, api)

// ✓ api.get()으로 동일한 결과
const user = await api.get('/api/users/1')
```

:::

`isNew: false` 로 설정되므로 이후 `save()` 는 PUT 또는 PATCH 로 분기됩니다.

### vo + strict 옵션

`fromJSON` 에도 동일한 스키마 검증 옵션이 있습니다.

```javascript
// 스키마 검증 + 변환기 주입 (불일치 시 경고만)
const user = DomainState.fromJSON(jsonText, api, { vo: new UserVO() })

// strict: true — 누락 필드 발견 시 Error throw
const user = DomainState.fromJSON(jsonText, api, {
    vo:     new UserVO(),
    strict: true,
})
```

스키마 검증의 상세 동작(missingKeys, extraKeys, valid 판정 기준)은 [DomainVO 가이드](/guide/domain-vo) 를 참고하세요.

---

## fromVO — 스키마 기반 신규 생성

```javascript
DomainState.fromVO(vo, handler, options?)
```

`DomainVO` 에 선언된 `fields.default` 값으로 빈 뼈대 객체를 만들어 인스턴스를 초기화합니다. `isNew: true` 로 설정되므로 이후 `save()` 는 POST 로 분기됩니다.

신규 리소스 생성 폼을 구현할 때 주로 사용합니다. 빈 필드에서 시작하지만 `DomainVO` 의 스키마 구조(타입, 기본값, 유효성 검사, 변환기)가 모두 적용됩니다.

```javascript
class UserVO extends DomainVO {
    static fields = {
        userId:  { default: '' },
        name:    { default: '', validate: v => v.trim().length > 0 },
        email:   { default: '' },
        role:    { default: 'user' },
        address: { default: { city: '', zip: '' } },
    }
}

const newUser = DomainState.fromVO(new UserVO(), api)
// isNew: true, data: { userId: '', name: '', email: '', role: 'user', address: { ... } }

newUser.data.name  = '홍길동'
newUser.data.email = 'hong@example.com'

await newUser.save('/api/users')
// → POST (isNew === true)
// 성공 후 isNew: false로 자동 전환
```

---

## fromForm — HTML 폼 양방향 바인딩

```javascript
DomainState.fromForm(formOrId, handler, options?)
```

`FormBinder` 플러그인을 설치(`DomainState.use(FormBinder)`)한 후 사용할 수 있습니다. HTML 폼 요소의 현재 값을 읽어 초기 상태를 구성하고, 이후 발생하는 사용자 입력을 Proxy에 자동으로 반영합니다. `isNew: true` 로 설정됩니다.

```javascript
import { DomainState, FormBinder } from '@2davi/rest-domain-state-manager'
DomainState.use(FormBinder)  // 앱 초기화 시 1회

// form id 또는 HTMLFormElement 직접 전달
const formState = DomainState.fromForm('userForm', api)

// 사용자가 폼 필드를 입력하면 자동으로 Proxy에 반영됩니다
await formState.save('/api/users')
// → POST
```

::: tip text input의 이벤트 최적화
`input[type=text]`, `textarea` 는 타이핑 중 과도한 Proxy 트랩 발생을 막기 위해 `blur` 시점에 동기화됩니다. `select`, `radio`, `checkbox` 는 값이 즉시 확정되므로 `change` 시점에 동기화됩니다.
:::

---

## 생성 경로 선택 기준

```text
서버에서 데이터를 조회하고 수정·저장할 때     → api.get()          (권장)
이미 JSON 문자열을 확보한 경우               → fromJSON          (저수준)
새 리소스를 생성하는 폼을 구현할 때           → fromVO
HTML 폼과 즉시 양방향 바인딩이 필요할 때      → fromForm
```

## isNew 플래그의 상태 전이

`isNew` 는 이 인스턴스의 데이터가 서버에 아직 존재하지 않음을 나타냅니다. POST 성공 후 자동으로 `false` 로 전환되므로, 생성 이후 동일한 인스턴스로 계속 수정·저장할 수 있습니다.

```text
api.get() / fromJSON 생성  → isNew: false
                                ↓ save() → PUT / PATCH

fromVO / fromForm 생성     → isNew: true
                                ↓ save() → POST 성공
                            → isNew: false (자동 전환)
                                ↓ 이후 save() → PUT / PATCH
```
