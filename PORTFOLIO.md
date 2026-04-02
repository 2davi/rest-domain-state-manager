# REST Domain State Manager — 포트폴리오 보고서

> **작성자:** 2davi
> **최종 갱신:** 2026년 4월 2일
> **직군:** SI 사업부 개발자 (개인 프로젝트)
> **레포지토리:** [github.com/2davi/rest-domain-state-manager](https://github.com/2davi/rest-domain-state-manager)
> **NPM:** [@2davi/rest-domain-state-manager](https://www.npmjs.com/package/@2davi/rest-domain-state-manager)
> **공식 문서:** [lab.the2davi.dev/rest-domain-state-manager](https://lab.the2davi.dev/rest-domain-state-manager)

---

## 1. 왜 이것을 만들었는가

SI/SM 환경에서 실무를 하면서 모든 화면에서 같은 패턴이 반복된다는 것을 느꼈다. GET으로 받아온 데이터를 화면에 뿌리고, 사용자가 수정하면 그 값을 다시 긁어모아 POST/PUT/PATCH 중 하나를 골라 전송하는 코드. 특히 1:N 배열 그리드에서는 `fnAddRow()`, `fnRemoveRow()`, `fnReindexRows()`, `fnSelectAll()` 같은 보일러플레이트가 화면마다 복사되고 있었다.

```javascript
// 모든 화면에서 반복되는 코드
const payload = {
    name:    document.getElementById('name').value,
    email:   document.getElementById('email').value,
    // ...필드 수만큼 반복
};
const method = isNew ? 'POST' : 'PUT';
await fetch('/api/users/1', { method, body: JSON.stringify(payload) });
```

이 코드의 진짜 문제는 길다는 것이 아니었다. **예측 불가능하다는 것**이었다. 어떤 필드가 실제로 변경됐는지 코드에서 보장하지 않는다. PUT을 써야 하는지 PATCH를 써야 하는지 개발자가 매번 판단해야 하고, 그 판단이 잘못되어도 컴파일 타임에는 아무 에러가 없다.

이 반복과 불확실성을 라이브러리 수준에서 해결하고 싶었다.
그 과정에서 JavaScript 엔진의 동작 원리, HTTP 표준 명세, 프론트엔드 프레임워크의 반응성 메커니즘을
직접 적용하는 기회로 삼았다.

---

## 2. 프로젝트 개요

### 한 줄 요약

ES6 `Proxy`로 REST API DTO의 필드 변경을 자동 추적하고,
RFC 6902 JSON Patch 기반으로 POST / PATCH / PUT을 스마트 분기하는
zero-dependency ESM 라이브러리.

### 핵심 기능

- **Proxy 기반 변경 추적:** `state.data.name = 'Davi'` — 대입만으로 changeLog에 RFC 6902 형식 기록
- **HTTP 메서드 자동 분기:** isNew 플래그 + dirtyFields 비율 → POST / PATCH / PUT 자동 결정
- **보상 트랜잭션:** `structuredClone` 스냅샷 기반 롤백. save() 실패 시 클라이언트 상태 자동 복원
- **Shadow State:** Structural Sharing 기반 불변 스냅샷 + `useSyncExternalStore` React 어댑터
- **1:N 배열 관리:** `DomainCollection` + `saveAll({ strategy: 'batch' })` + HTML `<template>` 그리드 바인딩
- **Lazy Tracking Mode:** LCS 알고리즘 deep diff + Web Worker 오프로딩. 최종 변경 결과만 PATCH
- **CSRF 인터셉터:** 3-상태 설계 (`undefined`/`null`/`string`). `<meta>` 파싱 + 쿠키 파싱
- **Idempotency-Key:** IETF Draft 기반 UUID 생명주기. 네트워크 타임아웃 재시도 안전
- **Microtask Batching:** `queueMicrotask` 스케줄러. 동기 블록 내 다중 변경 → 단일 flush
- **BroadcastChannel 디버거:** HeartBeat GC + Web Worker 직렬화. 멀티탭 실시간 상태 시각화

### 기술 스택

JavaScript (ES2022+), ES6 Proxy, Reflect API, V8 Inline Caching, WeakMap,
`structuredClone`, `queueMicrotask`, `crypto.randomUUID`, BroadcastChannel API, Web Workers,
RFC 6902 JSON Patch, RFC 9110 HTTP Semantics, IETF Idempotency-Key Draft, OWASP CSRF Prevention,
Rollup, Vitest, ESLint Flat Config, Prettier, TypeDoc, VitePress, GitHub Actions, semantic-release

---

## 3. 무엇을 배우고 적용했는가

### 3-1. JS Proxy와 V8 엔진의 Hidden Class

**학습 배경:** Proxy API의 존재는 알고 있었지만, Proxy 내부에서 잘못된 코드를 작성하면 V8 엔진의 최적화를 오히려 방해한다는 사실은 몰랐다.

**핵심 개념:**

V8 엔진은 객체가 생성될 때 내부적으로 **Hidden Class(Maps)** 를 만든다. 동일한 프로퍼티를 동일한 순서로 가진 객체들은 같은 Hidden Class를 공유하며, 프로퍼티 접근 시 메모리 오프셋을 캐싱하는 **Inline Caching(IC)** 으로 $O(1)$에 가까운 속도를 낸다.

REST API 응답을 동적으로 파싱해서 빈 객체에 프로퍼티를 추가하면, 추가 순서가 요청마다 달라질 수 있고 V8의 Hidden Class가 매번 새로 생성된다. TurboFan은 이를 "예측 불가능한 코드"로 판단하고 최적화를 포기한다(Deoptimization).

**적용:**

`DomainVO`의 `static fields`로 모든 프로퍼티를 생성 시점에 동일한 순서로 초기화. 서버 응답이 오기 전에 이미 Hidden Class가 확정된다. Proxy 트랩 내부는 `Reflect.get/set/deleteProperty` 전면 적용으로 `this` 바인딩 Context Loss를 방지. 중첩 객체는 `WeakMap` 기반 Lazy Proxying으로 중복 Proxy 생성을 차단하고 GC 누수를 방지했다.

**참조:**

- [MDN — Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- [MDN — Reflect](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect)
- [V8 Blog — Hidden Classes](https://v8.dev/blog/fast-properties)
- [Vue 3 @vue/reactivity — WeakMap 캐싱 전략](https://github.com/vuejs/core/tree/main/packages/reactivity)

---

### 3-2. REST 멱등성, RFC 6902 JSON Patch, Idempotency-Key

**학습 배경:** PUT과 PATCH를 "전체 수정 vs 부분 수정"으로만 이해하고 있었다.

**핵심 개념:**

RFC 9110에 따르면 HTTP 메서드는 **리소스에 대한 의도와 부작용의 범위를 약속하는 규약**이다. PUT은 타겟 리소스를 완전히 교체하는 멱등(Idempotent) 연산이고, PATCH는 변경된 부분만 병합하는 연산이다. POST는 비멱등이라 같은 요청을 두 번 보내면 리소스가 중복 생성될 수 있다.

초기 구현의 `changeLog.length === 0 → PUT` 분기는 의미론적 오류였다. "변경 이력이 없다"는 것이 "전체 교체가 필요하다"를 의미하지 않는다.

**적용:**

Java Hibernate의 Dirty Checking을 참고해 `dirtyFields: Set<string>`을 도입. `changeLog`(RFC 6902 PATCH 페이로드용)와 `dirtyFields`(PUT/PATCH 비율 분기용)의 역할을 분리. `DIRTY_THRESHOLD = 0.7` 이상이면 JSON Patch 배열보다 전체 PUT이 효율적.

Idempotency-Key는 IETF Draft와 Stripe API 설계를 참고. `#idempotencyKey` private field를 2-상태(`undefined`/`string`)로 설계하여, 네트워크 타임아웃 후 소비자 catch 블록에서 `save()` 재호출 시 동일 UUID가 자동 재사용되도록 했다.

**참조:**

- [IETF RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [IETF RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
- [IETF — Idempotency-Key HTTP Header Field (draft)](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [Stripe API — Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)

---

### 3-3. JavaScript 이벤트 루프와 Microtask 배칭

**학습 배경:** `Promise`, `setTimeout`, `queueMicrotask`의 실행 순서 차이를 개념적으로만 알고 있었다.

**핵심 개념:**

Microtask는 Call Stack이 비워진 직후, 다음 Task가 실행되기 전에 처리된다. 이 특성을 이용하면 동기 블록 안의 모든 상태 변경을 모아서 마지막에 한 번만 사이드 이펙트를 실행할 수 있다.

**적용:**

`queueMicrotask()` 기반의 `_scheduleFlush()` 스케줄러. `_pendingFlush` 플래그로 중복 예약을 차단. 필드 3개를 연속 변경해도 Shadow State 재빌드 + BroadcastChannel 전파가 단 1회만 실행된다.

`Promise.resolve().then()` 대신 `queueMicrotask()`를 선택한 이유: Promise 객체 생성/GC 오버헤드가 없고, "microtask에 직접 예약한다"는 의도가 코드에서 명시적으로 드러난다.

---

### 3-4. Optimistic Update와 보상 트랜잭션

**학습 배경:** "낙관적 업데이트" 패턴을 TanStack Query 문서에서 읽어본 적은 있었다. 직접 클로저 수준에서 구현하는 것은 처음이었다.

**핵심 개념과 적용:**

`save()` 진입 시 `structuredClone`으로 상태 4종(domainObject, changeLog, dirtyFields, isNew)을 동기적으로 깊은 복사. HTTP 요청 실패 시 `_rollback()`이 4종을 모두 save() 진입 이전 시점으로 복원한다.

`_rollback()`은 `restoreTarget()`으로 Proxy가 아닌 원본 `domainObject`에 직접 접근한다. 이 복원 작업 자체가 changeLog에 기록되지 않으며, 이것이 의도된 동작이다.

`DomainPipeline`의 보상 트랜잭션: `strict: false` 모드에서 후속 `save()` 실패를 감지한 뒤, 이미 성공한 인스턴스에 `restore()`를 호출할 수 있도록 `#snapshot`이 다음 `save()` 호출 시까지 유지된다.

---

### 3-5. Shadow State와 Framework-Agnostic 반응성

**학습 배경:** React의 `useSyncExternalStore`가 왜 "변경 없으면 동일 참조 반환"을 요구하는지, Proxy 기반 상태 관리자에서 이 규약을 어떻게 만족시키는지 이해하고 싶었다.

**핵심 개념:**

React는 `getSnapshot()`이 반환하는 참조를 `Object.is()`로 비교한다. Proxy 내부 속성만 바꾸면 객체 참조는 그대로이므로 React는 렌더링을 하지 않는다. 반대로, 변경이 없는데 매번 새 객체를 반환하면 무한 리렌더 루프가 발생한다.

**적용:**

`_buildSnapshot()`에서 `dirtyFields` 기반 depth-1 Structural Sharing을 구현. 변경된 최상위 키만 얕은 복사하고, 변경 없는 키는 이전 스냅샷의 참조를 재사용한다.

`dirtyFields.size === 0`이면 `prevSnapshot`을 그대로 반환 → `#shadowCache`가 갱신되지 않음 → 리스너 알림 건너뜀. 이것이 `useSyncExternalStore` 무한루프의 근본 방어선이다.

`subscribe()` / `getSnapshot()` 인터페이스는 `src/adapters/react.js`의 `useDomainState()` 훅이 직접 사용한다.

**참조:**

- [React — useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [Vue 3 — @vue/reactivity 소스코드](https://github.com/vuejs/core/tree/main/packages/reactivity)

---

### 3-6. CSRF 보안과 BroadcastChannel 멀티탭 통신

**학습 배경:** CSRF 토큰 삽입이 왜 필수인지, BroadcastChannel이 "자기 자신이 보낸 메시지를 수신할 수 없다"는 제약이 실제 설계에서 어떤 문제를 만드는지 경험하고 싶었다.

**CSRF 적용:**

OWASP CSRF Prevention Cheat Sheet에 따라 `POST`, `PUT`, `PATCH`, `DELETE` 요청에만 `X-CSRF-Token` 헤더를 삽입. `#csrfToken` private field를 3-상태(`undefined`/`null`/`string`)로 설계하여 "기능 비활성"과 "파싱 실패" 상태를 명확히 구분한다.

**BroadcastChannel 적용:**

자가 수신 제약을 우회하기 위해 팝업(Manager)이 `TAB_PING`을 broadcast하고 각 탭(Worker)이 `TAB_REGISTER`로 응답하는 역방향 구조. HeartBeat GC로 `beforeunload` 미실행 시나리오 방어. `serializer.worker.js`로 `_stateRegistry` 직렬화를 메인 스레드에서 오프로딩.

**참조:**

- [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN — BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)

---

### 3-7. LCS 알고리즘과 Lazy Tracking Mode

**학습 배경:** `lazy` 모드에서 "save() 시점에 diff를 계산한다"는 설계를 구현하려면, 두 객체를 재귀적으로 비교하여 RFC 6902 형식의 changeLog를 생성해야 했다. 특히 배열에서 항목의 "동일성"을 판단하는 기준이 필요했다.

**핵심 개념과 적용:**

LCS(Longest Common Subsequence) DP 알고리즘으로 `itemKey` 필드값 기반의 항목 매칭을 구현. positional 비교(위치 기반)의 한계 — 동일 항목이 위치만 바뀌어도 `replace`로 잘못 기록되는 문제 — 를 해결했다.

Worker 오프로딩은 `diff-worker-client.js`의 Promise 기반 인터페이스로 추상화. 각 요청에 `_requestId`를 부여하고 `_pending Map`으로 동시성을 관리한다. Node.js/Vitest 환경에서는 `deepDiff()` 동기 폴백.

**참조:**

- [LCS 알고리즘 — Columbia University](https://www.cs.columbia.edu/~allen/S14/NOTES/lcs.pdf)

---

### 3-8. DI Container와 순환 참조 해소

**학습 배경:** `DomainState`와 `DomainPipeline`이 서로를 참조해야 하는데, ES Module의 순환 import는 TDZ(Temporal Dead Zone) 문제를 일으킬 수 있다.

**진화 과정:**

1. **1차 — `globalThis` 전역변수:** 설계가 꼬였다는 자증. 테스트 환경 오염.
2. **2차 — 생성자 주입:** `DomainState.PipelineConstructor = DomainPipeline`. 외부 노출 위험.
3. **3차 — Composition Root DI:** `index.js`에서 `configure({ pipelineFactory })` 호출.
   모듈 스코프 클로저 변수에 팩토리를 은닉. `DomainState`는 `DomainPipeline`의 존재를 모른다.

이 3단계 진화는 Decision Log에 기록되어 있으며, "처음부터 올바르지 않았던 결정을 어떻게 교정했는가"를 보여주는 사례다.

---

## 4. 두 가지 트랙 — 이 라이브러리를 누가 쓰는가

### SI 구원자 트랙 — JSP + Spring Boot 환경

```html
<template id="certRowTemplate">
    <tr>
        <td><input type="checkbox" class="dsm-checkbox"></td>
        <td><input type="text" data-field="certName"></td>
        <td><select data-field="certType"></select></td>
    </tr>
</template>
<table><tbody id="certGrid"></tbody></table>
```

```javascript
import { DomainState, UIComposer } from '@2davi/rest-domain-state-manager';
DomainState.use(UIComposer);

const certs = await api.get('/api/certificates');
const { addEmpty, removeChecked } = certs.bindCollection('#certGrid', {
    templateSelector: '#certRowTemplate',
    columns: { certName: { selector: '[data-field="certName"]' } },
});
document.getElementById('btnSave').onclick = () => certs.save('/api/certificates');
```

기존 `fnAddRow()` + `fnRemoveRow()` + `fnReindexRows()` + `fnSelectAll()` → **전부 사라진다.**

### 모던 Headless 트랙 — React 환경

```javascript
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

function UserProfile({ api }) {
    const user = useDomainState(() => api.get('/api/users/me'));
    if (!user) return <div>Loading...</div>;
    return (
        <input value={user.snapshot.name}
               onChange={e => { user.state.data.name = e.target.value; }} />
    );
}
```

`fetch` 없음, `useState` 없음, `useEffect` 없음, 롤백 로직 없음.

---

## 5. 개발 프로세스

### 애자일 사이클 (1인 개발)

| 사이클       | 코드명                | 기간               | 핵심 결과                                                                                                                 |
| ------------ | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **ard-0000** | 초기 진단             | 2026-03-18         | 자체 코드리뷰. 7개 결함 식별 및 6개 목표 수립.                                                                            |
| **ard-0001** | 코어 리팩토링         | 2026-03-18 ~ 03-23 | V8 최적화, Microtask Batching, ESM 패키징, src/ 재구조화, Vitest 도입, CI/CD 구축.                                        |
| **ard-0002** | 아키텍처 고도화       | 2026-03-24 ~ 03-31 | DI Container, CSRF, Rollup 빌드, Shadow State, Web Worker, 보상 트랜잭션. v1.0.0 릴리즈.                                  |
| **ard-0003** | 기능 확장 + 전략 전환 | 2026-03-31 ~ 04-02 | 외부 피드백 반영. Idempotency-Key, Lazy Tracking, DomainCollection, UIComposer/UILayout, CollectionBinder. v2.0.0 릴리즈. |

각 사이클마다 `references/ard-XXXX/` 디렉토리에 분석 문서를 먼저 작성한 후 구현에 착수했다.
`ard-XXXX-alignment.md` 문서가 해당 사이클의 판단 근거, 검토한 대안, 기각 이유를 기록한다.

### 브랜치 전략

Milestone(Minor 버전) 단위로 feature 브랜치를 분리하고, STEP 단위로 커밋을 분할한다.
Conventional Commits(`feat:`, `fix:`, `refactor:`, `docs:`)를 엄격히 적용하여
커밋 히스토리만으로 어떤 고민을 했는지 추적할 수 있게 했다.

### CI/CD 파이프라인

| Workflow          | 트리거      | 동작                                                        |
| ----------------- | ----------- | ----------------------------------------------------------- |
| `ci.yml`          | PR, push    | ESLint + Prettier + Vitest (Node.js 20/22 매트릭스)         |
| `release.yml`     | `main` push | semantic-release → CHANGELOG → NPM publish → GitHub Release |
| `deploy-docs.yml` | `main` push | VitePress build → GitHub Pages                              |

커밋 메시지 한 줄로 lint → test → build → CHANGELOG 생성 → NPM 배포 → 문서 배포가 자동 완결된다.

### 테스트

12개 테스트 스위트로 Core, Domain, Network, Plugins, UI, Workers, Common 전 레이어를 커버한다.
Vitest + jsdom + happy-dom 환경에서 실행하며, `@vitest/coverage-v8`으로 커버리지를 측정한다.

### 문서화

- **VitePress 기반 공식 문서 사이트** — Guide 15페이지 + Architecture 6페이지 + API Reference(TypeDoc 자동생성) + Interactive Playground 11종
- **Vue Playground 컴포넌트** — MockApiHandler로 실제 백엔드 없이 라이브러리 동작을 문서 페이지 내에서 시연
- **Decision Log** — ARD(아키텍처 결정 레코드) 4편 + IMPL(구현 의사결정) 5편. 각 결정의 배경, 대안, 기각 이유 기록

---

## 6. 설계 의사결정 — 처음 틀렸던 것들

### changeLog 기반 HTTP 분기 — 의미론적 오류

초기에 `changeLog.length === 0 → PUT`으로 분기했다. RFC를 공부하고 나서야 이것이 HTTP 메서드의 의미론과 어긋난다는 것을 깨달았다. "변경 이력 없음"은 "의도적 재저장"이지 "전체 교체 필요"가 아니다. `dirtyFields` 비율 기반 분기로 교체했다.

### 전역 변수로 순환 참조 해소

`DomainState`와 `DomainPipeline`의 상호 참조를 `globalThis.__DSM_DomainPipeline`으로 해소한 것은 설계가 꼬였다는 자증이었다. 생성자 주입 → Composition Root DI의 3단계를 거쳐 현재 `configure({ pipelineFactory })` 패턴에 안착했다.

### isMuting 플래그의 얕은 복사

배열 변이 추적 시 원본 배열을 얕은 복사한 뒤 `isMuting` 플래그로 set 트랩을 차단하는 방식은 루프 안에서 임시 객체를 생성한다. V8 최적화에 반하는 이 방식을 배열 메서드 완료 후 Delta를 수학적으로 계산하는 알고리즘으로 전면 교체했다.

### `save()` 스냅샷의 Worker 오프로딩 검토 → 기각

`structuredClone`을 Worker로 오프로딩하면 clone 완료 전 소비자가 데이터를 변경할 수 있어 스냅샷 시점 보장이 깨진다. "동기적으로 실행해야 한다"는 결론을 내리고, 대신 `lazy` diff 연산을 Worker로 오프로딩했다. Proxy set 트랩이 changeLog 기록을 건너뛰는 `lazy` 모드의 특성 덕분에 타이밍 충돌이 발생하지 않는다.

---

## 7. 핵심 트레이드오프

### `structuredClone`의 동기 비용

`save()` 진입마다 DTO 전체를 동기적으로 깊은 복사한다. 필드 수백 개의 거대한 DTO에서 메인 스레드를 잠시 차단할 수 있다. 트레이드오프를 JSDoc에 명시했으며, Worker 오프로딩이 불가능한 이유를 Decision Log에 기록했다.

### ESM + CJS Dual Package

ESM-only를 검토했으나, `BroadcastChannel`을 글로벌하게 관리하는 특성상 CJS와 ESM이 동시 로드되면 채널 인스턴스가 이중화되는 Dual Package Hazard가 치명적이다. CJS 번들을 유지하되 `"type": "module"` + `"sideEffects": false`로 ESM 우선 사용을 유도하는 절충안을 선택했다.

### DomainState 1400줄 — God Class 인지

`DomainState.js`가 Proxy 추적, HTTP 분기, 스냅샷, Shadow State, 디버그 브로드캐스팅, DI, React 어댑터, Idempotency-Key, Lazy Mode를 모두 담고 있다. ard-0003에서 Core-Adapter 분리 방향을 확정했으며, v2.0.0에서 `DomainState`를 순수 Orchestrator로 경량화할 계획이다.

---

## 8. 정량 지표

| 지표                 | 수치                                          |
| -------------------- | --------------------------------------------- |
| 소스 파일 수         | `src/` 하위 27개 모듈                         |
| 테스트 스위트        | 12개 파일                                     |
| NPM 버전             | v1.2.3 (semantic versioning)                  |
| Runtime Dependencies | **0** (zero-dependency)                       |
| devDependencies      | 18개 패키지                                   |
| 빌드 산출물          | ESM (.mjs) + CJS (.cjs) + d.ts                |
| VitePress 문서       | Guide 15p + Architecture 6p + Playground 11종 |
| Decision Log         | ARD 4편 + IMPL 5편                            |
| CI/CD Workflow       | 3개 (ci, release, deploy-docs)                |

---

## 9. 회고

이 프로젝트를 시작하기 전에 나는 JavaScript를 "쓸 수 있는" 사람이었다. 4개의 애자일 사이클을 거친 지금은 JavaScript가 **어떻게 동작하는지**를 고민하며 작업할 수 있는 사람이 됐다고 생각한다.

V8 엔진의 Hidden Class를 의식하며 코드를 짜고, Microtask 큐를 성능 최적화에 활용하고, RFC 문서를 읽으며 HTTP 메서드의 의미론을 이해하고, LCS 알고리즘을 구현하여 배열 diff를 계산하고, BroadcastChannel의 자가 수신 제약을 역방향 프로토콜로 우회하는 경험이 모두 이 라이브러리를 만들면서 이루어졌다.

가장 중요한 것은 **의미를 생각하는 눈**을 키우는 경험을 얻었다는 점이다. 처음 구현한 `changeLog.length === 0 → PUT` 로직은 동작했다. 하지만 올바르지 않았다. `globalThis` 전역변수는 동작했다. 하지만 설계가 꼬였다는 증거였다. 그 차이를 발견하고 고치는 과정 — 그리고 **그 고친 이유를 문서로 남기는 과정** — 이 이 프로젝트의 본질이었다.

실무 프로젝트를 마치며 느꼈던 아쉬움을 보완하기 위한 학습의 일환으로 작업했다. 아키텍처 설계는 이번이 처음이라 속도가 느렸고, 구현 도중 설계를 여러 번 갈아엎었다. 외부 피드백을 받고 "기능 추가가 아니라 재포장이 필요하다"는 판단을 내린 것도 이 과정의 일부다. 그 모든 과정이 `references/ard-0000/` ~ `ard-0003/`에 기록되어 있다.

코드보다 그 기록이 내가 실제로 무엇을 고민했는지를 더 잘 보여준다고 생각한다.
