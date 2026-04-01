# Lazy Tracking Mode & Diff Worker (2026-03-31)

> **Milestone:** `v1.2.x`
> **Branch:** `feature/lazy-tracking-mode`
> **References:** `ard-0003-alignment.md § 4.2`, `ard-0002-extensions.md § 2부`

---

## (a) 현행 코드 진단

### 현재 상태 — `realtime` 모드만 존재

```text
현재 DomainState 변경 추적 파이프라인

  user.data.name = 'Davi'
    └─ Proxy set 트랩 발화 (api-proxy.js)
    └─ changeLog에 { op: 'replace', path: '/name', value: 'Davi', ... } 즉시 기록
    └─ onMutate() → _scheduleFlush() → (microtask) → _broadcast()
```

모든 `set` 트랩 발화마다 changeLog에 즉시 기록한다.
소비자가 `name`을 `'A' → 'B' → 'C'`로 변경하면 changeLog에 2개 항목이 쌓인다.
서버에 전송되는 PATCH payload도 중간 변경 이력을 포함한다.

### 현재 방식의 두 가지 한계

**한계 1 — 중간 변경 이력이 불필요한 네트워크 페이로드를 만든다:**
사용자가 텍스트 필드에 30자를 입력하면 changeLog에 최대 30개 항목이 쌓인다.
최종 결과는 초기값 대비 단 한 번의 변경인데도 RFC 6902 Patch 배열은 30개 항목이 된다.

**한계 2 — DomainCollection의 lazy diff와 구조적으로 결합되어야 한다:**
v1.3.x에서 구현할 `DomainCollection.saveAll()`의 `lazy` 전략은
배열 전체를 `_initialSnapshot`과 비교하는 방식이다.
단일 `DomainState`와 `DomainCollection` 모두 동일한 `trackingMode` 추상화를 공유해야
소비자가 일관된 인터페이스로 두 클래스를 사용할 수 있다.

### `structuredClone` 오프로딩 방향 재확인

`save()` 내부의 `structuredClone(this._getTarget())`은 동기를 유지한다.
이 작업을 Worker에 오프로딩하면 비동기 구간이 생기고,
그 사이에 소비자가 상태를 변경할 경우 스냅샷의 시점 보장이 깨진다.

**오프로딩 대상은 `lazy` 모드의 deep diff 연산이다.**
`lazy` 모드에서 `save()` 호출 시 diff 연산 중 소비자가 데이터를 변경해도,
Proxy `set` 트랩이 changeLog 기록을 `save()` 이후로 미루는 구조이므로
타이밍 충돌이 발생하지 않는다.

---

## (b) 목표 아키텍처 설계

### 두 가지 추적 모드

| 모드                | changeLog 기록 시점              | 적합한 상황                                        | `_initialSnapshot` 필요 여부 |
| ------------------- | -------------------------------- | -------------------------------------------------- | ---------------------------- |
| `'realtime'` (기본) | Proxy `set` 트랩 발화 즉시       | 개발 단계 디버깅, BroadcastChannel 실시간 모니터링 | 불필요                       |
| `'lazy'` (신규)     | `save()` 호출 시점에 diff로 생성 | 운용 환경 성능, 네트워크 페이로드 최소화           |  필수                        |

`trackingMode`는 각 `DomainState` 인스턴스 생성 시 명시적 플래그로 선택한다.
라이브러리 전역 기본값으로 설정하지 않는다.

### `lazy` 모드 동작 흐름

```text
DomainState.fromJSON(jsonText, api, { trackingMode: 'lazy' }) 호출

  → domainObject 구성 (기존 동일)
  → Proxy 래핑 (기존 동일)
  → _initialSnapshot = structuredClone(domainObject)  ← NEW: 생성 시점 스냅샷

이후 user.data.name = 'B', user.data.name = 'C' 변경
  → Proxy set 트랩 발화
  → lazy 모드 → changeLog 기록 건너뜀  ← NEW: 트랩 내 분기
  → domainObject 내부 값만 변경됨 (기존 동작)

save() 호출
  → handler._idempotent 확인 (v1.1.x 흐름 동일)
  → #snapshot 캡처 (기존 동일)
  → trackingMode === 'lazy'
      → diff 연산 Worker에 위임
      → Worker: _initialSnapshot vs 현재 target → changeLog 생성
      → 생성된 changeLog로 dirtyRatio 계산 → PUT 또는 PATCH 분기
  → _fetch() 호출 (기존 동일)
  → 성공 → _initialSnapshot 갱신 (현재 상태로 교체)
  → 실패 → _rollback() (기존 동일)
```

