# Class: ApiHandler

`ApiHandler` 생성자에 전달하는 URL 입력 설정 객체.
상세 정의는 `url-resolver.js`의 `UrlConfig`를 참조한다.

## Constructors

### Constructor

> **new ApiHandler**(`urlConfig?`): `ApiHandler`

`ApiHandler` 인스턴스를 생성한다.

`normalizeUrlConfig(urlConfig)`를 즉시 실행하여 URL 설정을 정규화하고
`this._urlConfig`에 캐싱한다. 이후 모든 요청은 이 캐싱된 설정을 기반으로 한다.

#### Parameters

##### urlConfig?

[`UrlConfig`](handler.api-handler.Interface.UrlConfig.md) = `{}`

URL 설정 객체. `host` 또는 `baseURL` 중 하나를 포함해야 한다.

#### Returns

`ApiHandler`

#### Throws

`urlConfig`의 `protocol` 값이 유효하지 않은 경우

#### Throws

`host`와 `baseURL`이 동시에 입력되어 충돌 해소가 불가능한 경우

#### Examples

```ts
const api = new ApiHandler({ host: 'localhost:8080', debug: true });
```

```ts
const api = new ApiHandler({ host: 'api.example.com', env: 'production' });
```

```ts
const api = new ApiHandler({ baseURL: 'localhost:8080/app/api', debug: true });
```

```ts
const api = new ApiHandler({ host: 'api.example.com', protocol: 'HTTPS' });
```

## Properties

### \_debug

> **\_debug**: `boolean`

디버그 플래그. `get()`으로 생성한 `DomainState`의 `debug` 옵션에 전파된다.

***

### \_headers

> **\_headers**: `Record`\<`string`, `string`\>

모든 요청에 공통으로 주입되는 HTTP 헤더.
`_fetch()` 호출 시 `options.headers`와 병합된다.
요청별 헤더 오버라이드는 `options.headers`로 가능하다.

***

### \_urlConfig

> **\_urlConfig**: [`NormalizedUrlConfig`](handler.api-handler.Interface.NormalizedUrlConfig.md)

정규화된 URL 설정. 요청마다 `buildURL()`에 전달된다.

## Methods

### \_fetch()

> **\_fetch**(`url`, `options?`): `Promise`\<`string` \| `null`\>

`fetch()` 공통 처리 메서드. `DomainState.save()` / `remove()` 내부에서 위임 호출된다.

## 처리 내용
1. `this._headers`와 `options.headers`를 병합하여 공통 헤더를 주입한다.
2. `response.ok` 검사 → `false`이면 `HttpError` 구조체를 throw한다.
3. 응답 본문을 `response.text()`로 읽어 반환한다.
4. 응답 본문이 비어있으면 (`204 No Content` 등) `null`을 반환한다.

## 헤더 병합 우선순위
`options.headers`가 `this._headers`보다 우선 적용된다. (스프레드 오버라이드)
```
{ ...this._headers, ...options.headers }
```

#### Parameters

##### url

`string`

`buildURL()`이 반환한 완성된 요청 URL

##### options?

`RequestInit` = `{}`

`fetch()` 두 번째 인자와 동일. `method`, `body`, `headers` 포함.

#### Returns

`Promise`\<`string` \| `null`\>

응답 본문 텍스트. 빈 응답이면 `null`.

#### Throws

`response.ok === false`인 경우 (`{ status, statusText, body }`)

#### Examples

```ts
await this._handler._fetch(url, {
    method: 'POST',
    body:   JSON.stringify({ name: 'Davi' }),
});
```

```ts
await this._handler._fetch(url, {
    method: 'PATCH',
    body:   JSON.stringify([{ op: 'replace', path: '/name', value: 'Davi' }]),
});
```

```ts
await this._handler._fetch(url, { method: 'DELETE' });
// 204 No Content → null 반환
```

***

### get()

> **get**(`requestPath`, `options?`): `Promise`\<[`DomainState`](model.DomainState.Class.DomainState.md)\>

HTTP GET 요청을 전송하고 응답을 `DomainState`로 변환하여 반환한다.

## 내부 처리 흐름
```
requestPath + urlConfig
  ↓ buildURL()
최종 URL
  ↓ this._fetch(url, { method: 'GET' })
응답 텍스트 (JSON 문자열)
  ↓ DomainState.fromJSON(text, this, { urlConfig, debug })
DomainState (isNew: false)
```

반환된 `DomainState`는 `isNew: false`이므로 `save()` 시 PATCH 또는 PUT을 전송한다.
`debug: true`이면 반환된 `DomainState`도 디버그 채널에 연결된다.

#### Parameters

##### requestPath

`string`

엔드포인트 경로 (예: `'/api/users/user_001'`)

##### options?

[`GetOptions`](handler.api-handler.Interface.GetOptions.md) = `{}`

요청별 추가 옵션

#### Returns

`Promise`\<[`DomainState`](model.DomainState.Class.DomainState.md)\>

응답 데이터를 담은 `DomainState` 인스턴스 (`isNew: false`)

#### Throws

서버가 `response.ok === false` 응답을 반환한 경우

#### Throws

응답 본문이 유효하지 않은 JSON인 경우 (`DomainState.fromJSON` 내부)

#### Examples

```ts
const user = await api.get('/api/users/user_001');
console.log(user.data.name); // GET 응답 데이터 읽기
user.data.name = 'Davi';     // changeLog에 replace 기록
await user.save('/api/users/user_001'); // PATCH 전송
```

```ts
const user = await api.get('/api/users/1', {
    urlConfig: { host: 'staging.example.com' },
});
```

```ts
try {
    const user = await api.get('/api/users/INVALID_ID');
} catch (err) {
    if (err.status === 404) console.error('사용자를 찾을 수 없습니다.');
}
```

***

### getUrlConfig()

> **getUrlConfig**(): [`NormalizedUrlConfig`](handler.api-handler.Interface.NormalizedUrlConfig.md)

이 `ApiHandler` 인스턴스의 정규화된 URL 설정을 반환한다.

`DomainState._resolveURL()`에서 `requestPath`와 조합할 때 참조한다.
인스턴스 생성 시 `normalizeUrlConfig()`가 반환한 값을 그대로 반환한다.

#### Returns

[`NormalizedUrlConfig`](handler.api-handler.Interface.NormalizedUrlConfig.md)

`{ protocol, host, basePath }` 정규화된 URL 설정

#### Example

```ts
// DomainState 내부:
_resolveURL(requestPath) {
    const config = this._urlConfig ?? this._handler?.getUrlConfig() ?? {};
    return buildURL(config, requestPath ?? '');
}
```

***

### isDebug()

> **isDebug**(): `boolean`

이 `ApiHandler` 인스턴스의 디버그 플래그를 반환한다.

`get()`으로 생성한 `DomainState.fromJSON()`에 `debug` 옵션으로 전달되어
반환된 `DomainState`의 디버그 채널 연결 여부를 결정한다.

#### Returns

`boolean`

디버그 모드 활성화 여부

#### Example

```ts
const api = new ApiHandler({ host: 'localhost:8080', debug: true });
api.isDebug(); // → true

const user = await api.get('/api/users/1');
user._debug; // → true (ApiHandler의 debug 플래그가 전파됨)
```
