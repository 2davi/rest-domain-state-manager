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

[`ProxyWrapper`](core.api-mapper.Interface.ProxyWrapper.md)

`createProxy()`의 반환값 (도개교 세트)

##### options?

[`DomainStateOptions`](domain.DomainState.Interface.DomainStateOptions.md) = `{}`

메타데이터 및 설정 옵션

#### Returns

`DomainState`

## Properties

### \_clearChangeLog

> **\_clearChangeLog**: () => `void`

#### Returns

`void`

***

### \_clearDirtyFields

> **\_clearDirtyFields**: () => `void`

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

> **\_getChangeLog**: () => [`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

#### Returns

[`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

***

### \_getDirtyFields

> **\_getDirtyFields**: () => `Set`\<`string`\>

#### Returns

`Set`\<`string`\>

***

### \_getTarget

> **\_getTarget**: () => `object`

#### Returns

`object`

***

### \_handler

> **\_handler**: [`ApiHandler`](network.api-handler.Class.ApiHandler.md) \| `null`

***

### \_isNew

> **\_isNew**: `boolean`

***

### \_label

> **\_label**: `string`

***

### \_pendingFlush

> **\_pendingFlush**: `boolean`

***

### \_proxy

> **\_proxy**: `object`

***

### \_restoreChangeLog

> **\_restoreChangeLog**: (`entries`) => `void`

#### Parameters

##### entries

[`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

#### Returns

`void`

***

### \_restoreDirtyFields

> **\_restoreDirtyFields**: (`fields`) => `void`

#### Parameters

##### fields

`Set`\<`string`\>

#### Returns

`void`

***

### \_restoreTarget

> **\_restoreTarget**: (`data`) => `void`

#### Parameters

##### data

`object`

#### Returns

`void`

***

### \_transformers

> **\_transformers**: [`TransformerMap`](domain.DomainState.TypeAlias.TransformerMap.md)

***

### \_urlConfig

> **\_urlConfig**: [`NormalizedUrlConfig`](domain.DomainState.Interface.NormalizedUrlConfig.md) \| `null`

***

### \_validators

> **\_validators**: [`ValidatorMap`](domain.DomainState.TypeAlias.ValidatorMap.md)

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

> **\_assertHandler**(`method`): [`ApiHandler`](network.api-handler.Class.ApiHandler.md)

`handler`가 주입되어 있는지 검사하고, 없으면 `Error`를 throw한다.

#### Parameters

##### method

`string`

호출한 메서드명 (에러 메시지 생성용)

#### Returns

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

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

### \_buildSnapshot()

> **\_buildSnapshot**(`currentData`, `prevSnapshot`): `object`

Structural Sharing 기반 불변 스냅샷을 빌드한다.

## 알고리즘 (depth-1 Structural Sharing)
`dirtyFields`(변경된 최상위 키 집합)를 기준으로 스냅샷을 구성한다.

| 조건                              | 처리 방식                              |
|-----------------------------------|----------------------------------------|
| `prevSnapshot !== null` + dirty 없음 | `prevSnapshot` 그대로 반환 (캐시 히트) |
| dirty 있음 / 최초 생성            | 변경 키: 얕은 복사 / 나머지: 참조 재사용 |

배열: `[...val]`, plain Object: `{ ...val }`, Primitive: 값 그대로.
`Date` / `Map` / `Set`은 참조를 그대로 공유한다.
현 VO 레이어에서 이들 타입이 실질적으로 사용되지 않으므로 단순화하였다.

#### Parameters

##### currentData

`object`

`_getTarget()`으로 얻은 원본 객체

##### prevSnapshot

`object` \| `null`

이전 스냅샷. 최초 호출 시 `null`.

#### Returns

`object`

새로 조립된 스냅샷 객체 (freeze 이전 단계)

***

### \_notifyListeners()

> **\_notifyListeners**(): `void`

`#listeners`에 등록된 모든 리스너를 동기적으로 호출한다.

개별 리스너 에러를 격리하여 한 리스너의 실패가 나머지 실행을 막지 않는다.

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

### \_rollback()

> **\_rollback**(`snapshot`): `void`

`save()` 실패 시 도메인 상태를 save() 진입 이전 스냅샷으로 복원한다.

## 복원 대상 4가지

| 대상              | 복원 이유                                                    |
|------------------|--------------------------------------------------------------|
| `domainObject`   | Proxy target이 이미 변경된 상태. 서버와 불일치 제거.         |
| `changeLog`      | save() 재시도 시 올바른 PATCH payload 재생성 보장.           |
| `dirtyFields`    | save() 재시도 시 올바른 PUT/PATCH 분기 판단 보장.            |
| `this._isNew`    | POST 실패 후 isNew 플래그 일관성 유지.                       |

## Proxy 우회
`restoreTarget()`은 Proxy가 아닌 원본 `domainObject`에 직접 접근하므로
복원 작업 자체가 `changeLog`나 `dirtyFields`에 기록되지 않는다.

## 디버그 채널 전파
`debug: true`이면 롤백 완료 후 `_broadcast()`를 호출하여
디버그 패널이 롤백된 상태를 즉시 반영하도록 한다.

#### Parameters

##### snapshot

`save()` 진입 직전에 확보한 상태 스냅샷

###### changeLog

[`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

###### data

`object`

###### dirtyFields

`Set`\<`string`\>

###### isNew

`boolean`

#### Returns

`void`

***

### \_scheduleFlush()

> **\_scheduleFlush**(): `void`

동일 동기 블록 내 다중 상태 변경을 단일 flush로 병합하는 마이크로태스크 배칭 스케줄러.

## 동작 원리
`_pendingFlush`가 `false`일 때만 `queueMicrotask()`로 flush를 예약한다.
동일 동기 블록의 추가 변경은 플래그 체크에서 차단되어 중복 예약 없이 건너뛴다.
Call Stack이 비워지면 Microtask Queue가 실행되어 flush가 정확히 한 번 실행된다.

## flush 실행 순서
```
1. pendingFlush = false          (다음 flush 예약 허용)
2. _buildSnapshot()              (Structural Sharing 기반 스냅샷 재빌드)
3. #shadowCache 갱신             (새 참조일 때만)
4. _notifyListeners()            (React / 외부 구독자 알림)
5. if (debug) _broadcast()       (디버그 채널 전파)
```

## 배칭에서 제외되는 두 호출
- `constructor` 초기 스냅샷 빌드 : 인스턴스 생성 시 `_buildSnapshot()` 직접 호출.
- `save()` 완료 후 `_broadcast()` : 서버 동기화 완료. `onMutate` 경로 미경유.

#### Returns

`void`

***

### getSnapshot()

> **getSnapshot**(): `object`

가장 최근에 생성된 불변 스냅샷을 반환한다.

## `useSyncExternalStore` 규약 준수
- **변경이 없으면 반드시 이전과 동일한 참조를 반환한다.**
  매번 새 객체를 반환하면 React가 무한 리렌더링 루프에 빠진다.
- **반환값은 동결된 불변 객체다.**
  개발 환경에서만 `deepFreeze` 적용, 프로덕션에서는 no-op.

## Vanilla JS / Vue 환경
React 없이도 사용 가능하다.
Proxy가 아닌 순수 불변 객체가 필요할 때 이 메서드를 직접 호출한다.

#### Returns

`object`

현재 상태의 불변 스냅샷. 변경 시 새 참조 반환.

#### Example

```ts
const snap1 = state.getSnapshot();
state.data.name = 'Davi';
await Promise.resolve(); // microtask flush 대기
const snap2 = state.getSnapshot();
console.log(snap1 === snap2);           // false — 새 참조
console.log(snap1.email === snap2.email); // true  — 미변경 키 Structural Sharing
```

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

### restore()

> **restore**(): `boolean`

인메모리 도메인 상태를 `save()` 진입 이전 스냅샷으로 복원한다.

`DomainPipeline`의 보상 트랜잭션(Compensating Transaction)에서
파이프라인이 자동으로 호출한다. 소비자가 직접 호출할 수도 있다.

## 복원 대상 (4가지)
`save()` 진입 직전 캡처된 `#snapshot`의 네 가지 상태를 복원한다.
- `domainObject` (원본 데이터)
- `changeLog` (변경 이력)
- `dirtyFields` (변경된 필드 집합)
- `isNew` 플래그

## 멱등성 보장
`#snapshot`이 `undefined`이면 경고 로그 후 `false`를 반환한다.
동일 인스턴스에 여러 번 호출해도 에러 없이 동일 결과를 낸다.

## 책임 범위
이 메서드는 **프론트엔드 인메모리 상태만 복원**한다.
서버에 이미 커밋된 상태를 되돌리는 것은 라이브러리 책임 범위 밖이며,
소비자가 `dsm:rollback` 이벤트를 구독하여 서버 롤백 API를 직접 호출해야 한다.

## `dsm:rollback` 이벤트
복원 완료 후 브라우저 환경에서 `CustomEvent('dsm:rollback')`를 발행한다.
소비자 앱이 이 이벤트를 구독하여 사용자 알림을 표시할 수 있다.

#### Returns

`boolean`

복원 성공 시 `true`, 스냅샷 없어 no-op 시 `false`

#### Examples

```ts
const result = await DomainState.all({ a: ..., b: ..., c: ... }, {
    failurePolicy: 'rollback-all',
}).after('a', s => s.save('/api/a'))
  .after('b', s => s.save('/api/b'))
  .after('c', s => s.save('/api/c'))
  .run();
```

```ts
try {
    await userState.save('/api/users/1');
    await profileState.save('/api/profiles/1');
} catch (err) {
    userState.restore();  // 인메모리 상태 복원
    // 서버 롤백은 소비자 책임: DELETE /api/users/1 등
}
```

```ts
window.addEventListener('dsm:rollback', (e) => {
    console.warn(`[UI] ${e.detail.label} 상태가 복원되었습니다.`);
    showErrorNotification('저장에 실패하여 이전 상태로 복원되었습니다.');
});
```

***

### save()

> **save**(`requestPath?`): `Promise`\<`void`\>

도메인 상태를 서버(DB)와 동기화한다.

## HTTP 메서드 분기 전략 (Dirty Checking 기반)

```
isNew === true
    → POST  (toPayload — 전체 객체 직렬화)

isNew === false
    dirtyRatio = dirtyFields.size / Object.keys(target).length

    dirtyFields.size === 0           → PUT   (변경 없는 의도적 재저장)
    dirtyRatio >= DIRTY_THRESHOLD    → PUT   (변경 비율 70% 이상 — 전체 교체가 효율적)
    dirtyRatio <  DIRTY_THRESHOLD    → PATCH (변경 부분만 RFC 6902 Patch 배열로 전송)
```

## Optimistic Update 롤백
`save()` 진입 직전 `structuredClone()`으로 현재 상태의 깊은 복사 스냅샷을 생성한다.
HTTP 요청이 실패(`4xx` / `5xx` / 네트워크 오류)하면 `_rollback(snapshot)`을 호출하여
`domainObject`, `changeLog`, `dirtyFields`, `_isNew` 4개 상태를 일관되게 복원한다.
복원 후 에러를 반드시 re-throw하여 호출자가 처리할 수 있게 한다.

## structuredClone 전제
스냅샷은 `structuredClone()`을 사용하므로 `domainObject` 내부에
함수, DOM 노드, Symbol 등 구조화된 복제가 불가능한 값이 있으면 throw된다.
REST API JSON 응답 데이터(문자열, 숫자, 배열, 플레인 객체)만 담는
일반적인 DTO에서는 문제가 발생하지 않는다.

## 동기화 성공 후 처리
- PUT / PATCH 성공 → `clearChangeLog()` + `clearDirtyFields()` 동시 초기화
- POST 성공        → `isNew = false` 전환 후 동일하게 초기화
- `debug: true`    → `_broadcast()` 호출

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
try {
    await user.save('/api/users/1');
} catch (err) {
    // err: { status: 409, statusText: 'Conflict', body: '...' }
    // 이 시점에 user.data는 save() 호출 이전 상태로 자동 복원되어 있다.
    console.error('저장 실패, 상태 롤백 완료:', err.status);
}
```

```ts
for (let attempt = 0; attempt < 3; attempt++) {
    try {
        await user.save('/api/users/1');
        break;
    } catch (err) {
        if (attempt === 2) throw err; // 3회 실패 시 상위로 전파
        // 롤백된 상태 그대로 재시도 가능
    }
}
```

***

### subscribe()

> **subscribe**(`listener`): () => `void`

상태 변경 시 호출될 리스너를 등록한다.

`useSyncExternalStore`의 `subscribe` 인자로 직접 전달할 수 있다.
Proxy 변경 → microtask 배치 완료 → `_buildSnapshot()` 직후 리스너가 호출된다.

#### Parameters

##### listener

() => `void`

상태 변경 시 호출될 콜백. 인자를 받지 않는다.

#### Returns

구독 해제 함수. `useSyncExternalStore`에 전달하는 cleanup.

() => `void`

#### Examples

```ts
const data = useSyncExternalStore(
    (cb) => state.subscribe(cb),
    ()   => state.getSnapshot()
);
```

```ts
// import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
const data = useDomainState(state);
```

***

### all()

> `static` **all**(`resourceMap`, `options?`): `object`

여러 `DomainState`를 병렬로 fetch하고, 후처리 핸들러를 순서대로 체이닝하는
`DomainPipeline` 인스턴스를 반환한다.

내부적으로 `_pipelineFactory`(모듈 클로저 변수)를 호출한다.
`DomainState.configure()`를 통해 팩토리가 주입되지 않으면 즉시 `Error`를 throw한다.

#### Parameters

##### resourceMap

[`ResourceMap`](domain.DomainState.TypeAlias.ResourceMap.md)

키: 리소스 식별자, 값: `Promise<DomainState>`

##### options?

[`PipelineOptions`](domain.DomainState.Interface.PipelineOptions.md) = `{}`

파이프라인 실행 옵션

#### Returns

`object`

체이닝 가능한 DomainPipeline 인스턴스. after() / run() 메서드를 제공한다.

#### Throws

`configure()`가 호출되지 않은 경우

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

### configure()

> `static` **configure**(`config?`): *typeof* `DomainState`

라이브러리 의존성 및 전역 동작을 설정하는 메서드.

`DomainState`와 `DomainPipeline`의 순환 참조를 제거하기 위해,
`DomainPipeline` 생성자를 직접 import하지 않고 팩토리 함수로 주입받는다.

**`pipelineFactory`는 직접 호출 불필요.** 라이브러리 진입점(`index.js`)이
모듈 평가 시점에 자동으로 주입한다.

Vitest 환경에서는 `configure({ pipelineFactory: vi.fn() })`으로 DomainPipeline을
로드하지 않고도 DomainState 단독 테스트가 가능하다.

#### Parameters

##### config?

configure()의 config 파라미터

###### pipelineFactory?

(...`args`) => `object`

`(resourceMap, options) => DomainPipeline` 형태의 팩토리 함수.
  `DomainState.all()` 호출 전에 반드시 주입되어야 한다.

###### silent?

`boolean`

`true`이면 라이브러리 내부의 모든 `console` 출력을 억제한다.
  통합 테스트 또는 콘솔 오염을 막아야 하는 운영 환경에서 사용한다.

#### Returns

*typeof* `DomainState`

체이닝용 `DomainState` 클래스 반환

#### Throws

`pipelineFactory`가 전달됐지만 함수가 아닐 때

#### Examples

```ts
DomainState.configure({
    pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options)
});
```

```ts
DomainState.configure({ pipelineFactory: vi.fn(() => ({ run: vi.fn() })) });
```

```ts
DomainState.configure({ silent: true });
```

```ts
DomainState.configure({ pipelineFactory: factory, silent: true }).use(FormBinder);
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

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

##### options?

[`FromJsonOptions`](domain.DomainState.Interface.FromJsonOptions.md) = `{}`

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

[`DomainVO`](domain.DomainVO.Class.DomainVO.md)

기본값 / 검증 / 변환 규칙을 선언한 `DomainVO` 인스턴스

##### handler

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

##### options?

[`FromVoOptions`](domain.DomainState.Interface.FromVoOptions.md) = `{}`

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

[`DsmPlugin`](domain.DomainState.Interface.DsmPlugin.md)

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