### `itemKey` 기반 LCS(Longest Common Subsequence) Diff

배열 항목의 동일성을 판단할 기준 없이 위치(index)만으로 diff를 수행하면
"행 삭제 후 신규 추가" 케이스에서 잘못된 patch가 생성된다.

```text
예시 — 잘못된 positional diff

  초기 배열: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
  현재 배열: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }]

  positional diff (잘못됨):
    index 0: { id: 1 } → { id: 2 } → "replace"
    index 1: { id: 2 } → { id: 3 } → "replace"

  itemKey: 'id' 기반 LCS diff (정확함):
    id:1 → 초기 배열에만 있음 → "remove"
    id:2 → 양쪽에 있음 → "no-op"
    id:3 → 현재 배열에만 있음 → "add"
```

`itemKey`는 `UILayout.static itemKey`에서 주입받는다. (v1.4.x에서 연결)
v1.2.x 단계에서는 `DomainState` 인스턴스 options에 `itemKey`를 직접 받는 인터페이스를 먼저 구현한다.

### diff Worker 아키텍처

```text
메인 스레드                                Worker
─────────────────────────────────────────────────────
save() 호출 (lazy 모드)
  │
  ├─ worker.postMessage({
  │      type:    'DIFF',
  │      target:  current,           ─────────────────→ 수신
  │      initial: _initialSnapshot,                     JSON.parse 역직렬화
  │      itemKey: 'id',                                 LCS diff 수행
  │  })                                                 changeLog 생성
  │                              ←──────────────────── { type: 'DIFF_RESULT', changeLog }
  │
  └─ changeLog 수신 → dirtyRatio 계산 → _fetch()
```

`postMessage` 전송 시 일반 객체를 그대로 보내지 않는다.
메인 스레드에서 `JSON.stringify()`로 문자열화 후 전달한다.
`postMessage`의 `structuredClone`이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
(`serializer_worker.js`에서 이미 검증된 패턴)

---

## (c) 변경 파일별 세부 분석

### `src/domain/DomainState.js` — 4개 지점 수정

#### 수정 1. `trackingMode` 저장 및 `_initialSnapshot` 초기화

`fromJSON()` / `fromVO()` 팩토리의 `options` 파라미터에 `trackingMode` 추가.
생성자 내부에서 `this._trackingMode` 저장.
`lazy` 모드인 경우 즉시 `this._initialSnapshot = structuredClone(domainObject)` 저장.

#### 수정 2. `save()` — `lazy` 분기 추가

```text
save() 내부 lazy 분기 위치

  #snapshot 캡처 이후
  _fetch() 호출 이전

  if (this._trackingMode === 'lazy') {
      // diff Worker에 위임하여 changeLog 생성
      // 생성된 changeLog를 일시적으로 사용한 후 _fetch() 호출
      // dirtyRatio 계산도 이 changeLog 기준으로 수행
  }
  // else: 기존 realtime 흐름 유지 (changeLog는 이미 쌓여있음)
```

#### 수정 3. `save()` 성공 경로 — `_initialSnapshot` 갱신

성공 후 `_initialSnapshot = structuredClone(this._getTarget())`으로 갱신.
다음 `save()` 호출 시의 diff 기준점을 최신 상태로 교체한다.

#### 수정 4. JSDoc 갱신

`fromJSON()` / `fromVO()` `@param options.trackingMode` 추가.
`save()` 주석에 `lazy` 모드 흐름 설명 추가.

---

### `src/core/api-proxy.js` — `set` 트랩 분기 추가

```text
set 트랩 내부 변경 지점

  현재:
    set(target, prop, value, receiver) {
        // ... 값 변경
        onMutate({ op, path, ... })  // changeLog 기록
    }

  변경 후:
    set(target, prop, value, receiver) {
        // ... 값 변경
        if (trackingMode !== 'lazy') {
            onMutate({ op, path, ... })  // realtime만 즉시 기록
        }
        // lazy 모드: 값만 변경하고 changeLog 기록 건너뜀
    }
```

`trackingMode`는 `createProxy()` 호출 시 options으로 전달받는다.

---

### `src/workers/diff.worker.js` — 신규 생성

```text
수신 메시지 구조
  {
    type:    'DIFF',
    target:  string,   // JSON.stringify된 현재 상태
    initial: string,   // JSON.stringify된 초기 스냅샷
    itemKey: string?   // 배열 항목 동일성 기준 필드명 (없으면 positional fallback)
  }

처리 흐름
  → JSON.parse(target), JSON.parse(initial)
  → lcs-diff.js의 deepDiff(initial, current, itemKey) 호출
  → changeLog 배열 생성

응답 메시지 구조
  {
    type:      'DIFF_RESULT',
    changeLog: Array<{ op, path, value? }>
  }
```

