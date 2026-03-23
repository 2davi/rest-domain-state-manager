# 팩토리 메서드

<span class="badge badge-stable">Stable</span>

`DomainState` 인스턴스는 `new` 키워드로 직접 생성하지 않습니다. 데이터의 출처와 의도에 맞는 세 가지 팩토리 메서드를 통해 생성합니다. 각 팩토리는 `_isNew` 플래그를 자동으로 설정하여 이후 `save()` 의 HTTP 메서드 분기에 영향을 줍니다.

## fromJSON — 서버 응답 데이터 바인딩

```javascript
DomainState.fromJSON(jsonText, handler, options?)
```

서버에서 GET으로 받아온 JSON 문자열을 기반으로 인스턴스를 생성합니다. `isNew: false` 로 설정되므로 이후 `save()` 는 PUT 또는 PATCH 로 분기됩니다.

`api.get()` 이 내부적으로 이 메서드를 호출합니다. 직접 호출이 필요한 경우는 이미 JSON 문자열을 보유하고 있거나, `api` 없이 순수하게 상태 추적만 필요한 경우입니다.

```javascript
// api.get()이 내부적으로 동일한 동작을 수행합니다
const jsonText = await fetch('/api/users/1').then(r => r.text())
const user     = DomainState.fromJSON(jsonText, api)

// DomainVO와 함께 사용하면 스키마 검증 + 변환기 주입
const user = DomainState.fromJSON(jsonText, api, {
    vo:    new UserVO(),      // 스키마 검증 및 기본값/변환기 주입
    label: 'User Data',       // 디버그 팝업용 레이블
    debug: true,              // BroadcastChannel 디버그 활성화
})
```

## fromVO — 스키마 기반 신규 생성

```javascript
DomainState.fromVO(vo, handler, options?)
```

`DomainVO` 에 선언된 `fields.default` 값으로 빈 뼈대 객체를 만들어 인스턴스를 초기화합니다. `isNew: true` 로 설정되므로 이후 `save()` 는 POST로 분기됩니다.

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

## 팩토리 메서드 선택 기준

```text
서버에서 조회한 데이터를 수정하고 저장할 때  → fromJSON (또는 api.get)
새 리소스를 생성하는 폼을 구현할 때          → fromVO
HTML 폼과 즉시 양방향 바인딩이 필요할 때      → fromForm
```

## isNew 플래그의 상태 전이

`isNew` 는 이 인스턴스의 데이터가 서버에 아직 존재하지 않음을 나타냅니다. POST 성공 후 자동으로 `false` 로 전환되므로, 생성 이후 동일한 인스턴스로 계속 수정·저장할 수 있습니다.

```text
fromVO / fromForm 생성    → isNew: true
                              ↓ save() → POST 성공
                          → isNew: false (자동 전환)
                              ↓ 이후 save() → PUT / PATCH
```
