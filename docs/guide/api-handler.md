# ApiHandler

<span class="badge badge-stable">Stable</span>

`ApiHandler` 는 HTTP 전송 레이어를 담당하는 클래스입니다. `DomainState` 가 상태 추적에만 집중할 수 있도록 네트워크 통신을 위임받아 처리합니다. URL 프로토콜 결정, 기본 경로 조합, HTTP 오류 처리를 내부적으로 수행합니다.

## 생성자

```javascript
new ApiHandler(urlConfig?)
```

<table class="param-table">
  <thead>
    <tr><th>파라미터</th><th>타입</th><th>기본값</th><th>설명</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>host</code></td>
      <td><code>string</code></td>
      <td>—</td>
      <td>호스트 주소. <code>'localhost:8080'</code>, <code>'api.example.com'</code> 형식. <code>baseURL</code>과 택일.</td>
    </tr>
    <tr>
      <td><code>baseURL</code></td>
      <td><code>string</code></td>
      <td>—</td>
      <td>프로토콜 포함 전체 기본 URL. <code>'http://localhost:8080/app/api'</code> 형식. <code>host</code>와 택일.</td>
    </tr>
    <tr>
      <td><code>basePath</code></td>
      <td><code>string</code></td>
      <td><code>''</code></td>
      <td>모든 요청에 공통으로 붙는 경로 접두사. <code>'/api'</code>, <code>'/v1'</code> 등.</td>
    </tr>
    <tr>
      <td><code>env</code></td>
      <td><code>'development' | 'production'</code></td>
      <td>—</td>
      <td>프로토콜 자동 결정 기준. <code>development</code>이면 HTTP, <code>production</code>이면 HTTPS.</td>
    </tr>
    <tr>
      <td><code>protocol</code></td>
      <td><code>'HTTP' | 'HTTPS'</code></td>
      <td>—</td>
      <td>프로토콜 명시적 지정. <code>env</code>보다 우선 적용됩니다.</td>
    </tr>
    <tr>
      <td><code>debug</code></td>
      <td><code>boolean</code></td>
      <td><code>false</code></td>
      <td>URL 결정 과정을 콘솔에 출력합니다. 개발 환경에서 유용합니다.</td>
    </tr>
  </tbody>
</table>

## URL 프로토콜 결정 순서

동일한 `ApiHandler` 인스턴스를 개발/운영 환경에서 모두 사용하려면 `env` 옵션을 환경 변수와 연결하는 것이 권장됩니다.

```
1. protocol 명시                → 그대로 사용 ('HTTP' | 'HTTPS')
2. env = 'production'           → HTTPS 자동 적용
3. env = 'development'          → HTTP 자동 적용
4. debug = true                 → HTTP
5. 어떤 것도 지정하지 않은 경우 → HTTPS (안전한 기본값)
```

## 사용 예시

```javascript
// ── 기본 개발 환경 ───────────────────────────────────────────
const api = new ApiHandler({ host: 'localhost:8080', basePath: '/api' })
// → http://localhost:8080/api/...

// ── 운영 환경 (HTTPS 자동) ────────────────────────────────────
const api = new ApiHandler({
    host: 'api.my-service.com',
    env:  'production',
})
// → https://api.my-service.com/...

// ── 통합 문자열형 baseURL ─────────────────────────────────────
const api = new ApiHandler({ baseURL: 'http://localhost:8080/app/api' })

// ── 다중 서버 연결 ────────────────────────────────────────────
const userApi = new ApiHandler({ host: 'users.my-service.com', env: 'production' })
const authApi = new ApiHandler({ host: 'auth.my-service.com',  env: 'production' })

const user  = await userApi.get('/users/1')
const token = await authApi.get('/tokens/current')
```

## 메서드

### get(path, options?)

서버에서 데이터를 조회하고 `DomainState` 인스턴스를 반환합니다. 내부적으로 `DomainState.fromJSON()` 을 호출하며 `isNew: false` 로 설정됩니다.

```javascript
const user = await api.get('/users/user_001')
// → DomainState { _isNew: false, data: { userId: 'user_001', ... } }

// DomainVO를 전달하면 스키마 검증 및 변환기가 주입됩니다.
const user = await api.get('/users/user_001', { vo: new UserVO() })
```

<table class="param-table">
  <thead>
    <tr><th>옵션</th><th>타입</th><th>설명</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>vo</code></td>
      <td><code>DomainVO</code></td>
      <td>스키마 검증 및 변환기 주입. 응답 데이터와 VO 스키마의 불일치 시 콘솔 경고.</td>
    </tr>
    <tr>
      <td><code>label</code></td>
      <td><code>string</code></td>
      <td>디버그 팝업에 표시될 인스턴스 레이블.</td>
    </tr>
    <tr>
      <td><code>debug</code></td>
      <td><code>boolean</code></td>
      <td><code>true</code>이면 BroadcastChannel 디버그 채널에 상태를 broadcast합니다.</td>
    </tr>
  </tbody>
</table>

::: warning HTTP 오류 처리
서버가 `4xx` 또는 `5xx` 를 반환하면 `{ status, statusText, body }` 형태의 객체가 throw됩니다. `try/catch` 로 반드시 처리해야 합니다.
:::

## 내부 동작

`ApiHandler` 는 `DomainState` 인스턴스에 주입되어 `save()`, `remove()` 호출 시 실제 네트워크 요청을 수행합니다. 이 구조 덕분에 테스트 환경에서 `MockApiHandler` 로 교체하거나, WebSocket 기반의 커스텀 핸들러로 대체하는 것이 가능합니다.

```javascript
// 테스트 환경: 실제 네트워크 없이 동작
const mockApi = {
    _fetch:       vi.fn().mockResolvedValue(null),
    getUrlConfig: () => ({ protocol: 'http://', host: 'localhost', basePath: '' }),
}
const state = DomainState.fromJSON(JSON.stringify(data), mockApi)
```
