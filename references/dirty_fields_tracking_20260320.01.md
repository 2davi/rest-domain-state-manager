# Dirty Fields Feature (2026-03-20)

## (a) 코드 구조 현황 진단

### `api-proxy.js` - `createProxy()` 클로저 구조

> `createProxy()` 함수가 실행되는 순간 아래의 변수들이 **클로저 스코프**에 격리되어 살아남는다.

```text
createProxy(domainObject, onMutate)
 ├─ changeLog: []          → 변경 이력 저장소 (RFC 6902)
 ├─ proxyCache: WeakMap    → 중첩 Proxy 중복 생성 방지
 ├─ isMuting: false        → ON_MUTATIONS 래퍼 실행 중 set 트랩 차단 플래그
 ├─ ON_MUTATIONS: [...]    → 래핑할 배열 메서드 목록
 ├─ record()               → changeLog에 기록 + onMutate() 호출
 ├─ makeHandler(basePath)  → set/get/deleteProperty 트랩 핸들러 팩토리
 └─ return ProxyWrapper
      ├─ proxy              → 외부 공개 진입점
      ├─ getChangeLog       → () => [...changeLog]
      ├─ getTarget          → () => domainObject
      └─ clearChangeLog     → changeLog.length = 0
```

- `record()` 함수가 모든 변경 이력의 **단일 기록 창구** 역할을 수행한다.
  - `set` Trap, `deleteProperty` Trap, `ON_MUTAION` Wrapper 끝단에서 모두 `record()` 함수로 수렴한다.
  - _\_dirtyFields_ 를 관리하게 될 최적의 위치.

> `DomainState.js` - `save()` 현재 분기 로직의 결함

```javascript
// 현재 save() 분기
const log = this._getChangeLog();
if (log.length > 0) {
    // PATCH
} else {
    // PUT  ← 변경 없음 = PUT이라는 잘못된 판단
}
```

- `changeLog`는 RFC 6902 감사 이력을 담고 있다.
  - 여기가 비어있다는 건 "변경 이력이 없다"는 의미를 가지며, "전체 교체가 필요하다"라는 현재의 로직과 뜻이 통하지 않는다.
  - **PUT과 PATCH의 분기 기준이 데이터 의미론(Semantics)이 아닌 이력 배열 길이에 달려있는 거야.**
- `changeLog.length === 0 → PUT`으로 작성된 현재의 로직을 `_dirtyFields` 기반으로 갈아엎는 과정을 거쳐 RESTful Architecture의 스펙을 준수하여야 한다.

---

## (b) `_dirtyFields` Architecture 설계

### `changeLog`와 `_dirtyFields` 개념 정리

| 구분      | `changeLog`                             | `_dirtyFields`                   |
| --------- | --------------------------------------- | -------------------------------- |
| 자료구조  | `ChangeLogEntry[]`                      | `Set<string>`                    |
| 저장 단위 | RFC 6902 op 단위 (ADD/REPLACE/REMOVE)   | 최상위 키(top-level key) 단위    |
| 목적      | PATCH Payload 직렬화 (`toPatch()` 입력) | PUT/PATCH 분기 비율 계산         |
| 중복 여부 | 동일 경로 변경 시 항목이 쌓임           | Set이라 최상위 키는 1개만 유지   |
| 질문      | "어떻게 바뀌었나 (감사 이력)"           | "어느 키가 바뀌었나 (존재 여부)" |

### top-level key 추출 원리

> `path`는 JSON Pointer 스타일로 관리하며 `/`로 시작
> `_dirtyFields`는 최상위 키인 두 번째 세그먼트를 사용한다.
>
> - `address.city`의 값을 변경하면 `address`가 `_dirtyFields`에 등록된다.
>   - `totalFields`는 루트 객체의 `Object.keys()` 수를 가리키며, 이 추출 방식이 PUT/PATCH 비율 계산과 수학적으로 정합한다.

```javascript
'/name'                         → split('/')[1] → 'name'
'/address/city'                 → split('/')[1] → 'address'
'/items/0/price'                → split('/')[1] → 'items'
'/items'  (배열 전체 REPLACE)   → split('/')[1] → 'items'
```

### PUT/PATCH 분기 알고리즘 고도화

> `DIRTY_THRESHOLD = 0.7`은 `/src/constants/dirty.const.js`에 신규 상수로 분리

```text
save() 진입
 │
 ├─ isNew === true → POST (기존 그대로)
 │
 └─ isNew === false
      │
      ├─ dirtyFields.size === 0
      │    → PUT  (의도적 재저장. 변경 없이 save() 호출한 경우)
      │
      ├─ dirtyFields.size / totalFields >= DIRTY_THRESHOLD (0.7)
      │    → PUT  (70% 이상 바뀌면 PATCH 배열보다 전체 교체가 효율적)
      │
      └─ 나머지 → PATCH (변경된 부분만 RFC 6902 배열로 전송)
```

---

## (c) `ON_MUTATIONS`와 `isMuting`의 관계 - Edge Case 검토

> 배열 변이 Wrapper에서 `isMuting`의 동작 흐름을 확정하고, `_dirtyFields`의 역할을 정의한다.
>
> - `isMuting = false` 상태에서 `record()`를 직접 호출하기 때문에, `_dirtyFields` 업데이트가 정상적으로 이루어진다. _별도 처리 불필요._
> - `sort`/`reverse`의 경우 `record(REPLACE, basePath, ...)` 형태로 호출되어,
>   - `basePath`가 `/items`면 `'/items'.split('/')[1]` = `'items'` → 올바르게 추출됨.

