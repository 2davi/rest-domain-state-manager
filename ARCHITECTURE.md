# REST Domain State Manager — 아키텍처 종합 설명서

> **버전:** v2.0.0 (ard-0003 완료 기준)
> **최종 갱신:** 2026-04-02
> **레포지토리:** [github.com/2davi/rest-domain-state-manager](https://github.com/2davi/rest-domain-state-manager)

본 문서는 `@2davi/rest-domain-state-manager` 라이브러리의 전체 설계 구조,
각 레이어의 역할과 책임, 데이터 흐름, 그리고 주요 의사결정 과정을 기술한다.

---

## Part 1. 설계 개요

### 1. 목표와 역할 정의

REST Domain State Manager(이하 DSM)는 프론트엔드에서 REST API 리소스를
**단일 상태 소스(Single Source of Truth)**로 관리하는 ES Module 라이브러리다.

핵심 동작 시퀀스는 다음과 같다:

1. `fetch()`로 수신한 JSON DTO를 역직렬화하여 JavaScript Object로 변환한다.
2. 이 Domain Object를 ES6 `Proxy`로 감싸, 모든 필드 변경을 RFC 6902 JSON Patch 형식으로 자동 기록한다.
3. 저장(`save()`) 시점에 변경 이력과 메타데이터를 기반으로 POST / PATCH / PUT 중 적절한 HTTP 메서드를 자동 분기한다.
4. 요청 실패 시 `structuredClone` 스냅샷 기반의 보상 트랜잭션(Compensating Transaction)으로 클라이언트 상태를 요청 이전 시점으로 복원한다.

### 2. 설계 원칙

**Zero Runtime Dependency:** 외부 라이브러리 의존 없음. `devDependencies`만 존재한다.

**Framework-Agnostic:** Core 엔진은 DOM, `fetch`, `BroadcastChannel` 등 브라우저 API에 의존하지 않는다. UI 계층(`src/ui/`)과 네트워크 계층(`src/network/`)이 환경 의존성을 흡수한다.

**V8 Inline Caching 친화적:** `DomainVO`의 `static fields`로 객체 Shape을 생성 시점에 고정하여 V8 Hidden Class 전이를 억제한다. Proxy 트랩은 `Reflect` API로 통일하여 Slow Path 진입을 최소화한다.

**Silent Failure 불허:** 잘못된 설정이나 누락된 선행 조건에서 조용히 오동작하는 대신, 즉시 명확한 에러 메시지와 함께 `Error`를 throw한다.

---

## Part 2. 레이어 아키텍처

### 1. 전체 모듈 구조

```text
index.js                             ← Composition Root (DI 주입 + named export)
│
├── src/domain/                      ← Domain Layer
│   ├── DomainState.js               ← Orchestrator: 팩토리, save/remove, Shadow State, 플러그인
│   ├── DomainVO.js                  ← Schema 계약: fields 선언, Hidden Class 거푸집
│   ├── DomainCollection.js          ← 1:N 배열 상태 컨테이너 + saveAll({ strategy: 'batch' })
│   └── DomainPipeline.js            ← 병렬 fetch + 순차 after() 체이닝
│
├── src/core/                        ← Core Engine (환경 무관, I/O 없음)
│   ├── api-proxy.js                 ← Proxy 래핑 + changeLog + dirtyFields + rollback 클로저
│   ├── api-mapper.js                ← changeLog → RFC 6902 JSON Patch 직렬화
│   └── url-resolver.js              ← URL 정규화 + 프로토콜 결정 + 충돌 해소
│
├── src/network/                     ← Network Layer (브라우저 fetch 의존)
│   └── api-handler.js               ← HTTP 전송, CSRF 3-상태, Idempotency-Key 옵션
│
├── src/ui/                          ← UI Layer (DOM 의존)
│   ├── UIComposer.js                ← 플러그인 진입점: DomainState.use(UIComposer)
│   ├── UILayout.js                  ← UI 계약 선언 베이스 클래스
│   └── collection/
│       └── CollectionBinder.js      ← <template> 기반 그리드 DOM 바인딩 엔진
│
├── src/plugins/                     ← Legacy Plugins (v2.0.0에서 deprecated 예정)
│   ├── domain-renderer/             ← DomainRenderer (select/radio/checkbox/button 렌더링)
│   └── form-binder/                 ← FormBinder (HTML Form ↔ DomainState 양방향 바인딩)
│
├── src/adapters/                    ← Framework Adapters
│   └── react.js                     ← useDomainState() — useSyncExternalStore 기반 훅
│
├── src/workers/                     ← Web Worker Layer (메인 스레드 오프로딩)
│   ├── serializer.worker.js         ← _stateRegistry 직렬화 (BroadcastChannel 탭 등록)
│   ├── diff.worker.js               ← lazy tracking mode diff 연산
│   └── diff-worker-client.js        ← Promise 기반 Worker 통신 클라이언트
│
├── src/debug/                       ← Debug Layer
│   └── debug-channel.js             ← BroadcastChannel 디버그 팝업 (HeartBeat + GC)
│
├── src/common/                      ← Shared Utilities
│   ├── js-object-util.js            ← isPlainObject, isArray, shouldBypassDeepProxy 등
│   ├── clone.js                     ← safeClone() (structuredClone 래퍼 + JSON 폴백)
│   ├── freeze.js                    ← deepFreeze, maybeDeepFreeze (Shadow State 동결)
│   ├── lcs-diff.js                  ← LCS 알고리즘 기반 deep diff (lazy mode용)
│   └── logger.js                    ← devWarn, logError, setSilent, isSilent
│
└── src/constants/                   ← 상수 정의
    ├── op.const.js                  ← OP enum (ADD, REPLACE, REMOVE)
    ├── dirty.const.js               ← DIRTY_THRESHOLD (PUT/PATCH 분기 임계값 0.7)
    ├── protocol.const.js            ← PROTOCOL enum, ENV enum, DEFAULT_PROTOCOL
    ├── channel.const.js             ← BroadcastChannel 메시지 타입, 팝업 설정
    ├── error.messages.js            ← ERR 네임스페이스 (에러 메시지 중앙 관리)
    └── log.messages.js              ← LOG 네임스페이스 + formatMessage 포맷터
```

### 2. 의존성 방향 규칙

```text
index.js (Composition Root)
    │
    ├─→ domain/     ─→ core/     ─→ constants/
    │                ─→ common/
    │
    ├─→ network/    ─→ domain/   ─→ core/
    │
    ├─→ ui/         ─→ domain/   (런타임 import 아닌 JSDoc 타입 참조만)
    │
    ├─→ workers/    ─→ common/
    │
    ├─→ debug/      ─→ constants/
    │
    └─→ plugins/    ─→ domain/
```

**위반 금지 규칙:**

- `core/` → `domain/` 방향 참조 금지. Core는 환경과 도메인 로직에 무관하게 동작해야 한다.
- `domain/DomainState.js` → `domain/DomainPipeline.js` 직접 import 금지. Composition Root(`index.js`)에서 `configure({ pipelineFactory })`로 팩토리를 주입한다.
- `ui/collection/CollectionBinder.js` → `domain/DomainCollection.js` 런타임 import 금지. JSDoc `@typedef` 타입 참조만 사용한다.

---

## Part 3. 핵심 엔진 상세

### 1. Proxy 변경 추적 엔진 (`api-proxy.js`)

`createProxy(domainObject, onMutate, trackingMode)`는 순수 JS 객체를 Proxy로 감싸
모든 필드 변경을 자동 기록하는 엔진이다.

#### 1.1. 클로저 격리 ("도개교 세트")

`createProxy()`는 9개의 클로저 함수를 반환하는 `ProxyWrapper` 객체를 생성한다.
외부에는 `proxy`만 공개되며, 나머지 8개(`getChangeLog`, `getTarget`, `clearChangeLog`,
`getDirtyFields`, `clearDirtyFields`, `restoreTarget`, `restoreChangeLog`, `restoreDirtyFields`)는
`DomainState` 생성자 내부에 은닉된다.

```text
createProxy(obj, onMutate, trackingMode)
  ├─ changeLog[]          클로저 — RFC 6902 변경 이력 저장소
  ├─ dirtyFields Set      클로저 — 변경된 최상위 키 집합 (PUT/PATCH 분기용)
  ├─ proxyCache WeakMap   클로저 — 중첩 Proxy 캐시 (Lazy Proxying)
  ├─ isMuting boolean     클로저 — 배열 변이 중 set 트랩 무시 플래그
  ├─ record()             내부 함수 — 변경 이력 기록 + dirtyFields 갱신
  ├─ makeHandler()        내부 함수 — 트랩 핸들러 팩토리 (basePath 누적)
  │
  └─ return ProxyWrapper
       ├─ proxy              new Proxy(obj, makeHandler(''))
       ├─ getChangeLog       () => [...changeLog]
       ├─ getTarget          () => obj
       ├─ clearChangeLog     () => void (changeLog.length = 0)
       ├─ getDirtyFields     () => new Set(dirtyFields)
       ├─ clearDirtyFields   () => dirtyFields.clear()
       ├─ restoreTarget      (data) => { /* 원본 교체 (Proxy 우회) */ }
       ├─ restoreChangeLog   (entries) => { /* 이력 교체 */ }
       └─ restoreDirtyFields (fields) => { /* dirtyFields 교체 */ }
```

#### 1.2. 트랩 동작

**`get` 트랩:**

- `Symbol`, `toJSON`, `then`, `valueOf`는 바이패스 — `JSON.stringify` 및 Promise 체인 보존.
- 반환값이 plain object 또는 배열이면 `proxyCache WeakMap`을 확인한 뒤 Lazy Proxy로 재래핑.
- 배열 변이 메서드(`shift`, `unshift`, `splice`, `sort`, `reverse`)는 래퍼 함수로 가로채어
  `isMuting = true`로 set 트랩을 비활성화한 뒤, 변경된 범위만 Delta 계산하여 `record()`.
- `push`/`pop`은 set 트랩의 자연스러운 동작으로 정확히 추적되므로 래핑하지 않음.

**`set` 트랩:**

- `isMuting === true`이면 원본 반영만 하고 changeLog 기록 건너뜀.
- `trackingMode === 'lazy'`이면 changeLog/dirtyFields 기록을 건너뜀. `onMutate` 콜백은 호출됨.
- 기존에 없던 키 → `op: 'add'`, 기존 키 값 변경 → `op: 'replace'`.
- `Reflect.set(target, prop, value, receiver)` 사용 — 프로토타입 체인 `this` 바인딩 보존.

**`deleteProperty` 트랩:**

- 존재하지 않는 키 삭제는 조용히 `true` 반환 (Proxy 명세 준수).
- 존재하는 키 → `op: 'remove'`, `oldValue` 기록.

#### 1.3. 배열 변이 Delta 알고리즘

| 메서드            | Delta 계산 전략                                                              |
| ----------------- | ---------------------------------------------------------------------------- |
| `shift`           | `REMOVE /basePath/0` + 나머지 인덱스 전체 `REPLACE`                          |
| `unshift`         | 삽입된 요소 수만큼 `ADD /basePath/idx`                                       |
| `splice`          | `REMOVE /basePath/startIdx` × 삭제 수 + `ADD /basePath/startIdx+i` × 추가 수 |
| `sort`, `reverse` | 배열 전체 단일 `REPLACE /basePath` (인덱스 단위 추적 불가)                   |

#### 1.4. 경로 누적

```text
proxy.address.city = 'Seoul'
  → get 트랩: prop='address', basePath='' → childPath='/address' → Lazy Proxy 생성/캐시
  → set 트랩: prop='city', basePath='/address' → path='/address/city' → changeLog에 기록
```

### 2. HTTP 메서드 자동 분기 (`DomainState.save()`)

```text
save(requestPath?)
  │
  ├─ isNew === true
  │   └─ POST  (toPayload — 전체 객체 직렬화)
  │
  └─ isNew === false
      │
      ├─ dirtyFields.size === 0
      │   └─ 변경 없음 → save() 조기 종료 (no-op)
      │
      ├─ dirtyFields.size / totalFields >= DIRTY_THRESHOLD (0.7)
      │   └─ PUT  (toPayload — 전체 객체 직렬화)
      │
      └─ dirtyFields.size / totalFields < DIRTY_THRESHOLD
          └─ PATCH (toPatch — RFC 6902 JSON Patch 배열)
```

POST 성공 후 `isNew = false`로 전환된다.
PATCH/PUT 성공 후 `clearChangeLog()` + `clearDirtyFields()`가 쌍으로 호출된다.

### 3. Lazy Tracking Mode와 LCS Diff

#### 3.1. 두 가지 추적 모드

| 모드                | Proxy set 트랩 동작                 | save() 시점 changeLog                               |
| ------------------- | ----------------------------------- | --------------------------------------------------- |
| `'realtime'` (기본) | changeLog + dirtyFields에 즉시 기록 | 누적된 이력 그대로 사용                             |
| `'lazy'`            | 기록 건너뜀. onMutate 콜백만 호출   | `_initialSnapshot`과 현재 상태를 deep diff하여 생성 |

`lazy` 모드의 장점: 동일 필드를 10번 변경해도 최종 변경 결과 1건만 PATCH payload에 포함.

#### 3.2. LCS 알고리즘 (`lcs-diff.js`)

`deepDiff(initial, current, itemKey)` 함수는 두 객체를 재귀적으로 비교하여
RFC 6902 형식의 `ChangeLogEntry[]`를 반환한다.

배열 비교 시 `itemKey` 유무에 따라 전략이 분기된다:

- `itemKey` 지정: LCS(Longest Common Subsequence) DP 테이블을 구성하여
  항목 동일성(itemKey 필드값 기준)을 판단한다. 위치가 달라도 같은 항목으로 인식.
- `itemKey` 미지정: positional 비교. 같은 인덱스의 값이 다르면 `replace`.

#### 3.3. Worker 오프로딩 (`diff-worker-client.js`)

브라우저 환경에서는 `diff.worker.js`에 diff 연산을 오프로딩한다.
각 요청에 `_requestId`를 부여하고 `_pending Map`으로 동시성을 관리한다.

Node.js/Vitest 환경에서는 Worker 없이 `deepDiff()`를 동기 폴백으로 실행한다.
Promise로 감싸 반환하므로 `await` 호출 코드가 동일하게 동작한다.

### 4. 보상 트랜잭션 (Optimistic Update + Rollback)

```text
save() 진입
  │
  ├─ #snapshot = structuredClone(현재 상태 4종)
  │   ├─ data:        domainObject 깊은 복사
  │   ├─ changeLog:   [...changeLog]
  │   ├─ dirtyFields: new Set(dirtyFields)
  │   └─ isNew:       boolean
  │
  ├─ Idempotency-Key 발급 (handler._idempotent === true일 때)
  │
  ├─ HTTP 요청 전송 (ApiHandler._fetch)
  │
  ├─ 성공 경로:
  │   ├─ clearChangeLog() + clearDirtyFields()
  │   ├─ isNew = false
  │   ├─ #idempotencyKey = undefined
  │   └─ lazy 모드: _initialSnapshot 갱신
  │
  └─ 실패 경로:
      ├─ _rollback(#snapshot) — 4종 전체 복원 (Proxy 우회)
      ├─ #idempotencyKey 유지 (재시도 시 동일 UUID)
      └─ Error re-throw
```

`_rollback()`은 `restoreTarget()`으로 Proxy가 아닌 원본 `domainObject`에 직접 접근하므로
복원 작업 자체가 changeLog에 기록되지 않는다.

### 5. Shadow State + Structural Sharing

React `useSyncExternalStore` 규약을 만족하기 위한 불변 스냅샷 시스템.

```text
Proxy 변경 발생
  → onMutate() → _scheduleFlush()
  → queueMicrotask → flush:
      1. _buildSnapshot(currentData, prevSnapshot)
         ├─ dirtyFields 없음 + prevSnapshot 존재 → prevSnapshot 참조 그대로 반환
         └─ dirtyFields 있음 → 변경 키만 얕은 복사, 나머지 참조 재사용
      2. newSnapshot !== #shadowCache 이면:
         ├─ #shadowCache = maybeDeepFreeze(newSnapshot)
         └─ _notifyListeners() → React 리렌더 트리거
      3. debug === true → _broadcast()
```

`_buildSnapshot()`이 동일 참조를 반환하면 `#shadowCache` 갱신과 리스너 알림을 건너뛴다.
이것이 `useSyncExternalStore` 무한루프의 근본 방어선이다.

### 6. Microtask Batching (`_scheduleFlush`)

```text
proxy.name  = 'A' → _scheduleFlush() → queueMicrotask 예약 (_pendingFlush = true)
proxy.email = 'B' → _scheduleFlush() → _pendingFlush === true → 건너뜀
proxy.role  = 'C' → _scheduleFlush() → _pendingFlush === true → 건너뜀
[Call Stack 비워짐] → Microtask 실행 → flush 1회 → Shadow State 재빌드 + broadcast 1회
```

`_pendingFlush` 플래그를 flush 실행 직전(콜백 최상단)에 `false`로 초기화한다.
flush 내부에서 추가 변경이 발생하는 극단적 케이스에서도 다음 flush가 정상 예약된다.

### 7. CSRF 3-상태 설계 (`ApiHandler`)

`#csrfToken` private field의 3-상태:

| 상태        | 의미                             | `_fetch()` 동작                     |
| ----------- | -------------------------------- | ----------------------------------- |
| `undefined` | `init()` 미호출. CSRF 비활성.    | 토큰 삽입 로직 전체 건너뜀          |
| `null`      | `init()` 호출됨. 토큰 파싱 실패. | 뮤테이션 요청 시 즉시 `Error` throw |
| `string`    | 정상 파싱된 토큰 값              | `X-CSRF-Token` 헤더 자동 주입       |

`MUTATING_METHODS Set`(`POST`, `PUT`, `PATCH`, `DELETE`)에 해당하는 요청에만 토큰을 삽입한다.
Safe Method(`GET`, `HEAD`, `OPTIONS`)는 OWASP CSRF Prevention Cheat Sheet에 따라 제외.

토큰 탐색 우선순위: `<meta name="csrf-token">` DOM → `document.cookie` 이름 매칭.

### 8. Idempotency-Key 생명주기

`#idempotencyKey` private field의 2-상태:

| 상태            | 의미                                      | `save()` 동작                    |
| --------------- | ----------------------------------------- | -------------------------------- |
| `undefined`     | 기능 비활성 또는 이전 요청 성공 후 초기화 | 헤더 미삽입                      |
| `string` (UUID) | 요청 진행 중 또는 실패 후 재시도 대기     | `Idempotency-Key` 헤더 자동 주입 |

CSRF의 3-상태와 의도적으로 차별화: "파싱 실패" 시나리오가 없으므로 2-상태로 단순화.
`crypto.randomUUID()` 1순위 사용, 구형 브라우저에서는 `Math.random()` 기반 폴백 + `devWarn`.

### 9. DI Container — Composition Root 패턴

`DomainState`와 `DomainPipeline`의 순환 참조를 제거하기 위한 설계:

```text
index.js (Composition Root)
  ├─ import { DomainState }    from './src/domain/DomainState.js'
  ├─ import { DomainPipeline } from './src/domain/DomainPipeline.js'
  │
  └─ DomainState.configure({
         pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options)
     })
```

`DomainState.js`는 `DomainPipeline.js`를 import하지 않는다.
`_pipelineFactory`는 모듈 스코프 클로저 변수로 외부에서 직접 접근하거나 덮어쓸 수 없다.
`DomainState.all()`은 이 팩토리만 호출할 뿐, `DomainPipeline`의 존재를 알지 못한다.

`configure()`는 `pipelineFactory` 외에 `silent` 플래그도 수용한다.
`pipelineFactory !== undefined` 조건 검증으로 `configure({ silent: true })`만 단독 호출해도 에러 없음.

---

## Part 4. UI 레이어 상세

### 1. UILayout — UI 계약 선언

`DomainVO`가 데이터 계약(Shape 고정)을 선언하듯, `UILayout`은 UI 계약을 선언한다.
동일한 `DomainVO`로 등록 폼, 목록 화면, 상세 팝업 각각 다른 `UILayout`을 선언할 수 있다.

```javascript
class CertLayout extends UILayout {
    static templateSelector         = '#certRowTemplate';
    static readonlyTemplateSelector = '#certRowReadTemplate'; // 선택
    static itemKey  = 'certId';
    static columns  = {
        certId:   { selector: '[data-field="certId"]', readOnly: true },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: { selector: '[data-field="certType"]', sourceKey: 'certTypes' },
    };
}
```

HTML `<template>` 기반이므로 DOM 구조에 대한 통제권이 개발자에게 완전히 귀속된다.
라이브러리는 `selector`로 지정된 요소에 데이터를 꽂을 뿐이다.

### 2. UIComposer — 플러그인 진입점

`DomainState.use(UIComposer)` 호출 시:

- `DomainState.prototype.bindSingle()` 주입 — 단일 폼 양방향 바인딩
- `DomainCollection.prototype.bind()` 주입 — 그리드 바인딩 (CollectionBinder 위임)

### 3. CollectionBinder — 그리드 DOM 엔진

`createCollectionBinder(collection, containerEl, options)` 팩토리가 반환하는 컨트롤 함수:

| 함수                 | 역할                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `addEmpty()`         | 빈 행 추가 (DomainCollection.add + template 복제 + input 리스너) |
| `removeChecked()`    | 체크된 행 역순(LIFO) 제거 — 인덱스 밀림 방지                     |
| `removeAll()`        | 전체 행 제거                                                     |
| `selectAll(checked)` | 전체 체크박스 일괄 설정                                          |
| `invertSelection()`  | 체크 상태 반전                                                   |
| `validate()`         | `required` 필드 검증 + `is-invalid` CSS 클래스 토글              |
| `getCheckedItems()`  | 체크된 DomainState 배열 반환                                     |
| `getItems()`         | 전체 DomainState 배열 반환                                       |
| `getCount()`         | 총 행 수 반환                                                    |
| `destroy()`          | 이벤트 위임 리스너 정리 (메모리 누수 방지)                       |

개별 행 체크박스(`.dsm-checkbox`)는 컨테이너 이벤트 위임으로 처리한다.
소비자가 직접 바인딩하는 것은 허용하지 않는다.

---

## Part 5. DomainPipeline 실행 모델

```javascript
const result = await DomainState.all({
    roles: api.get('/api/roles'),
    user:  api.get('/api/users/1'),
}, { strict: false })
.after('roles', async roles => { /* 후처리 */ })
.after('user',  async user  => { /* 후처리 */ })
.run();
```

실행 단계:

1. `Promise.allSettled()`로 모든 리소스를 병렬 fetch.
   - fetch 실패는 `_errors`에 기록 (`strict: false`) 또는 즉시 reject (`strict: true`).
2. `after()` 큐를 등록 순서대로 순차 `await`.
   - 핸들러 실패도 동일한 strict 분기 적용.
3. `{ ...DomainStates, _errors? }` 반환.

보상 트랜잭션: `strict: false`에서 후속 `save()` 실패 시, 이미 성공한 인스턴스에
`restore()`를 호출할 수 있도록 `#snapshot`이 다음 `save()` 호출 시까지 유지된다.

---

## Part 6. 디버그 시스템

### BroadcastChannel 기반 멀티탭 디버그 팝업

채널명: `'dsm_debug'`. 탭 ID: `dsm_{timestamp}_{random}`.

**자가 수신 제약 우회:** BroadcastChannel은 자신이 보낸 메시지를 수신할 수 없다.
팝업(Manager)이 `TAB_PING`을 broadcast → 각 탭(Worker)이 `TAB_REGISTER`로 응답하는 역방향 구조.

**HeartBeat GC:** 팝업이 2초마다 `TAB_PING` broadcast.
5초 이상 응답 없는 탭은 레지스트리에서 강제 삭제. `beforeunload` 미실행 시나리오 방어.

**Web Worker 직렬화:** `registerTab()` 시 `_stateRegistry` 전체를 `serializer.worker.js`로 오프로딩하여
메인 스레드 직렬화 부하를 제거.

**Lazy Singleton:** 채널 인스턴스는 `broadcastUpdate()` 첫 호출 시점에 지연 생성.
VitePress SSR 환경에서 `window`, `BroadcastChannel` 참조 에러를 방지.

---

## Part 7. 빌드 및 배포

### 빌드 파이프라인

Rollup 4 기반 dual 빌드:

| 출력                    | 경로                 | 용도                     |
| ----------------------- | -------------------- | ------------------------ |
| ESM (.mjs)              | `dist/index.mjs`     | 모던 번들러, Node.js 20+ |
| CJS (.cjs)              | `dist/cjs/index.cjs` | Legacy require() 호환    |
| TypeScript 선언 (.d.ts) | `dist/index.d.ts`    | IDE 자동 완성            |

`preserveModules: true`로 소비자의 Tree-shaking 효율을 보장한다.
빌드 전용 `tsconfig.build.json`으로 `src/`와 `test/`를 분리한다.

### package.json exports 필드

```json
{
  ".": {
    "types":   "./dist/index.d.ts",
    "import":  "./dist/index.mjs",
    "require": "./dist/cjs/index.cjs"
  },
  "./adapters/react": {
    "types":   "./dist/src/adapters/react.d.ts",
    "import":  "./dist/src/adapters/react.mjs",
    "require": "./dist/cjs/src/adapters/react.cjs"
  }
}
```

`"type": "module"` + `"sideEffects": false` 선언으로 ESM 우선 사용 + Tree-shaking 허용.

### CI/CD 파이프라인

| Workflow          | 트리거      | 동작                                                        |
| ----------------- | ----------- | ----------------------------------------------------------- |
| `ci.yml`          | PR, push    | ESLint + Prettier + Vitest (Node.js 20/22 매트릭스)         |
| `release.yml`     | `main` push | semantic-release → CHANGELOG → NPM publish → GitHub Release |
| `deploy-docs.yml` | `main` push | VitePress build → GitHub Pages (`lab.the2davi.dev`)         |

---

## Part 8. 의사결정 기록 요약

### 8.1. Proxy 적용 범위

서비스/도메인 계층에서만 Proxy를 사용한다. View 계층(React, Vue)에는 불변 스냅샷(`getSnapshot()`)을 전달한다. Proxy를 직접 React State에 넣으면 얕은 비교 기반의 렌더링 전략과 충돌한다.

### 8.2. HTTP 메서드 분기

POST / PATCH / PUT 혼합 전략. `isNew` + `dirtyFields.size / totalFields` 비율로 분기.
`DIRTY_THRESHOLD = 0.7` 이상이면 JSON Patch 직렬화 오버헤드보다 전체 PUT이 효율적.

### 8.3. 변경 기록 포맷

내부 전용 포맷(`{ op, path, oldValue, newValue }`) + `api-mapper.js` 변환 레이어.
REST 호출 직전에 RFC 6902 또는 최종 DTO로 변환한다.

### 8.4. 순환 참조 해소

`globalThis` 전역변수 → 생성자 주입 → `configure({ pipelineFactory })` Composition Root DI.
3단계 진화를 거쳐 현재 구조에 안착했다.

### 8.5. `save()` 스냅샷 Worker 오프로딩 불가

`structuredClone`은 동기적으로 실행해야 한다. Worker로 오프로딩하면 clone 완료 전
소비자가 데이터를 변경할 수 있어 스냅샷 시점 보장이 깨진다.
반면 `lazy` diff 연산은 안전하게 오프로딩할 수 있다(Proxy set 트랩이 changeLog 기록을 건너뛰므로).

### 8.6. ESM + CJS Dual Package

ESM-only를 검토했으나, `BroadcastChannel`을 글로벌하게 관리하는 특성상
CJS와 ESM이 동시 로드되면 채널 인스턴스가 이중화되는 Dual Package Hazard가 치명적.
CJS 번들을 유지하되 `"type": "module"` + `"sideEffects": false`로 ESM 우선 사용 유도.

### 8.7. UILayout — `readonlyTemplateSelector` 별도 선언

SI 환경에서 `<input>` → `<span>` 치환 시 레이아웃 붕괴 위험.
개발자가 읽기 전용 레이아웃을 완전히 통제할 수 있도록 별도 템플릿 선택자를 선언하게 한다.
미선언 + `mode: 'read'` 조합은 즉시 에러를 throw한다. Silent Failure 불허.

---

## Part 9. 테스트 전략

### 테스트 스위트 구성

| 레이어  | 테스트 파일                    | 검증 범위                                                        |
| ------- | ------------------------------ | ---------------------------------------------------------------- |
| Core    | `api-proxy.test.js`            | set/get/delete 트랩, 배열 변이 10종, dirtyFields, lazy mode 분기 |
| Domain  | `DomainState.test.js`          | 팩토리 3종, save() 분기, 롤백, 배칭, Shadow State                |
| Domain  | `DomainCollection.test.js`     | create/fromJSONArray, add/remove, saveAll batch                  |
| Domain  | `DomainVO.test.js`             | toSkeleton, validators, transformers, checkSchema                |
| Domain  | `DomainPipeline.test.js`       | all().after().run(), strict 분기, 에러 수집                      |
| Domain  | `idempotency_key.test.js`      | UUID 발급/재사용/초기화 생명주기                                 |
| Domain  | `domain-state-lazy.test.js`    | lazy tracking mode diff 정확성                                   |
| Network | `api-handler.test.js`          | URL 빌드, 프로토콜 결정, HTTP 에러, Idempotency                  |
| Network | `api-handler-csrf-dom.test.js` | CSRF 3-상태, meta 파싱, cookie 파싱                              |
| Plugins | `FormBinder.test.js`           | 이벤트 타이밍 (blur vs change)                                   |
| Plugins | `DomainRenderer.test.js`       | select/radio/checkbox/button 렌더링                              |
| Common  | `clone.test.js`                | safeClone 경계 케이스                                            |
| Common  | `lcs-diff.test.js`             | LCS 매칭, positional fallback, 재귀 중첩                         |
| UI      | `ui.test.js`                   | UIComposer 설치, bindSingle, CollectionBinder 전체               |
| Workers | `serializer.worker.test.js`    | 직렬화 오프로딩 동작                                             |

테스트 환경: Vitest + jsdom (DOM 바인딩 테스트용) + happy-dom.
Coverage: `@vitest/coverage-v8`.

---

본 문서는 라이브러리의 현행 구조와 의사결정을 기술한 것이다.
각 결정의 상세한 배경, 검토한 대안, 기각 이유는
`references/ard-0000/` ~ `references/ard-0003/` 디렉토리의 분석 문서에 기록되어 있다.
