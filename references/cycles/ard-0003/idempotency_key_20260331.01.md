# Idempotency-Key Interceptor (2026-03-31)

> **Milestone:** `v1.1.x`
> **Branch:** `feature/idempotency-key`
> **References:** `ard-0003-alignment.md § 4.1`

---

## (a) 현행 코드 진단

### `save()` 현재 상태 — 타임아웃 재시도 시 중복 생성 위험

```text
DomainState.save(requestPath)
 │
 ├─ #snapshot 캡처 (structuredClone)
 ├─ isNew 분기
 │   ├─ true  → handler._fetch(url, { method: 'POST', body })
 │   └─ false → dirtyRatio 계산 → PUT 또는 PATCH
 ├─ 성공 → clearChangeLog() + clearDirtyFields()
 └─ 실패 → _rollback(#snapshot) → re-throw
```

`_fetch()` 호출 시 어떤 멱등성 키도 포함되지 않는다. 네트워크 타임아웃으로
클라이언트가 응답을 받지 못했을 때, 서버가 요청을 이미 처리했는지 확인할 수단이 없다.

| 상황                          | 현재 동작               | 문제                                            |
| ----------------------------- | ----------------------- | ----------------------------------------------- |
| 타임아웃 → 재시도 (POST)      | 동일 body로 POST 재전송 | 리소스 중복 생성                                |
| 타임아웃 → 재시도 (PUT/PATCH) | 동일 body로 재전송      | 이론상 멱등이나 서버 구현에 따라 중복 처리 가능 |
| `restore()` 후 재시도         | 새 save()로 진입        | UUID 기준점이 없어 이전 요청과 구분 불가        |

### 현재 `ApiHandler` 생성자 — idempotent 옵션 없음

```javascript
// 현재 constructor
constructor(urlConfig = {}) {
    this._urlConfig = normalizeUrlConfig(urlConfig);
    this._debug     = urlConfig.debug ?? false;
    this._headers   = { 'Content-Type': 'application/json' };
    // idempotent 관련 필드 없음
}
```

### 설계 결정: 라이브러리는 자동 재시도를 담당하지 않는다

Exponential Backoff 재시도를 라이브러리가 내장하면 타임아웃 임계값, 최대 시도 횟수,
재시도 대상 에러 코드(5xx vs 4xx 구분) 등 비즈니스 영역의 결정을 라이브러리가 강제한다.
이는 "단순한 인터페이스 제공"이라는 v2.0.0 목표와 충돌한다.

대신, **소비자가 `catch` 블록에서 `save()`를 재호출하면 동일 UUID가 자동으로 재사용**되는
구조를 택한다. 재시도 횟수와 조건은 소비자가 결정한다.

---

## (b) 목표 아키텍처 설계

### `#idempotencyKey` 3-상태 설계

`#csrfToken`의 3-상태 패턴(`undefined` / `null` / `string`)을 그대로 벤치마킹한다.
단, `null` 상태(파싱 실패 마킹)가 필요 없으므로 2-상태로 단순화한다.

```text
this.#idempotencyKey 상태표

  undefined  →  기능 비활성 또는 요청 대기 전.
                handler._idempotent === false 이거나
                이전 save()가 성공하여 초기화된 상태.
                _fetch() 내부에서 Idempotency-Key 헤더 삽입 로직 건너뜀.

  string     →  save() 진입 시 crypto.randomUUID()로 발급된 UUID.
                요청 진행 중 또는 실패 후 재시도 대기 중.
                _fetch() 내부에서 Idempotency-Key 헤더 자동 주입.
                성공 직후 → undefined로 초기화.
                실패 시 → 유지 (소비자 catch 블록 재시도 시 동일 UUID 재사용).
```

### UUID 생명주기 흐름

