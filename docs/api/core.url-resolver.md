# core/url-resolver

URL 조합 및 프로토콜 결정 모듈

`ApiHandler` 생성자와 `DomainState._resolveURL()` 내부에서 사용하는
URL 정규화·조합·프로토콜 결정 레이어다.

## 지원하는 입력 방식

| 방식                 | 필수 필드                     | 예시                                    |
|---------------------|------------------------------|-----------------------------------------|
| (1) 구조 분해형      | `host`                       | `{ host: 'api.example.com', basePath: '/v1' }` |
| (2) 통합 문자열형    | `baseURL`                    | `{ baseURL: 'localhost:8080/api' }`     |

두 방식을 동시에 입력하면 자동 충돌 해소를 시도하며,
해소가 불가능한 경우 `Error`를 throw한다.

## 최종 URL 구성 공식
```
최종 URL = protocol + host + basePath + requestPath
```

## 프로토콜 결정 우선순위
```
1순위: 명시적 protocol 인자 (예: 'HTTPS')
2순위: env 플래그 → DEFAULT_PROTOCOL[env]
3순위: env 없음 + debug: true  → HTTP
4순위: env 없음 + debug: false → HTTPS (기본값)
```

## 공개 API
- `normalizeUrlConfig(config)` — URL 설정 정규화 (ApiHandler 생성자에서 1회 호출)
- `resolveProtocol(opts)`      — 프로토콜 단독 결정 (테스트·내부 재사용 목적)
- `buildURL(normalized, path)` — 최종 URL 문자열 조합 (요청마다 호출)

## See

 - [URL MDN 문서](https://developer.mozilla.org/ko/docs/Web/API/URL)
 - module:network/api-handler ApiHandler

## Interfaces

- [HttpError](core.url-resolver.Interface.HttpError.md)
- [NormalizedUrlConfig](core.url-resolver.Interface.NormalizedUrlConfig.md)
- [ResolveProtocolOptions](core.url-resolver.Interface.ResolveProtocolOptions.md)
- [UrlConfig](core.url-resolver.Interface.UrlConfig.md)

## Functions

- [buildURL](core.url-resolver.Function.buildURL.md)
- [normalizeUrlConfig](core.url-resolver.Function.normalizeUrlConfig.md)
- [resolveProtocol](core.url-resolver.Function.resolveProtocol.md)
