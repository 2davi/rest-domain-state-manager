# Class: DomainState

`createProxy()`가 반환하는 도개교 세트.
외부에서는 `proxy`만 접근하고, 나머지는 `DomainState` 내부에서만 사용한다.

## Constructors

### Constructor

> **new DomainState**(`proxyWrapper`, `options?`): `DomainState`

`DomainState` 인스턴스를 생성한다.

**직접 호출 금지.** `fromJSON()` / `fromVO()` 팩토리 메서드를 사용한다.
`FormBinder` 플러그인 설치 후 `fromForm()`도 사용 가능하다.

생성 직후 `debug: true`이면 디버그 채널로 초기 상태를 broadcast한다.

#### Parameters

##### proxyWrapper

[`ProxyWrapper`](model.DomainState.Interface.ProxyWrapper.md)

`createProxy()`의 반환값 (도개교 세트)

##### options?

[`DomainStateOptions`](model.DomainState.Interface.DomainStateOptions.md) = `{}`

메타데이터 및 설정 옵션

#### Returns

`DomainState`

## Properties

### \_clearChangeLog

> **\_clearChangeLog**: () => `void`

#### Returns

`void`

***

### \_debug

> **\_debug**: `boolean`

***

### \_errors

> **\_errors**: `any`[]

***

### \_getChangeLog

> **\_getChangeLog**: () => `ChangeLogEntry`[]

#### Returns

`ChangeLogEntry`[]

***

### \_getTarget

> **\_getTarget**: () => `object`

#### Returns

`object`

***

### \_handler

> **\_handler**: [`ApiHandler`](handler.api-handler.Class.ApiHandler.md) \| `null`

***

### \_isNew

> **\_isNew**: `boolean`

***

### \_label

> **\_label**: `string`

***

### \_proxy

> **\_proxy**: `object`

***

### \_transformers

> **\_transformers**: [`TransformerMap`](model.DomainState.TypeAlias.TransformerMap.md)

***

### \_urlConfig

> **\_urlConfig**: [`NormalizedUrlConfig`](model.DomainState.Interface.NormalizedUrlConfig.md) \| `null`

***

### \_validators

> **\_validators**: [`ValidatorMap`](model.DomainState.TypeAlias.ValidatorMap.md)

***

### PipelineConstructor

> `static` **PipelineConstructor**: *typeof* [`DomainPipeline`](model.DomainPipeline.Class.DomainPipeline.md) \| `null` = `null`

`DomainPipeline` 클래스 생성자.
진입점(`rest-domain-state-manager.js`)에서 주입된다.

`DomainState`와 `DomainPipeline`의 상호 참조를 피하기 위해
직접 import 대신 생성자 주입(Constructor Injection) 패턴을 사용한다.

## Accessors

### data

#### Get Signature

> **get** **data**(): `object`

변경 추적이 활성화된 Proxy 객체.

외부 개발자가 도메인 데이터에 접근하고 수정하는 **유일한 공개 진입점**이다.
이 Proxy를 통한 모든 필드 읽기/쓰기/삭제는 `changeLog`에 자동으로 기록된다.

##### Example

```ts
const user = await api.get('/api/users/1');
console.log(user.data.name);        // 읽기
user.data.name = 'Davi';            // 쓰기 → changeLog: [{ op: 'replace', path: '/name', ... }]
user.data.address.city = 'Seoul';   // 중첩 쓰기 → path: '/address/city'
delete user.data.phone;             // 삭제 → op: 'remove'
```

##### Returns

`object`

## Methods

### \_assertHandler()

> **\_assertHandler**(`method`): [`ApiHandler`](handler.api-handler.Class.ApiHandler.md)

`handler`가 주입되어 있는지 검사하고, 없으면 `Error`를 throw한다.

#### Parameters

##### method

`string`

호출한 메서드명 (에러 메시지 생성용)

#### Returns

[`ApiHandler`](handler.api-handler.Class.ApiHandler.md)

- 안전한 핸들러 반환!

***

### \_broadcast()

> **\_broadcast**(): `void`

현재 `DomainState`의 스냅샷을 디버그 `BroadcastChannel`에 전파한다.

디버그 팝업이 열려있는 모든 탭이 이 메시지를 수신하여
`data` / `changeLog` / `isNew` / `errors`를 실시간으로 갱신한다.

`debug: false`이면 호출해도 `broadcastUpdate`가 채널을 초기화하지 않으므로
실질적으로 아무 동작도 하지 않는다.

#### Returns

`void`

***

### \_resolveURL()

> **\_resolveURL**(`requestPath`): `string`

`_urlConfig`와 `requestPath`를 조합하여 최종 요청 URL을 생성한다.

## URL 결정 우선순위
1. `this._urlConfig` 사용
2. `this._urlConfig`가 없으면 `handler.getUrlConfig()` 폴백
3. 둘 다 없으면 빈 객체 `{}` → `buildURL` 내부에서 `Error` throw

#### Parameters