```text
save() 진입
  │
  ├─ handler._idempotent === true 확인
  │   └─ #idempotencyKey가 undefined인 경우에만 신규 UUID 발급
  │       └─ #idempotencyKey = crypto.randomUUID()
  │           ※ 이미 string인 경우(재시도)는 기존 UUID 유지
  │
  ├─ #snapshot 캡처 (기존 동일)
  │
  ├─ _fetch() 호출
  │   └─ MUTATING_METHODS.has(method) && typeof #idempotencyKey === 'string'
  │       → headers['Idempotency-Key'] = #idempotencyKey
  │
  ├─ 성공
  │   └─ clearChangeLog() + clearDirtyFields()
  │   └─ #idempotencyKey = undefined  ← 초기화
  │
  └─ 실패
      └─ _rollback(#snapshot) → re-throw
      └─ #idempotencyKey 유지  ← 재시도 대비
```

### `restore()` 호출 시 UUID 초기화

`restore()`는 "save() 이전 상태로 되돌아간다"는 의미다.
이 시점에서 재시도 맥락 자체가 사라지므로 UUID도 함께 초기화한다.

```text
restore() 호출
  └─ _rollback(#snapshot)
  └─ #snapshot = undefined
  └─ #idempotencyKey = undefined  ← 재시도 맥락 소멸
```

### `_fetch()` 분기 삽입 위치

```text
_fetch(url, options) 호출 흐름 (변경 후)

  ① 헤더 초기화
     headers = { ...this._headers, ...(options.headers ?? {}) }

  ② CSRF 토큰 삽입 분기 (기존 유지)
     if (MUTATING_METHODS.has(method)) { ... }

  ③ Idempotency-Key 삽입 분기  ← NEW
     Idempotency-Key는 DomainState에서 관리하므로
     ApiHandler._fetch()의 options에 헤더로 전달받는 방식을 취한다.
     DomainState.save()가 _fetch() 호출 직전 headers에 주입.

  ④ fetch(url, { ...options, headers })
  ⑤ res.ok === false → HttpError throw
  ⑥ return text || null
```

`Idempotency-Key` 헤더는 `DomainState.save()` 내부에서 `options.headers`에 직접 추가한다.
`ApiHandler._fetch()`는 전달받은 헤더를 병합할 뿐이며, UUID 관리 로직을 알지 못한다.
이렇게 하면 `ApiHandler`는 멱등성 개념을 모르고, `DomainState`가 비즈니스 맥락(UUID 생명주기)을 전담한다.

---

## (c) 변경 파일별 세부 분석

### `src/network/api-handler.js` — 생성자 옵션 추가

```javascript
// constructor 변경 후
constructor(urlConfig = {}) {
    this._urlConfig   = normalizeUrlConfig(urlConfig);
    this._debug       = urlConfig.debug ?? false;
    this._headers     = { 'Content-Type': 'application/json' };

    /**
     * 멱등성 키 자동 발급 여부.
     * `true`이면 `DomainState.save()` 진입 시 `Idempotency-Key` 헤더를 자동으로 발급하고 관리한다.
     * 기본값 `false` — 라이브러리가 강제하지 않는다.
     * @type {boolean}
     */
    this._idempotent = urlConfig.idempotent ?? false;
}
```

JSDoc `@param` 타입 정의에 `idempotent?: boolean` 추가.

### `src/domain/DomainState.js` — 3개 지점 수정

#### 수정 1. Private field 추가 (constructor 상단)

```javascript
/**
 * Idempotency-Key UUID 저장소.
 *
 * | 상태       | 의미                                           | save() 동작                    |
 * |------------|------------------------------------------------|-------------------------------|
 * | undefined  | 기능 비활성 또는 이전 요청 성공 후 초기화 상태  | Idempotency-Key 헤더 미삽입    |
 * | string     | 요청 진행 중 또는 실패 후 재시도 대기 중        | Idempotency-Key 헤더 자동 주입 |
 *
 * @type {string | undefined}
 */
#idempotencyKey = undefined;
```

#### 수정 2. `save()` — UUID 발급 및 헤더 주입

