# DomainPipeline과 예외 처리

`DomainState.all()`을 사용하면 여러 API를 병렬로 호출하고, 완료된 후의 처리(Post-processing)를 체인 형태로 우아하게 작성할 수 있습니다.

## 파이프라인 기본 구조

여러 리소스를 동시에 `fetch` 요청하고, `after()` 체이닝을 통해 각 응답에 대한 후처리를 정의합니다.

```javascript
const result = await DomainState.all({
  roles: api.get('/api/roles'),
  user:  api.get('/api/users/user_001'),
})
.after('roles', async (roles) => {
  // roles는 응답 데이터로 래핑된 DomainState 인스턴스입니다.
  roles.renderTo('#roleSelect', { /* ... */ });
})
.after('user', async (user) => {
  console.log(user.data.name);
})
.run();

// result 객체에는 조회된 DomainState 인스턴스들이 담깁니다.
// result.roles, result.user
```

> **💡 실행 순서 보장:** `after()` 큐는 네트워크 응답이 도착한 순서가 아니라 **코드로 등록한 순서대로** 실행됩니다.

## strict 모드와 에러 처리 (Design Decision)

파이프라인 실행 중 특정 API 호출이나 `after` 핸들러에서 에러가 발생했을 때의 동작을 `strict` 옵션으로 제어합니다.

### 1. strict: false (기본값 - 부분 실패 허용)

HTTP 통신은 비용이 큰 작업이므로, 하나의 리소스가 실패했다고 해서 성공한 다른 리소스의 처리를 버리는 것은 비효율적입니다. `strict: false`는 에러를 무시하고 다음 처리를 계속 진행하며, 실패 내역을 `_errors` 배열에 담아 반환합니다.

```javascript
const result = await DomainState.all({
  roles: api.get('/api/roles'),
  user:  api.get('/api/users/INVALID'),  // 404 에러 발생 가정
}, { strict: false }).run();

// 에러가 발생한 항목 추적
if (result._errors?.length > 0) {
  result._errors.forEach(({ key, error }) => console.warn(key, '실패:', error));
}
```

### 2. strict: true (첫 실패 시 즉시 중단)

모든 리소스가 완벽하게 로드되어야만 화면을 그릴 수 있는 엄격한 요구사항이 있다면 `strict: true`를 사용합니다. 첫 에러 발생 시 즉시 `Promise.reject`를 발생시킵니다.

```javascript
try {
  await DomainState.all({ /* ... */ }, { strict: true }).run();
} catch (err) {
  console.error('파이프라인이 중단되었습니다:', err);
}
```