##### requestPath

`string` \| `undefined`

`save()` / `remove()`에서 전달된 경로

#### Returns

`string`

최종 완성된 요청 URL

#### Throws

URL을 확정할 수 없는 경우 (`buildURL` 내부에서 throw)

***

### log()

> **log**(): `void`

현재 `changeLog`를 콘솔 테이블로 출력한다.

`debug: false`이면 아무 동작도 하지 않는다.
변경 이력이 없으면 `'(변경 이력 없음)'`을 출력한다.

#### Returns

`void`

#### Example

```ts
const user = await api.get('/api/users/1', { debug: true });
user.data.name = 'Davi';
user.log(); // 콘솔 테이블에 changeLog 출력
```

***

### openDebugger()

> **openDebugger**(): `void`

디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.

`debug: false`이면 아무 동작도 하지 않는다.
브라우저 팝업 차단이 활성화된 경우 콘솔 경고를 출력한다.

#### Returns

`void`

#### Example

```ts
const user = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'UserVO' });
user.openDebugger();
```

***

### remove()

> **remove**(`requestPath?`): `Promise`\<`void`\>

해당 리소스를 서버에서 삭제한다. (HTTP DELETE)

응답 본문은 사용하지 않는다. 성공/실패는 `response.ok`로만 판단한다.

#### Parameters

##### requestPath?

`string`

엔드포인트 경로. 미입력 시 `urlConfig` 사용.

#### Returns

`Promise`\<`void`\>

#### Throws

`handler`가 주입되지 않은 경우

#### Throws

HTTP 에러

#### Example

```ts
await user.remove('/api/users/user_001');
```

***

### save()

> **save**(`requestPath?`): `Promise`\<`void`\>

도메인 상태를 서버(DB)와 동기화한다.

## HTTP 메서드 분기 전략 (A+C 혼합)

```
isNew === true
    → POST  (toPayload — 전체 객체 직렬화)

isNew === false
    changeLog.length > 0  → PATCH (toPatch — RFC 6902 JSON Patch 배열)
    changeLog.length === 0 → PUT  (toPayload — 전체 객체 직렬화)
```

## 동기화 성공 후 처리
- PATCH / PUT 성공 → `clearChangeLog()` 호출
- POST 성공 → `isNew = false` 전환 후 `clearChangeLog()` 호출
- `debug: true` → `_broadcast()` 호출

## `requestPath` 결정 순서
1. `requestPath` 인자 명시 → 그대로 사용
2. 없음 → `this._urlConfig` 또는 `handler.getUrlConfig()` 사용
3. 둘 다 없음 → `buildURL` 내부에서 `Error` throw

#### Parameters

##### requestPath?

`string`

엔드포인트 경로 (예: `'/api/users/1'`). `urlConfig`와 조합된다.

#### Returns

`Promise`\<`void`\>

#### Throws

`handler`가 주입되지 않은 경우 (`_assertHandler`)

#### Throws

URL을 확정할 수 없는 경우 (`buildURL`)

#### Throws

HTTP 에러 (서버가 `4xx` / `5xx` 반환 시)

#### Examples

```ts
await user.save('/api/users/user_001');
```

```ts
const newUser = DomainState.fromVO(new UserVO(), api); // UserVO.baseURL 자동 사용
await newUser.save(); // → POST to UserVO.baseURL
```

```ts
try {
    await user.save('/api/users/1');
} catch (err) {
    if (err.status === 409) console.error('충돌 발생:', err.body);
}
```

***

### all()

> `static` **all**(`resourceMap`, `options?`): [`DomainPipeline`](model.DomainPipeline.Class.DomainPipeline.md)

여러 `DomainState`를 병렬로 fetch하고, 후처리 핸들러를 순서대로 체이닝하는
`DomainPipeline` 인스턴스를 반환한다.

내부적으로 `DomainState.PipelineConstructor`를 통해 `DomainPipeline`을 생성한다.
`rest-domain-state-manager.js` 진입점을 통해 `PipelineConstructor`가 주입되지 않으면
즉시 `Error`를 throw한다.

#### Parameters

##### resourceMap

[`ResourceMap`](model.DomainState.TypeAlias.ResourceMap.md)

키: 리소스 식별자, 값: `Promise<DomainState>`

##### options?

[`PipelineOptions`](model.DomainState.Interface.PipelineOptions.md) = `{}`

파이프라인 실행 옵션

#### Returns

[`DomainPipeline`](model.DomainPipeline.Class.DomainPipeline.md)

체이닝 가능한 파이프라인 인스턴스

#### Throws

`PipelineConstructor`가 주입되지 않은 경우

#### Example

```ts
const result = await DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/1'),
}, { strict: false })
.after('roles', async roles => { roles.renderTo('#roleDiv', { type: 'select', ... }); })
.after('user',  async user  => { user.bindForm('#userForm'); })
.run();

if (result._errors?.length) console.warn(result._errors);
```

***

### fromJSON()

