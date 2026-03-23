# REST Domain State Manager — 포트폴리오 보고서

> **작성자:** 2davi  
> **작성일:** 2026년 3월  
> **직군:** SI 사업부 신입 개발자 (실무 병행 개인 프로젝트)  
> **레포지토리:** [github.com/2davi/rest-domain-state-manager](https://github.com/2davi/rest-domain-state-manager)  
> **공식 문서:** [lab.the2davi.dev/rest-domain-state-manager](https://lab.the2davi.dev/rest-domain-state-manager)

---

## 1. 왜 이것을 만들었는가

SI/SM 환경에서 실무를 하면서 반복적으로 같은 코드를 쓰고 있다는 것을 느꼈다. GET으로 받아온 데이터를 화면에 뿌리고, 사용자가 수정하면 그 값을 다시 긁어모아 POST/PUT/PATCH 중 하나를 골라 전송하는 패턴이 모든 화면에서 반복된다.

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

이 코드의 실제 문제는 길다는 것이 아니었다. **예측 불가능하다는 것**이었다. 어떤 필드가 실제로 변경됐는지 코드에서 보장하지 않는다. PUT을 써야 하는지 PATCH를 써야 하는지 개발자가 매번 판단해야 하고, 그 판단이 잘못되어도 컴파일 타임에는 아무 에러가 없다.

이 반복과 불확실성을 라이브러리 수준에서 한 번에 해결해보고 싶었다. 동시에, 그 과정에서 내가 알고 싶었던 JavaScript 엔진의 동작 원리들을 직접 적용하는 실습 프로젝트로 삼았다.

---

## 2. 무엇을 배우고 적용했는가

### 2-1. JS Proxy와 V8 엔진의 Hidden Class

**학습 배경:** Proxy API의 존재는 알고 있었지만, Proxy 내부에서 잘못된 코드를 작성하면 V8 엔진의 최적화를 오히려 방해한다는 사실은 몰랐다.

**핵심 개념:**

V8 엔진은 동적 타입 언어인 JavaScript의 성능 한계를 극복하기 위해 객체가 생성될 때 내부적으로 **Hidden Class(Maps)** 를 만든다. 동일한 프로퍼티를 동일한 순서로 가진 객체들은 같은 Hidden Class를 공유하며, 프로퍼티 접근 시 메모리 오프셋을 캐싱하는 **Inline Caching(IC)** 으로 $O(1)$ 에 가까운 속도를 낸다.

문제는 REST API 응답을 동적으로 파싱해서 빈 객체에 프로퍼티를 추가하면, 프로퍼티 추가 순서가 요청마다 달라질 수 있고 V8의 Hidden Class가 매번 새로 생성된다는 것이다. V8 최적화 컴파일러인 TurboFan은 이를 "예측 불가능한 코드"로 판단하고 최적화를 포기한다(Deoptimization).

**적용 방법:**

`DomainVO` 를 단순 유효성 검사기가 아니라 **객체의 Shape을 고정하는 거푸집**으로 설계했다. `static fields` 에 선언된 모든 프로퍼티가 생성 시점에 동일한 순서로 초기화되므로, 서버 응답이 오기 전에 이미 Hidden Class가 확정된다.

```javascript
class UserVO extends DomainVO {
    static fields = {
        userId:  { default: '' },   // 순서 1 고정
        name:    { default: '' },   // 순서 2 고정
        email:   { default: '' },   // 순서 3 고정
    }
}
// DomainState.fromVO(new UserVO(), api) 로 생성된 모든 인스턴스가
// 동일한 Hidden Class를 공유한다.
```

추가로, Proxy 트랩 내부에서 `target[prop]` 으로 직접 접근하는 대신 `Reflect.get(target, prop, receiver)` 를 전면 도입했다. `receiver` 인자가 없으면 상속 구조에서 `this` 바인딩이 원본 `target` 으로 고정되어 Context Loss 버그가 발생할 수 있다. Reflect API는 이 문제를 언어 명세 수준에서 보장한다.

**WeakMap 기반 Lazy Proxying:**

중첩 객체에 접근할 때마다 새 Proxy를 생성하면 두 가지 문제가 발생한다. 힙 할당이 반복되어 GC 압력이 높아지고, 같은 객체를 두 번 접근하면 서로 다른 Proxy 인스턴스가 반환되어 `===` 동일성 비교가 깨진다. `proxyCache WeakMap` 이 두 문제를 모두 해결한다. 원본 객체가 GC될 때 WeakMap의 캐시 항목도 자동으로 정리되므로 메모리 누수가 없다.

---

### 2-2. REST 멱등성과 RFC 6902 JSON Patch

**학습 배경:** PUT과 PATCH를 "전체 수정 vs 부분 수정"으로만 이해하고 있었다. 멱등성(Idempotency)이라는 개념이 실제로 API 설계에서 어떤 의미를 갖는지 몰랐다.

**핵심 개념:**

RFC 7231에 따르면 HTTP 메서드는 단순한 액션 지시자가 아니라, **리소스에 대한 의도와 부작용의 범위를 서버-클라이언트 간에 약속하는 규약**이다.

- **POST(RFC 7231 §4.3.3):** 비멱등. 같은 요청을 두 번 보내면 두 개의 리소스가 생성될 수 있다.
- **PUT(RFC 7231 §4.3.4):** 멱등. 같은 요청을 여러 번 보내도 결과가 동일하다. 타겟 리소스를 **완전히 교체**한다. 일부 필드만 보내면 나머지 필드가 서버에서 삭제될 수 있다.
- **PATCH(RFC 5789):** 부분 수정. 변경된 부분만 병합한다.

기존 코드에서 `changeLog.length === 0 → PUT` 으로 분기하던 로직은 의미론적으로 잘못된 것이었다. "변경 이력이 없다"는 것이 "전체 교체가 필요하다"를 의미하지 않는다.

**적용 방법:**

Java Hibernate의 Dirty Checking 메커니즘을 참고하여 `_dirtyFields: Set<string>` 을 도입했다. `changeLog` 와 역할을 명확히 분리했다.

| \        | `changeLog`                    | `_dirtyFields`           |
| -------- | ------------------------------ | ------------------------ |
| 목적     | RFC 6902 PATCH 페이로드 직렬화 | PUT/PATCH 분기 비율 계산 |
| 자료구조 | `ChangeLogEntry[]`             | `Set<string>`            |

PATCH 전송 시 페이로드는 RFC 6902 JSON Patch 표준을 완벽히 준수한다.

```json
[
    { "op": "replace", "path": "/name",         "value": "Davi" },
    { "op": "replace", "path": "/address/city", "value": "Seoul" }
]
```

`DIRTY_THRESHOLD = 0.7` 을 도입한 이유: 변경된 필드가 70% 이상이면 JSON Patch 배열의 직렬화 오버헤드가 전체 객체를 한 번에 PUT으로 보내는 것보다 비효율적이기 때문이다.

---

### 2-3. JavaScript 이벤트 루프와 Microtask 배칭

**학습 배경:** `Promise`, `setTimeout`, `queueMicrotask` 의 실행 순서 차이를 개념적으로만 알고 있었다. 실제로 이것을 성능 최적화에 활용하는 패턴은 처음 구현해봤다.

**핵심 개념:**

JavaScript 이벤트 루프에서 Microtask는 **Call Stack이 완전히 비워진 직후, 다음 Task가 실행되기 전**에 처리된다. 이 특성을 이용하면 동기 블록 안의 모든 상태 변경을 기다렸다가 마지막에 딱 한 번 사이드 이펙트를 실행할 수 있다.

기존 코드는 3개의 필드를 수정하면 `BroadcastChannel.postMessage()` 가 3번 호출되고 DTO 전체가 3번 직렬화됐다. Structured Clone Algorithm은 호출마다 실행되므로 불필요한 연산이었다.

**적용 방법:**

`queueMicrotask()` 기반의 `_scheduleFlush()` 스케줄러를 구현했다. `_pendingFlush` 플래그로 중복 예약을 차단하고, Call Stack이 비워지면 단 한 번만 `_broadcast()` 가 실행된다.

`Promise.resolve().then()` 대신 `queueMicrotask()` 를 선택한 근거: Promise 객체 생성/GC 오버헤드가 없고, "microtask에 직접 예약한다"는 의도가 코드에서 명시적으로 드러난다.

```text
// Before: 3번 직렬화
proxy.name  = 'A' → _broadcast() → postMessage(DTO)
proxy.email = 'B' → _broadcast() → postMessage(DTO)
proxy.role  = 'C' → _broadcast() → postMessage(DTO)

// After: 1번 직렬화
proxy.name  = 'A' → _scheduleFlush() → (microtask 예약)
proxy.email = 'B' → _scheduleFlush() → (이미 예약됨, 건너뜀)
proxy.role  = 'C' → _scheduleFlush() → (이미 예약됨, 건너뜀)
[Call Stack 비워짐] → flush() → _broadcast() → postMessage(DTO)
```

---

### 2-4. Optimistic Update 패턴과 structuredClone

**학습 배경:** "낙관적 업데이트"라는 패턴을 React Query나 SWR 설명에서 읽어본 적은 있었다. 직접 클로저 수준에서 구현하는 것은 이번이 처음이었다.

**핵심 개념:**

HTTP 요청이 실패하면 클라이언트 상태를 요청 이전으로 되돌려야 한다. 문제는 Proxy가 이미 원본 `domainObject` 를 변경한 상태라는 것이다. 롤백을 위해 네 개의 상태를 모두 save() 진입 직전 시점으로 복원해야 한다.

`domainObject` 는 `createProxy()` 클로저 안에 격리되어 있다. 외부에서 참조 자체를 교체하는 것은 클로저 원리상 불가능하므로, **참조가 가리키는 객체의 내부 프로퍼티를 직접 교체**하는 방식을 선택했다.

`structuredClone()` 으로 깊은 복사 스냅샷을 생성한 이유: REST API JSON 응답 데이터는 순수 JSON-compatible 값이므로 structuredClone의 제약(함수, DOM 노드, Symbol 불가)이 문제가 되지 않고, `JSON.parse(JSON.stringify())` 보다 직렬화 횟수가 1회 적으며 네이티브 구현으로 더 빠르다.

복원 과정이 Proxy 트랩을 우회하여 직접 원본 객체를 수정한다는 점이 핵심이다. 이 복원 작업 자체가 `changeLog` 에 기록되지 않으며, 이것이 의도된 동작이다.

---

### 2-5. BroadcastChannel API와 멀티탭 통신

**학습 배경:** 이름은 들어봤지만 실제로 써본 적이 없었다. 멀티탭 환경에서 발생하는 메모리 누수 패턴을 처음 의식하게 된 계기이기도 하다.

**핵심 개념과 설계 결정:**

`BroadcastChannel` 은 자신이 보낸 메시지를 자기 자신이 수신할 수 없다. 이 제약으로 인해 디버그 팝업이 열릴 때 자신이 `TAB_REGISTER` 를 직접 broadcast할 수 없었다. 팝업이 `TAB_PING` 을 먼저 보내고 각 탭이 `TAB_REGISTER` 로 응답하는 역방향 구조로 해결했다.

`beforeunload` 이벤트가 모바일 브라우저나 OOM으로 무시되는 경우를 대비해 Heartbeat GC를 구현했다. 팝업이 2초마다 PING을 broadcast하고 5초 이상 응답이 없는 탭을 자동으로 레지스트리에서 제거한다. SPA 환경에서는 `closeDebugChannel()` 로 명시적으로 채널을 닫아 GC를 돕는다.

또 다른 도전은 VitePress SSR과의 충돌이었다. VitePress 빌드 시 Node.js 환경에서 HTML을 pre-render할 때 `window`, `BroadcastChannel` 참조가 있으면 `ReferenceError` 가 발생한다. 모듈 최상위의 모든 브라우저 API 초기화 코드를 `initDebugChannel()` 함수 안에 캡슐화하고, `broadcastUpdate()` 첫 호출 시점에 lazy하게 실행하도록 수정해서 해결했다.

---

## 3. 구현 결과물

### 테스트 스위트

단순히 "동작한다"는 것을 넘어 **의도한 계약이 보장된다**는 것을 증명하기 위해 45개의 단위 테스트 케이스를 작성했다.

| 레이어               | 케이스 수 | 검증 내용                                                   |
| -------------------- | --------- | ----------------------------------------------------------- |
| Core (api-proxy)     | 15        | set/get/delete 트랩, 배열 변이 10종, dirtyFields 추출       |
| Domain (DomainState) | 19        | 팩토리 3종, save() 분기 5케이스, 롤백 4케이스, 배칭 2케이스 |
| Network (ApiHandler) | 4         | URL 빌드, 프로토콜 결정, HTTP 에러 처리                     |
| Plugins              | 7         | FormBinder 이벤트 타이밍, DomainRenderer 4종                |

```text
✓ 79/79 테스트 통과
```

### CI/CD 파이프라인

커밋 메시지 한 줄로 lint → test → build → CHANGELOG 생성 → NPM 배포 → GitHub Release 생성이 자동 완결된다.

- **ESLint 9 Flat Config** — `no-unused-vars`, `no-console`, `no-var`, `eqeqeq`, JSDoc 품질 규칙
- **Prettier** — LF 강제, 4칸 들여쓰기, trailing comma(es5) 등 프로젝트 스타일 확정
- **GitHub Actions** — Node.js 20/22 매트릭스로 CI. main 브랜치 push 시 semantic-release 자동 실행
- **semantic-release** — Conventional Commits 파싱으로 버전 자동 결정. `feat:` → minor, `fix:` → patch

### 문서화

VitePress 기반 공식 문서 사이트를 직접 구축했다.

- **가이드 페이지 10개** — 설치부터 고급 기능까지 단계별 서술
- **Architecture 페이지 6개** — Proxy 엔진 내부 구조, HTTP 라우팅 알고리즘, V8 최적화 전략 등을 RFC 문서 스타일로 작성
- **Interactive Playground 4종** — Vue 컴포넌트로 구현. 문서 페이지 안에서 라이브러리가 실제로 동작하는 것을 확인할 수 있다. MockApiHandler로 실제 백엔드 없이 시연 가능
- **Decision Log 7편** — ARD(아키텍처 결정 레코드) 2편 + IMPL(구현 의사결정) 5편. 각 결정의 배경, 검토한 대안, 기각 이유까지 기록
- **TypeDoc API 레퍼런스** — JSDoc 주석으로부터 자동 생성. CI 파이프라인에서 매 빌드마다 최신 상태로 갱신
- **GitHub Actions 자동 배포** — `main` 브랜치 push 시 VitePress 빌드 결과가 `lab.the2davi.dev` 에 자동 반영

---

## 4. 설계 의사결정 과정

### 처음 틀렸던 것들

**changeLog 기반 분기 — 의미론적 오류:** 초기 구현에서 `changeLog.length === 0 → PUT` 으로 분기했다. "변경 이력이 없으면 전체 교체" 라는 논리인데, RFC를 공부하고 나서야 이것이 HTTP 메서드의 의미론과 완전히 어긋난다는 것을 깨달았다. "변경 이력 없음"은 "의도적 재저장"이지, "전체 교체가 필요함"이 아니다.

**전역 변수로 순환 참조 해소:** 초기에 `DomainState` 와 `DomainPipeline` 의 상호 참조를 `globalThis.__DSM_DomainPipeline` 전역 변수로 해소하는 꼼수를 썼다. 테스트 환경 오염, 모듈 시스템과의 불일치 등 여러 문제가 있었고, 진입점에서 `DomainState.PipelineConstructor = DomainPipeline` 으로 런타임에 주입하는 생성자 주입(Constructor Injection) 패턴으로 교체했다.

**isMuting 플래그로 배열 변이 추적:** 초기에는 배열 메서드 실행 전에 얕은 복사를 만들어두고 `isMuting` 플래그로 `set` 트랩의 `changeLog` 기록을 차단하는 방식을 썼다. 루프 안에서 임시 객체를 생성하는 이 방식이 V8 최적화에 반한다는 것을 깨달은 후, 배열 메서드 완료 후 수학적으로 Delta를 계산해서 `record()` 를 직접 호출하는 방식으로 전면 교체했다.

### 핵심 트레이드오프

**`structuredClone` 의 동기 비용:** `save()` 진입마다 DTO 전체를 동기적으로 깊은 복사한다. 거대한 DTO에서 메인 스레드를 잠시 차단할 수 있다. `WeakRef` 기반의 lazy snapshot 같은 대안을 검토했으나 구현 복잡도 대비 실익이 없다고 판단, 트레이드오프를 JSDoc에 명시하는 방향을 택했다.

**ESM-only, CJS 지원 중단 결정:** Node.js 22에서 ESM을 `require()` 할 수 있게 된 상황을 고려해 ESM-only를 검토했다. 그러나 이 라이브러리가 `BroadcastChannel` 을 글로벌하게 관리하는 특성상, CJS와 ESM이 동시에 로드되면 두 개의 채널 인스턴스가 생기는 Dual Package Hazard가 치명적이다. 빌드 결과에 CJS 번들은 유지하되 `"sideEffects": false` 와 `"type": "module"` 로 ESM 우선 사용을 유도하는 절충안을 선택했다.

---

## 5. 회고

이 프로젝트를 시작하기 전에 나는 JavaScript를 "쓸 수 있는" 사람이었다. 프로젝트를 마친 후에는 JavaScript가 **어떻게 동작하는지**를 조금 더 알게 된 사람이 됐다고 생각한다.

V8 엔진의 Hidden Class를 의식하며 코드를 짜고, 이벤트 루프의 Microtask 큐를 성능 최적화에 실제로 활용하고, RFC 문서를 읽으며 HTTP 메서드의 의미론을 이해하는 경험이 모두 이 라이브러리를 만들면서 처음 이루어졌다.

가장 중요한 것은 **"동작하는 것"과 "올바른 것"의 차이**를 직접 경험했다는 점이다. 처음 구현한 `changeLog.length === 0 → PUT` 로직은 동작했다. 하지만 올바르지 않았다. 그 차이를 발견하고 고치는 과정이 이 프로젝트의 본질이었다.

실무 프로젝트와 병행하며 작업했기 때문에 속도가 느렸고, 구현 도중 설계를 여러 번 갈아엎었다. 그 모든 과정이 Decision Log에 기록되어 있다. 코드보다 그 기록이 내가 실제로 무엇을 고민했는지를 더 잘 보여준다고 생각한다.
