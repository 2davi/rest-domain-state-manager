# network/api-handler

ApiHandler — HTTP 전송 레이어

`fetch()` 위의 얇은 래퍼로, 다음을 담당한다.

1. **URL 설정 중앙 관리** — `normalizeUrlConfig()`로 정규화된 설정을 인스턴스에 캐싱
2. **공통 헤더 관리** — `Content-Type: application/json` 자동 주입
3. **에러 정규화** — `response.ok` 검사 → `HttpError` 구조체 throw
4. **GET 응답 → `DomainState` 변환** — `DomainState.fromJSON()` 위임

## 인스턴스 생성 책임
클래스만 export하고 **인스턴스 생성은 소비자(Consumer)가 담당**한다.
서버 주소, 환경, 디버그 여부는 생성 시점에 결정되어 인스턴스에 캐싱된다.

## 다중 백엔드 서버 지원
서버가 여러 개라면 각 서버마다 `ApiHandler` 인스턴스를 생성하고,
해당 인스턴스를 `DomainState.fromVO()` / `fromForm()` 에 주입한다.
인스턴스에 결합된 서버 설정이 모든 `save()` / `remove()` 요청에 자동 적용된다.

## 공개 메서드
- `init(config?)` — CSRF 토큰 초기화. DOM이 준비된 시점에 1회 호출한다. 미호출 시 CSRF 기능 비활성.
- `get(requestPath, options?)` — GET 요청 전송 후 `DomainState` 반환

## 내부 전용 메서드
- `_fetch(url, options?)` — `DomainState.save()` / `remove()` 에서 위임 호출
- `getUrlConfig()`         — `DomainState._resolveURL()` 에서 URL 설정 참조
- `isDebug()`              — 디버그 플래그 외부 노출

## See

 - module:domain/DomainState DomainState
 - module:core/url-resolver normalizeUrlConfig

## Examples

```ts
import { ApiHandler } from './rest-domain-state-manager.js';
const api = new ApiHandler({ host: 'localhost:8080', debug: true });
const user = await api.get('/api/users/user_001');
user.data.name = 'Davi';
await user.save('/api/users/user_001');
```

```ts
const userApi  = new ApiHandler({ host: 'user-service.com', env: 'production' });
const orderApi = new ApiHandler({ host: 'order-service.com', env: 'production' });
const user  = await userApi.get('/api/users/1');
const order = await orderApi.get('/api/orders/999');
await user.save('/api/users/1');    // → user-service.com 으로 전송
await order.save('/api/orders/999'); // → order-service.com 으로 전송
```

## Classes

- [ApiHandler](network.api-handler.Class.ApiHandler.md)

## Interfaces

- [GetOptions](network.api-handler.Interface.GetOptions.md)
- [HttpError](network.api-handler.Interface.HttpError.md)

## References

### NormalizedUrlConfig

Re-exports [NormalizedUrlConfig](core.url-resolver.Interface.NormalizedUrlConfig.md)

***

### UrlConfig

Re-exports [UrlConfig](core.url-resolver.Interface.UrlConfig.md)