Worker 내부에서 `BroadcastChannel`을 열지 않는다.
`serializer_worker.js`와 역할이 명확히 분리된다.

---

### `src/common/lcs-diff.js` — 신규 생성

```text
deepDiff(initial, current, itemKey?) → changeLog[]

  1. 최상위 레벨 키 순회
  2. 키의 값이 배열인 경우
     └─ itemKey 있음 → LCS 알고리즘으로 항목 동일성 판단
         └─ 초기 배열에만 있는 항목 → { op: 'remove', path: '/field/-' }
         └─ 현재 배열에만 있는 항목 → { op: 'add', path: '/field/-', value: item }
         └─ 양쪽에 있는 항목 → 내부 필드 재귀 비교
     └─ itemKey 없음 → positional fallback
         └─ id: null 또는 '' 인 항목 → 무조건 'add'
         └─ 초기 배열 길이 > 현재 배열 길이 → 초과분 'remove'
  3. 키의 값이 객체인 경우 → 재귀 비교
  4. 키의 값이 원시값인 경우 → 직접 비교 → 다르면 { op: 'replace', path, value }
  5. 키가 초기에 없고 현재에 있음 → { op: 'add', path, value }
  6. 키가 초기에 있고 현재에 없음 → { op: 'remove', path }
```

LCS 알고리즘 시간 복잡도: O(N × M) — N, M은 비교 배열의 길이.
일반 SI 폼에서 배열 항목 50개 이내 기준으로 메인 스레드 블로킹 없음.
2,000개 이상의 항목은 Worker 오프로딩으로 메인 스레드 보호.

---

### `vitest.config.js` — Worker 테스트 환경 추가

```text
현재: environment: 'jsdom'

Vitest에서 Web Worker는 기본적으로 jsdom 환경에서 미지원.
diff.worker.js 단위 테스트를 위해 Worker Mock 설정 추가.

추가 방향:
  - happy-dom 환경으로 전환 (이미 devDependency에 포함)
  - 또는 vi.mock('./diff.worker.js')로 Worker 전체 목킹
```

---

## (d) 예상 시나리오

### 시나리오 1. `realtime` 모드 — 기존 동작 유지

```text
const user = DomainState.fromJSON(text, api);  // trackingMode 기본값: 'realtime'

user.data.name = 'A';  // changeLog: [replace /name A]
user.data.name = 'B';  // changeLog: [replace /name A, replace /name B]
user.data.name = 'C';  // changeLog: [replace /name A, replace /name B, replace /name C]

save() 호출
  → changeLog 3개 항목 존재 → dirtyRatio 계산 → PATCH
  → payload: [{ op: 'replace', path: '/name', value: 'C' }, ...]
    (실제로는 api-mapper가 중복 경로를 정리하므로 최신 값만 포함)
```

### 시나리오 2. `lazy` 모드 — save() 시점 diff

```text
const user = DomainState.fromJSON(text, api, { trackingMode: 'lazy' });
// _initialSnapshot = { name: 'Davi', email: 'davi@example.com' }

user.data.name = 'A';  // changeLog: [] (기록 건너뜀)
user.data.name = 'B';  // changeLog: []
user.data.name = 'C';  // changeLog: []

save() 호출
  → trackingMode === 'lazy'
  → diff Worker 호출: _initialSnapshot vs { name: 'C', email: 'davi@example.com' }
  → changeLog: [{ op: 'replace', path: '/name', value: 'C' }]  ← 최종 결과만
  → dirtyRatio = 1/2 → PATCH
  → payload: [{ op: 'replace', path: '/name', value: 'C' }]
```

### 시나리오 3. `lazy` 모드 — 배열 LCS diff

