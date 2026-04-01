# Function: normalizeUrlConfig()

```ts
function normalizeUrlConfig(config?): NormalizedUrlConfig;
```

URL 입력 설정 객체(`UrlConfig`)를 받아 정규화된 내부 형태(`NormalizedUrlConfig`)로 변환한다.

`ApiHandler` 생성자에서 1회 호출되어 인스턴스에 캐싱된다.
이후 요청마다 `buildURL()`에 전달되어 최종 URL을 조합한다.

## host + baseURL 동시 입력 충돌 해소

| 케이스 | 조건                            | 처리                                   |
|--------|--------------------------------|----------------------------------------|
| A      | `baseURL`이 `host`로 시작       | `basePath`로 해석 + 콘솔 경고          |
| B      | `baseURL` 안에 `host` 포함     | `host` 무시 + 콘솔 경고                |
| C      | 두 값이 완전히 무관             | `Error` throw (자동 해소 불가)          |

## baseURL 파싱 규칙
`baseURL`만 입력된 경우(또는 케이스 A 처리 후):
1. 프로토콜 접두사(`http://` 등)를 제거한다.
2. 첫 번째 `/`를 기준으로 `host`와 `basePath`를 분리한다.
3. `/`가 없으면 전체가 `host`이고 `basePath`는 빈 문자열이 된다.

## Parameters

### config?

[`UrlConfig`](core.url-resolver.Interface.UrlConfig.md) = `{}`

URL 입력 설정 객체

## Returns

[`NormalizedUrlConfig`](core.url-resolver.Interface.NormalizedUrlConfig.md)

정규화된 URL 설정 (`protocol`, `host`, `basePath`)

## Throws

`host`와 `baseURL`이 동시에 입력되어 자동 해소가 불가능한 경우 (케이스 C)

## Throws

`protocol` 값이 허용된 키(`'HTTP'|'HTTPS'|'FILE'|'SSH'`)가 아닌 경우

## Examples

```ts
normalizeUrlConfig({ host: 'api.example.com', basePath: '/v1', env: 'production' });
// → { protocol: 'https://', host: 'api.example.com', basePath: '/v1' }
```

```ts
normalizeUrlConfig({ baseURL: 'localhost:8080/api', debug: true });
// → { protocol: 'http://', host: 'localhost:8080', basePath: '/api' }
```

```ts
normalizeUrlConfig({ baseURL: 'https://api.example.com/v1' });
// → { protocol: 'https://', host: 'api.example.com', basePath: '/v1' }
```

```ts
normalizeUrlConfig({ host: 'localhost:8080', baseURL: 'localhost:8080/api' });
// console.warn 출력 후 → { protocol: 'https://', host: 'localhost:8080', basePath: '/api' }
```
