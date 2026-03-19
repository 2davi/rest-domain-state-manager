# ApiHandler 생성 및 옵션

`ApiHandler`는 HTTP 전송(Transport) 레이어를 담당하는 클래스입니다. `DomainState`는 데이터의 상태 추적에만 집중하고, 실제 네트워크 통신은 이 핸들러에게 위임합니다.

## 기본 생성 및 다중 서버 연결

백엔드 서버가 여러 개라면, 목적지에 맞게 여러 개의 인스턴스를 만들어 사용할 수 있습니다.

```javascript
// 1. 기본 API 서버
const api = new ApiHandler({
  host: 'api.my-service.com',
  basePath: '/v1',
  env: 'production' // 자동 HTTPS 설정
});

// 2. 다른 도메인의 인증 서버
const authApi = new ApiHandler({
  host: 'auth.my-service.com'
});

// 각기 다른 핸들러를 주입하여 사용
const user = await api.get('/users/1');
const token = await authApi.get('/tokens/current');
```

## URL 결정 우선순위

URL 프로토콜(`http` vs `https`)은 다음 우선순위로 자동 결정됩니다.

1. **명시적 `protocol` 인자:** `'HTTP'`, `'HTTPS'`
2. **`env` 플래그:** `'development'`(HTTP) 또는 `'production'`(HTTPS)
3. **`debug` 플래그:** `true`이면 HTTP, `false`이면 HTTPS (기본값)