```text
_initialSnapshot.tags = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]

// id:1 삭제, id:3 추가
user.data.tags.splice(0, 1);         // changeLog: [] (lazy)
user.data.tags.push({ name: 'C' });  // changeLog: []

save({ itemKey: 'id' }) 호출
  → diff Worker: LCS(itemKey='id')
  → id:1 → 초기에만 있음 → { op: 'remove', path: '/tags/0' }
  → id:2 → 양쪽에 있음 → no-op
  → id:3 → 현재에만 있음 → { op: 'add', path: '/tags/-', value: { id: 3, name: 'C' } }
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일                                   | 변경 종류     | 변경 내용                                                                                                |
| -------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `src/domain/DomainState.js`            | **수정**      | `trackingMode` 옵션 추가, `_initialSnapshot` 저장, `save()` lazy 분기, 성공 후 snapshot 갱신, JSDoc 갱신 |
| `src/core/api-proxy.js`                | **수정**      | `set` 트랩 내 `trackingMode !== 'lazy'` 조건 분기 추가, `createProxy()` options 파라미터 갱신            |
| `src/workers/diff.worker.js`           | **신규 생성** | DIFF 메시지 수신, lcs-diff.js 호출, DIFF_RESULT 응답                                                     |
| `src/common/lcs-diff.js`               | **신규 생성** | `deepDiff(initial, current, itemKey?)` 유틸 함수                                                         |
| `vitest.config.js`                     | **수정**      | Worker 테스트 환경 설정 추가                                                                             |
| `tests/domain/DomainState.test.js`     | **수정**      | trackingMode 분기 정확성 테스트 케이스 추가                                                              |
| `tests/workers/diff.worker.test.js`    | **신규 생성** | diff 연산 및 LCS 케이스 단위 테스트                                                                      |
| `tests/common/lcs-diff.test.js`        | **신규 생성** | LCS diff 알고리즘 단위 테스트                                                                            |

### Feature 브랜치명

```text
feature/lazy-tracking-mode
```

### Commit Sequence

```markdown
# STEP A — lcs-diff.js 유틸 구현
feat(common): implement LCS-based deep diff utility for lazy tracking mode

  - src/common/lcs-diff.js 신규 생성
  - deepDiff(initial, current, itemKey?) → RFC 6902 changeLog 배열 반환
  - itemKey 지정 시 LCS 알고리즘으로 배열 항목 동일성 판단
  - itemKey 미지정 시 positional fallback (id: null → add, 초과분 → remove)
  - 재귀 객체 비교 지원
  - tests/common/lcs-diff.test.js 신규 작성


# STEP B — diff.worker.js 신규 생성
feat(workers): add diff.worker.js for lazy mode changeLog generation

  - src/workers/diff.worker.js 신규 생성
  - DIFF 메시지 수신: JSON.parse(target), JSON.parse(initial)
  - lcs-diff.js deepDiff() 호출 → changeLog 생성
  - DIFF_RESULT 메시지 응답
  - BroadcastChannel 미사용 (serializer_worker.js와 역할 분리)
  - vitest.config.js Worker 테스트 환경 설정 추가
  - tests/workers/diff.worker.test.js 신규 작성


# STEP C — api-proxy.js set 트랩 분기 추가
feat(core): add trackingMode branch to Proxy set trap

  - createProxy() options에 trackingMode 파라미터 추가
  - set 트랩 내 trackingMode !== 'lazy' 조건으로 onMutate 분기
  - lazy 모드: 값만 변경, changeLog 기록 건너뜀
  - realtime 모드: 기존 동작 유지 (회귀 없음)


# STEP D — DomainState trackingMode 통합
feat(domain): integrate trackingMode and lazy diff pipeline into DomainState

  - fromJSON()/fromVO() options에 trackingMode: 'realtime' | 'lazy' 추가
  - lazy 모드: 생성 시점에 _initialSnapshot = structuredClone(domainObject) 저장
  - save() lazy 분기: diff Worker 호출 → changeLog 생성 → dirtyRatio 계산
  - 성공 후 _initialSnapshot 갱신 (현재 상태로 교체)
  - JSDoc 전면 갱신
  - tests/domain/DomainState.test.js trackingMode 케이스 추가
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                      | 기준                                                 |
| ------------------------- | ---------------------------------------------------- |
| `npm run lint`            | error 0건                                            |
| `npm test`                | 전체 테스트 통과 (기존 TC 회귀 없음)                 |
| `realtime` 모드           | 기존 동작 완전 동일, changeLog 즉시 기록 확인        |
| `lazy` 모드 생성          | `_initialSnapshot` 저장 확인                         |
| `lazy` 모드 변경 중       | changeLog 비어있음 확인                              |
| `lazy` 모드 `save()`      | diff Worker 호출 → 최종 diff만 반영된 changeLog 확인 |
| `lazy` 모드 성공 후       | `_initialSnapshot` 갱신 확인                         |
| LCS diff — 행 삭제+추가   | `replace` 대신 `remove` + `add` 생성 확인            |
| `itemKey` 미지정 fallback | positional 방어 로직 동작 확인                       |
| Worker 오프로딩 안전성    | diff 연산 중 상태 변경이 changeLog에 영향 없음 확인  |