> `static` **fromJSON**(`jsonText`, `handler`, `options?`): `DomainState`

REST API GET 응답 JSON 문자열로부터 `DomainState`를 생성한다. (`isNew: false`)

주로 `ApiHandler.get()` 내부에서 호출된다.
직접 호출 시 이미 가진 JSON 문자열을 `DomainState`로 변환할 때 사용한다.

## 처리 흐름
1. `toDomain(jsonText, onMutate)`로 JSON 파싱 및 Proxy 생성.
2. `DomainState` 인스턴스 생성 (`isNew: false`).
3. `options.vo`가 주어진 경우: 스키마 검증 후 `validators` / `transformers` 주입.

## `onMutate` 콜백 클로저 패턴
`state` 변수를 `null`로 먼저 선언한 뒤 `createProxy`의 `onMutate`에서 참조한다.
이렇게 하면 `DomainState` 생성 전에 Proxy가 먼저 만들어지는 순서 문제를
클로저를 통해 자연스럽게 해소할 수 있다.

#### Parameters

##### jsonText

`string`

`response.text()`로 읽은 JSON 문자열

##### handler

[`ApiHandler`](handler.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

##### options?

[`FromJsonOptions`](model.DomainState.Interface.FromJsonOptions.md) = `{}`

추가 옵션

#### Returns

`DomainState`

`isNew: false`인 새 `DomainState` 인스턴스

#### Throws

`jsonText`가 유효하지 않은 JSON일 때

#### Examples

```ts
const user = await api.get('/api/users/1');
user.data.name = 'Davi'; // → changeLog에 replace 기록
await user.save('/api/users/1'); // → PATCH 전송
```

```ts
const user = DomainState.fromJSON(jsonText, api, { vo: new UserVO(), debug: true });
```

```ts
const user = DomainState.fromJSON(jsonText, api);
user.bindForm('userForm'); // FormBinder.bindForm() 호출
```

***

### fromVO()

> `static` **fromVO**(`vo`, `handler`, `options?`): `DomainState`

`DomainVO` 인스턴스로부터 기본값 골격 `DomainState`를 생성한다. (`isNew: true`)

`DomainVO.toSkeleton()`으로 기본값 객체를 생성하고 Proxy로 감싼다.
`validators` / `transformers`가 자동으로 주입되며, `save()` 시 POST를 전송한다.

## `urlConfig` 결정 순서
1. `options.urlConfig` 명시 → 그대로 사용
2. `options.urlConfig` 없음 + `vo.getBaseURL()` 있음 → `normalizeUrlConfig({ baseURL })` 적용
3. 둘 다 없음 → `null` (save() 시 `handler.getUrlConfig()` 폴백)

#### Parameters

##### vo

[`DomainVO`](model.DomainVO.Class.DomainVO.md)

기본값 / 검증 / 변환 규칙을 선언한 `DomainVO` 인스턴스

##### handler

[`ApiHandler`](handler.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

##### options?

[`FromVoOptions`](model.DomainState.Interface.FromVoOptions.md) = `{}`

추가 옵션

#### Returns

`DomainState`

`isNew: true`인 새 `DomainState` 인스턴스

#### Throws

`vo`가 `DomainVO` 인스턴스가 아닐 때

#### Examples

```ts
class UserVO extends DomainVO {
    static baseURL = 'localhost:8080/api/users';
    static fields  = {
        userId: { default: '' },
        name:   { default: '', validate: v => v.trim().length > 0 },
    };
}
const newUser = DomainState.fromVO(new UserVO(), api, { debug: true });
newUser.data.userId = 'user_' + Date.now();
newUser.data.name   = 'Davi';
await newUser.save(); // → POST to static baseURL
```

```ts
const newUser = DomainState.fromVO(new UserVO(), api, {
    urlConfig: { host: 'staging.server.com', basePath: '/api' },
});
```

***

### use()

> `static` **use**(`plugin`): *typeof* `DomainState`

플러그인을 `DomainState`에 등록한다.

`plugin.install(DomainState)`를 호출하여 `prototype` 또는 정적 멤버를 확장한다.
동일한 플러그인 객체(참조 기준)를 여러 번 `use()`해도 `install()`은 1회만 실행된다.
`use()` 자체가 `DomainState` 클래스를 반환하므로 체이닝이 가능하다.

#### Parameters

##### plugin

[`DsmPlugin`](model.DomainState.Interface.DsmPlugin.md)

`{ install(DomainState): void }` 계약을 가진 플러그인 객체

#### Returns

*typeof* `DomainState`

체이닝용 `DomainState` 클래스 반환

#### Throws

`plugin.install`이 함수가 아닐 때

#### Examples

```ts
DomainState.use(DomainRenderer).use(FormBinder);
```

```ts
const CsvPlugin = {
    install(DomainStateClass) {
        DomainStateClass.prototype.toCSV = function () {
            return Object.values(this._getTarget()).join(',');
        };
    }
};
DomainState.use(CsvPlugin);
```