```text
save() 내부 변경 지점

① #snapshot 캡처 직전
   if (handler._idempotent && this.#idempotencyKey === undefined) {
       this.#idempotencyKey = crypto.randomUUID();
   }

② _fetch() 호출 시 options.headers에 주입
   const idempotentHeaders = this.#idempotencyKey
       ? { 'Idempotency-Key': this.#idempotencyKey }
       : {};

   handler._fetch(url, {
       method: 'POST',
       body:   toPayload(this._getTarget),
       headers: idempotentHeaders,
   });

③ 성공 경로 — clearChangeLog() 이후
   this.#idempotencyKey = undefined;
```

#### 수정 3. `restore()` — UUID 초기화 추가

```text
restore() 내부 변경 지점

  기존: this.#snapshot = undefined;
  추가: this.#idempotencyKey = undefined;  ← 재시도 맥락 소멸
```

### `src/constants/error.messages.js` — 선택적 추가

`Idempotency-Key`는 실패해도 `throw`하지 않으므로 에러 상수 추가는 불필요하다.
단, `crypto.randomUUID`가 미지원 환경(구형 Node.js)에서 에러가 발생할 수 있으므로
방어 로직에 대한 `devWarn` 로그 메시지는 `log.messages.js`에 추가한다.

---

## (d) 예상 시나리오

### 시나리오 1. 정상 흐름 — 첫 번째 요청 성공

```text
const api = new ApiHandler({ host: 'localhost:8080', idempotent: true });
const user = await api.get('/api/users/1');
user.data.name = 'Davi';

await user.save('/api/users/1');

흐름:
  save() 진입
  → handler._idempotent === true, #idempotencyKey === undefined
  → UUID 'a1b2-...' 발급 → #idempotencyKey = 'a1b2-...'
  → _fetch(url, { method: 'PATCH', headers: { 'Idempotency-Key': 'a1b2-...' } })
  → 200 OK
  → clearChangeLog() → #idempotencyKey = undefined
```

### 시나리오 2. 타임아웃 → 재시도 흐름

```text
save() 첫 번째 시도
  → UUID 'a1b2-...' 발급 → 요청 전송
  → 네트워크 타임아웃 (서버는 이미 처리 완료)
  → _rollback(#snapshot) 수행
  → #idempotencyKey = 'a1b2-...' 유지  ← UUID 살아있음
  → save() 예외 소비자에게 re-throw

소비자 catch 블록
  catch (err) {
      // #idempotencyKey가 여전히 'a1b2-...'
      await user.save('/api/users/1');  ← 동일 UUID로 재시도
  }

재시도 흐름:
  → handler._idempotent === true, #idempotencyKey === 'a1b2-...' (이미 string)
  → 신규 UUID 발급 건너뜀 (조건: #idempotencyKey === undefined 일 때만 발급)
  → _fetch(url, { headers: { 'Idempotency-Key': 'a1b2-...' } })  ← 동일 UUID
  → 서버: 이미 처리된 요청 → 동일 응답 반환 또는 409로 중복 처리 방지
  → 성공 → #idempotencyKey = undefined
```

### 시나리오 3. `idempotent: false` — 기능 비활성

```text
const api = new ApiHandler({ host: 'localhost:8080' });  // idempotent 미설정 (기본 false)

save() 진입
  → handler._idempotent === false
  → UUID 발급 로직 건너뜀
  → #idempotencyKey === undefined 유지
  → _fetch(url, { method: 'POST', ... })  ← Idempotency-Key 헤더 없음
  → 기존 동작과 동일
```

### 시나리오 4. `restore()` 호출 후 재시도

```text
save() 실패 → #idempotencyKey = 'a1b2-...' 유지

// 소비자가 restore()로 상태를 되돌리기로 결정
user.restore();
  → _rollback(#snapshot)
  → #snapshot = undefined
  → #idempotencyKey = undefined  ← UUID 초기화

// 이후 save()를 새로 시작
await user.save('/api/users/1');
  → 신규 UUID 'c3d4-...' 발급  ← 이전 요청과 무관한 새 맥락
```

---

## (e) 계획 수립

### 수정 파일 목록 및 변경 범위

