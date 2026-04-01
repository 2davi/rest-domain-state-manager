# Type Alias: ApiHandlerConfig

```ts
type ApiHandlerConfig = UrlConfig & object;
```

**`idempotent` 프로퍼티:**

`true`이면 `DomainState.save()` / `remove()` 호출 시 `Idempotency-Key` 헤더를
자동으로 발급하고 관리한다.

네트워크 타임아웃으로 클라이언트가 응답을 받지 못했을 때,
소비자 `catch` 블록에서 `save()`를 재호출하면 동일 UUID가 자동으로 재사용된다.
서버가 이 UUID를 기준으로 중복 처리를 방지할 수 있다.

기본값 `false` — 기존 소비자 코드와 완전 하위 호환.

## Type Declaration

### idempotent?

```ts
optional idempotent?: boolean;
```

## Type Parameters