```text
proxy.items.splice(1, 1, 'X')
└─ ON_MUTATIONS 래퍼 진입
    ├─ isMuting = true                             ← set 트랩 record() 차단
    ├─ Array.prototype.splice.apply(target, args)  ← 실제 배열 변이
    ├─ isMuting = false                            ← 차단 해제
    └─ switch('splice'):
         ├─ record(REMOVE, '/items/1', ...)        ← isMuting=false이므로 정상 기록
         │   └─ dirtyFields.add('items')           ← NEW: '/items/1'.split('/')[1]
         └─ record(ADD, '/items/1', ...)
             └─ dirtyFields.add('items')           ← 이미 있으므로 Set 중복 무시
```

---

## (d) 예상 시나리오

> 런타임에서 실제로 일어날 일의 순서.

```text
① 인스턴스 생성
   DomainState.fromJSON(jsonText, api)
   └─ toDomain() → createProxy()
        ├─ changeLog = []
        ├─ dirtyFields = new Set()   ← NEW
        └─ ProxyWrapper {
               proxy, getChangeLog, getTarget, clearChangeLog,
               getDirtyFields,   ← NEW
               clearDirtyFields  ← NEW
           }
   └─ new DomainState(proxyWrapper, { isNew: false })
        ├─ this._getDirtyFields   = proxyWrapper.getDirtyFields   ← NEW
        └─ this._clearDirtyFields = proxyWrapper.clearDirtyFields ← NEW

② 사용자가 데이터 변경
   user.data.name = 'Davi'
   └─ Proxy set 트랩 진입 (basePath='', prop='name')
   └─ record('replace', '/name', 'old', 'Davi')
        ├─ changeLog.push({ op:'replace', path:'/name', ... })
        ├─ dirtyFields.add('name')         ← NEW: '/name'.split('/')[1]
        └─ onMutate() → _broadcast()

   user.data.address.city = 'Seoul'
   └─ get 트랩: 'address' 접근 → Lazy Proxy (basePath='/address')
   └─ set 트랩 진입 (basePath='/address', prop='city')
   └─ record('replace', '/address/city', ...)
        ├─ changeLog.push({ op:'replace', path:'/address/city', ... })
        ├─ dirtyFields.add('address')      ← NEW: '/address/city'.split('/')[1]
        └─ onMutate()

③ save() 호출
   dirtyFields = Set { 'name', 'address' }       → size = 2
   totalFields = Object.keys(getTarget()).length  → 예: 4 (id, name, address, role)
   ratio = 2/4 = 0.5 → 0.5 < 0.7 → PATCH 분기
   └─ HTTP PATCH 전송 (RFC 6902 changeLog payload)
   └─ clearChangeLog()
   └─ clearDirtyFields()   ← NEW: Set 초기화
   └─ _broadcast()

④ 다른 시나리오: 필드 대부분 변경
   dirtyFields = Set { 'id', 'name', 'address', 'role' } → size = 4
   ratio = 4/4 = 1.0 → 1.0 >= 0.7 → PUT 분기
   └─ HTTP PUT 전송 (전체 객체 직렬화)
```

---

## (e) 계획 수립

> 현재 아키텍처 위에 `_dirtyFields`를 동시 업데이트할 `record()`함수만 건드리면 된다.
> 추가로, `_dirtyFields`를 활용한 PUT/PATCH 분기 로직 개편

### 수정 파일 목록 및 변경 범위

| 파일                           | 변경 종류     | 변경 내용                                                                                                                              |
| ------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/dirty.const.js` | **신규 생성** | `DIRTY_THRESHOLD = 0.7` 상수 + JSDoc                                                                                                   |
| `src/core/api-proxy.js`        | **수정**      | `dirtyFields: Set<string>` 클로저 추가, `record()` 내부 key 추출 + `dirtyFields.add()`, `ProxyWrapper` 반환값 2개 추가, JSDoc 업데이트 |
| `model/DomainState.js`         | **수정**      | constructor에 `_getDirtyFields`, `_clearDirtyFields` 바인딩 추가, `save()` 분기 로직 교체, JSDoc 업데이트                              |

### Feature 브랜치명 및 커밋 메시지

- **브랜치명:** `feature/dirty-fields-tracking`
  - 기존 API를 유지하면서 `ProxyWrapper`에 클로저 2개 신규 추가하고, `save()` 분기 전략을 교체하는 작업이므로 `refactor/`가 아닌 신규 기능`feature/`으로 구분

- **Commit Sequence:**

```markdown
# 커밋 1 — 상수 파일 생성
feat(constants): add DIRTY_THRESHOLD constant for smart PUT/PATCH routing

  - src/constants/dirty.const.js 신규 생성
  - DIRTY_THRESHOLD = 0.7 (변경 필드 비율이 이 값 이상이면 PUT)
  - RFC 7396 Merge Patch 효율성 기준으로 결정된 기본값

# 커밋 2 — api-proxy.js 수정 (핵심 - 엔진 레이어)
feat(core): add dirtyFields tracking to createProxy closure

  - createProxy() 클로저에 dirtyFields: Set<string> 추가
  - record() 내부에서 top-level key 추출 후 dirtyFields.add()
  - ProxyWrapper 반환값에 getDirtyFields(), clearDirtyFields() 노출
  - ProxyWrapper typedef JSDoc 업데이트

# 커밋 3 — DomainState.js 수정 (소비 레이어)
feat(domain): replace save() branching with dirtyFields-based smart routing

  - DomainState constructor에 _getDirtyFields, _clearDirtyFields 바인딩
  - save(): changeLog.length 기반 PUT/PATCH 분기 → dirtyFields 비율 기반으로 교체
  - save() 성공 후 clearDirtyFields() 추가 호출
  - DomainStateOptions typedef JSDoc 및 save() 메서드 JSDoc 업데이트
```