| 파일                                | 변경 종류  | 변경 내용                                                                                                                     |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/network/api-handler.js`        |  **수정**  | 생성자에 `idempotent` 옵션 추가, `this._idempotent` 필드 추가, JSDoc 갱신                                                     |
| `src/domain/DomainState.js`         |  **수정**  | `#idempotencyKey` private field 추가, `save()` UUID 발급/헤더 주입/초기화 로직 추가, `restore()` UUID 초기화 추가, JSDoc 갱신 |
| `src/common/logger.js`              |  **수정**  | `crypto.randomUUID` 미지원 환경 경고 메시지 추가                                                                              |
| `tests/network/api-handler.test.js` |  **수정**  | `idempotent` 옵션 관련 테스트 케이스 추가                                                                                     |
| `tests/domain/DomainState.test.js`  |  **수정**  | UUID 생명주기, 재시도 UUID 재사용, `restore()` UUID 초기화 테스트 케이스 추가                                                 |

### Feature 브랜치명

```text
feature/idempotency-key
```

신규 기능 추가이므로 `feature/`. 기존 `save()` 동작 방식은 `idempotent: false` 기본값으로 완전히 하위 호환된다.

### Commit Sequence

```markdown
# STEP A — ApiHandler 생성자 옵션 추가
feat(network): add idempotent option to ApiHandler constructor

  - idempotent?: boolean 생성자 파라미터 추가 (기본값 false)
  - this._idempotent 인스턴스 필드 저장
  - JSDoc @param 타입 정의 갱신
  - 기존 동작 완전 하위 호환 (idempotent: false 기본값)


# STEP B — DomainState #idempotencyKey private field 추가
feat(domain): add #idempotencyKey private field to DomainState

  - #idempotencyKey: string | undefined private class field 추가
  - 3-상태 설계 대신 2-상태 채택 (null 불필요: 파싱 실패 시나리오 없음)
  - JSDoc 상태표 주석 추가


# STEP C — save() UUID 생명주기 구현
feat(domain): implement Idempotency-Key header injection in save()

  - save() 진입 시 handler._idempotent && #idempotencyKey === undefined 조건으로 UUID 발급
  - crypto.randomUUID() 발급 → #idempotencyKey 저장
  - _fetch() options.headers에 Idempotency-Key 헤더 주입
  - 성공 경로: clearChangeLog() 이후 #idempotencyKey = undefined 초기화
  - 실패 경로: _rollback() 수행, #idempotencyKey 유지 (재시도 대비)
  - restore() 내부: #idempotencyKey = undefined 추가 (재시도 맥락 소멸)


# STEP D — Vitest 단위 테스트 작성
test(domain,network): add idempotency key lifecycle test cases

  - idempotent: true 시 Idempotency-Key 헤더 포함 확인
  - idempotent: false(기본) 시 헤더 미삽입 확인
  - 성공 후 #idempotencyKey undefined 초기화 확인
  - 실패 후 동일 UUID로 재시도 시 헤더 재사용 확인
  - restore() 호출 후 UUID 초기화 확인
  - GET 요청에는 idempotent: true 여부와 무관하게 헤더 미삽입 확인 (MUTATING_METHODS)
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                       | 기준                                                      |
| -------------------------- | --------------------------------------------------------- |
| `npm run lint`             | error 0건                                                 |
| `npm test`                 | 전체 테스트 통과 (기존 TC 회귀 없음)                      |
| `idempotent: false` (기본) | `save()` 동작 기존과 완전 동일, Idempotency-Key 헤더 없음 |
| 첫 번째 `save()` 성공      | `#idempotencyKey` → `undefined` 초기화 확인               |
| 타임아웃 후 재시도         | 동일 UUID가 두 번째 요청 헤더에 포함됨 확인               |
| `restore()` 후 `save()`    | 신규 UUID 발급 (이전 UUID와 상이) 확인                    |
| GET 요청                   | `idempotent: true`여도 Idempotency-Key 헤더 미삽입 확인   |
| 하위 호환                  | `idempotent` 옵션 없는 기존 소비자 코드 에러 없음 확인    |
