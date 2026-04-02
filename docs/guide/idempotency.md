# Idempotency-Key

<span class="badge badge-new">v1.1.0</span>

네트워크 타임아웃으로 인한 재시도 시 서버의 중복 처리를 방지하는 기능입니다.  
`ApiHandler({ idempotent: true })` 한 줄로 활성화됩니다.

---

## 문제 — 타임아웃과 중복 처리

```
클라이언트           서버
    |
    |── POST /api/orders ──────────────→|
    |                                   | (처리 중)
    |←─ 타임아웃 ──────────────────────|
    |
    | (처리됐는지 모름)
    |── POST /api/orders ──────────────→|  ← 중복 생성?
```

타임아웃이 발생하면 클라이언트는 요청이 처리됐는지 알 수 없습니다.  
재시도하면 중복 주문이 생성될 수 있습니다.

---

## 해결 — Idempotency-Key

```
클라이언트                          서버
    |
    |── POST /api/orders ───────────────────→|
    |   X-Idempotency-Key: uuid-1234         | (처리 + uuid-1234 저장)
    |←─ 타임아웃 ──────────────────────────|
    |
    |── POST /api/orders (재시도) ──────────→|
    |   X-Idempotency-Key: uuid-1234         | (uuid-1234 이미 있음 → 저장된 응답 반환)
    |←─ 200 OK (이전 응답) ────────────────|
```

동일한 UUID로 재시도하면 서버가 이전 응답을 그대로 반환합니다. 중복 처리 없음.

---

## 활성화

```javascript
const api = new ApiHandler({
    host:       'localhost:8080',
    idempotent: true,  // ← 이 한 줄로 활성화
});
```

활성화하면 `save()` 호출 시마다 `X-Idempotency-Key` 헤더에 UUID가 자동으로 주입됩니다.

---

## UUID 생명주기

```
save() 첫 호출
  → UUID 신규 발급 (crypto.randomUUID() 또는 Math.random() 폴백)
  → X-Idempotency-Key: uuid-1234 헤더 주입

성공
  → UUID 소멸 (#idempotencyKey = undefined)
  → 다음 save() 호출 시 새 UUID 발급

실패 (타임아웃, 5xx 등)
  → UUID 유지 (#idempotencyKey = 'uuid-1234')
  → 소비자 catch 블록에서 save() 재호출 시 동일 UUID 재사용
  → 서버 중복 처리 방지
```

---

## 재시도 패턴

```javascript
const api  = new ApiHandler({ host: 'localhost:8080', idempotent: true });
const user = await api.get('/api/users/1');

user.data.name = 'Davi';

// 최대 3회 재시도
for (let attempt = 0; attempt < 3; attempt++) {
    try {
        await user.save('/api/users/1');
        // 성공 — UUID 소멸, 다음 save()는 새 UUID 사용
        break;
    } catch (err) {
        if (attempt === 2) throw err;
        // 실패 — UUID 유지, 재시도 시 동일 UUID로 전송
        // 서버가 이미 처리했다면 저장된 응답 반환 (중복 없음)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // 지수 백오프
    }
}
```

---

## CSRF 토큰과 함께 사용

`ApiHandler.init()`으로 CSRF 토큰을 초기화하면 두 헤더가 동시에 주입됩니다.

```javascript
const api = new ApiHandler({
    host:       'localhost:8080',
    idempotent: true,
});

// CSRF 토큰 초기화 (페이지 로드 시 1회)
await api.init({ csrfSelector: 'meta[name="_csrf"]' });

await user.save('/api/users/1');
// 요청 헤더:
//   X-Idempotency-Key: uuid-1234
//   X-CSRF-Token: abc123...
```

---

## 서버 구현 참고

Idempotency-Key를 지원하려면 서버 측에서 다음을 구현해야 합니다.

1. `X-Idempotency-Key` 헤더에서 UUID 추출
2. UUID를 키로 처리 결과를 캐시 (Redis 등)에 저장
3. 동일 UUID의 재시도 요청이 오면 캐시된 응답 반환
4. 캐시 만료 시간 설정 (권장: 24시간)

Spring Boot 예시:

```java
@PostMapping("/api/orders")
public ResponseEntity<Order> createOrder(
    @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey,
    @RequestBody OrderRequest request
) {
    if (idempotencyKey != null) {
        Optional<Order> cached = idempotencyCache.get(idempotencyKey);
        if (cached.isPresent()) return ResponseEntity.ok(cached.get());
    }

    Order order = orderService.create(request);

    if (idempotencyKey != null) {
        idempotencyCache.put(idempotencyKey, order, Duration.ofHours(24));
    }

    return ResponseEntity.status(201).body(order);
}
```

---

## 다음 단계

- [ApiHandler 가이드](/guide/api-handler) — CSRF 토큰 초기화 및 헤더 설정
- [save() 분기 전략](/guide/save-strategy) — POST/PUT/PATCH 자동 선택 알고리즘
