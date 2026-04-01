# Function: buildURL()

```ts
function buildURL(normalized, requestPath?): string;
```

정규화된 URL 설정(`NormalizedUrlConfig`)과 `requestPath`를 조합하여 최종 URL 문자열을 반환한다.

`DomainState.save()` / `remove()` 및 `ApiHandler.get()` 호출마다 실행된다.

## 조합 규칙
1. `requestPath`가 프로토콜을 포함한 full URL이면 `normalized`를 무시하고 그대로 반환한다.
2. 각 파트(`protocol`, `host`, `basePath`, `requestPath`)를 배열로 만들어
   빈 값을 필터링한 뒤 `/`로 연결한다.
3. 슬래시 중복을 제거하기 위해 `protocol`은 끝 슬래시를, 나머지는 양끝 슬래시를 제거 후 연결한다.

## 슬래시 정규화 예시
```
protocol = 'http://'
host     = 'localhost:8080'
basePath = '/api'
requestPath = '/users/1'
→ 'http://localhost:8080/api/users/1'
```

## Parameters

### normalized

[`NormalizedUrlConfig`](core.url-resolver.Interface.NormalizedUrlConfig.md)

`normalizeUrlConfig()`의 반환값

### requestPath?

`string` = `''`

엔드포인트 경로 (예: `'/api/users/1'`)

## Returns

`string`

조합된 최종 요청 URL

## Throws

`host`가 비어있고 `requestPath`도 없어서 URL을 확정할 수 없는 경우

## Examples

```ts
const cfg = { protocol: 'http://', host: 'localhost:8080', basePath: '/api' };
buildURL(cfg, '/users/1'); // → 'http://localhost:8080/api/users/1'
```

```ts
buildURL(cfg, 'https://other.server.com/resource');
// → 'https://other.server.com/resource'  (normalized 무시)
```

```ts
buildURL({ protocol: 'https://', host: 'api.example.com', basePath: '/users' }, '');
// → 'https://api.example.com/users'
```

```ts
buildURL({ protocol: 'http://', host: 'localhost:8080', basePath: '/api/' }, '/users/');
// → 'http://localhost:8080/api/users'
```
