# HTTP 자동 라우팅

이 문서는 `save()` 가 HTTP 메서드를 자동으로 결정하는 알고리즘의 설계 배경, 구현 원리, 그리고 엣지 케이스 처리 방식을 기술합니다.

## 설계 배경

REST API에서 HTTP 메서드는 단순한 액션 식별자가 아닙니다. 각 메서드는 서버-클라이언트 간 약속된 의미론(Semantics)과 멱등성(Idempotency) 규약을 내포합니다.

- **POST** (비멱등) — 리소스를 새로 생성합니다. 동일한 요청을 두 번 보내면 두 개의 리소스가 생성됩니다.
- **PUT** (멱등) — 타겟 리소스를 완전히 교체합니다. 동일한 요청을 N번 보내도 결과는 항상 동일합니다. 요청 본문에 리소스의 **모든 필드**가 포함되어야 합니다.
- **PATCH** (부분/비멱등) — 리소스의 일부만 변경합니다. [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) 포맷을 사용합니다.

이 의미론을 준수하지 않으면 데이터 무결성 오류가 발생합니다. 예를 들어 변경된 필드만 있다는 이유로 항상 PATCH를 보내다가 요청 실패 시 서버 상태와 불일치가 생깁니다.

## Dirty Checking — 설계 원리

Java Hibernate 등의 ORM에서 오래전부터 사용해온 **Dirty Checking** 메커니즘을 JavaScript Proxy 기반으로 구현합니다.

핵심 아이디어는 단순합니다: *어떤 최상위 필드가 변경되었는가*를 Set으로 추적하여, 변경된 필드의 비율에 따라 전체 교체(PUT) 또는 부분 교체(PATCH)를 결정합니다.

### changeLog vs dirtyFields — 역할 분리

두 자료구조는 서로 다른 목적을 가집니다.

<table class="param-table">
  <thead>
    <tr><th>구분</th><th>changeLog</th><th>dirtyFields</th></tr>
  </thead>
  <tbody>
    <tr><td>자료구조</td><td><code>ChangeLogEntry[]</code></td><td><code>Set&lt;string&gt;</code></td></tr>
    <tr><td>저장 단위</td><td>RFC 6902 op 단위 (ADD/REPLACE/REMOVE)</td><td>변경된 최상위 키</td></tr>
    <tr><td>목적</td><td>PATCH 페이로드 직렬화</td><td>PUT/PATCH 분기 비율 계산</td></tr>
    <tr><td>중복 처리</td><td>동일 경로 변경 시 항목이 쌓임</td><td>Set이므로 동일 키 중복 없음</td></tr>
    <tr><td>질문</td><td>"어떻게 바뀌었나 (감사 이력)"</td><td>"어느 키가 바뀌었나 (존재 여부)"</td></tr>
  </tbody>
</table>

### 최상위 키 추출 원리

모든 변경 경로는 JSON Pointer(RFC 6901) 스타일로 `/` 로 시작합니다. `dirtyFields` 는 경로의 두 번째 세그먼트(최상위 키)만 추출합니다.

```text
'/name'              → split('/')[1] → 'name'
'/address/city'      → split('/')[1] → 'address'   (중첩 변경은 최상위만)
'/items/0/price'     → split('/')[1] → 'items'
'/items'             → split('/')[1] → 'items'     (배열 전체 REPLACE도 동일)
```

이 설계는 `totalFields = Object.keys(target).length` 와 수학적으로 정합합니다. `address.city` 를 변경한 것은 루트 객체 기준으로 `address` 하나를 변경한 것이며, PUT/PATCH 비율 계산은 루트 필드 수를 기준으로 합니다.

## 분기 알고리즘

```text
save() 진입
 │
 ├─ _isNew === true
 │    └─ POST
 │         payload: JSON.stringify(getTarget())
 │         성공 시: _isNew = false
 │
 └─ _isNew === false
      │
      dirtyRatio = dirtyFields.size / Object.keys(getTarget()).length
      (totalFields === 0인 경우 dirtyRatio = 0으로 처리 — ZeroDivisionError 방어)
      │
      ├─ dirtyFields.size === 0
      │    └─ PUT
      │         payload: JSON.stringify(getTarget())
      │         의미: 변경 없는 의도적 재저장 — 멱등성 보장
      │
      ├─ dirtyRatio >= DIRTY_THRESHOLD (0.7)
      │    └─ PUT
      │         payload: JSON.stringify(getTarget())
      │         의미: 70% 이상 변경 — 전체 교체가 PATCH 오버헤드보다 효율적
      │
      └─ dirtyRatio < DIRTY_THRESHOLD
           └─ PATCH
                payload: toPatch(changeLog)  → RFC 6902 배열
```

### DIRTY_THRESHOLD = 0.7 의 선택 근거

PATCH 방식은 변경된 필드만 전송하여 페이로드 크기와 서버 처리 비용을 줄입니다. 그러나 필드 수가 많을수록 JSON Patch 배열 자체의 직렬화 오버헤드가 증가합니다. 전체 필드의 70% 이상이 변경된 경우, PUT으로 전체 객체를 한 번에 전송하는 것이 구조적으로 더 단순하고 효율적이라는 판단입니다. 이 임계값은 `src/constants/dirty.const.js` 에 상수로 선언되어 있으며 필요 시 조정 가능합니다.

## Optimistic Update 롤백

`save()` 는 요청을 보내기 전에 현재 상태의 스냅샷을 생성합니다. 스냅샷은 `structuredClone()` 을 사용한 깊은 복사이므로, 이후 `domainObject` 가 변경되어도 스냅샷은 영향받지 않습니다.

```text
save() 진입
  │
  snapshot = {
    data:        structuredClone(getTarget()),  ← 깊은 복사
    changeLog:   getChangeLog(),                ← 얕은 복사본 (이미 [...changeLog])
    dirtyFields: getDirtyFields(),              ← new Set 복사본
    isNew:       _isNew,                        ← 원시값
  }
  │
  try:
    _fetch() 호출
    성공 → clearChangeLog(), clearDirtyFields(), broadcast
  │
  catch:
    _rollback(snapshot)
      ├─ restoreTarget(snapshot.data)      ← Proxy 우회 직접 복원
      ├─ restoreChangeLog(snapshot.changeLog)
      ├─ restoreDirtyFields(snapshot.dirtyFields)
      ├─ _isNew = snapshot.isNew
      └─ if debug: broadcast()
    throw err                              ← 반드시 re-throw
```

### restoreTarget — Proxy 우회 복원

롤백 시 `domainObject` 의 프로퍼티를 복원하는 작업은 Proxy 트랩을 우회하여 원본 객체에 직접 접근합니다. 이렇게 하지 않으면 복원 작업 자체가 `changeLog` 에 기록되어 이력이 오염됩니다.

```javascript
// createProxy() 클로저 내부
restoreTarget: (data) => {
    if (Array.isArray(domainObject)) {
        domainObject.splice(0)           // 배열 루트인 경우 splice로 처리
        domainObject.push(...data)       // (length 복원 보장)
    } else {
        for (const key of Object.keys(domainObject)) {
            Reflect.deleteProperty(domainObject, key)  // 기존 키 제거
        }
        Object.assign(domainObject, data)              // 스냅샷으로 채우기
    }
}
```

이 작업은 Proxy 트랩이 아닌 클로저 내부의 `domainObject` 참조에 직접 접근하므로, 트랩이 개입하지 않습니다.

## 엣지 케이스 처리

>**빈 객체 (`totalFields === 0`)**

```text
dirtyRatio = 0   → dirtyFields.size === 0 조건 우선 → PUT
```

>**배열 루트 객체에서의 save()**

배열 루트 객체는 `Object.keys()` 가 인덱스 문자열을 반환합니다. `totalFields` 계산 자체는 동일하게 동작하지만, 배열 데이터를 가진 인스턴스에서 `save()` 를 호출하는 경우는 `DomainRenderer` 의 렌더링 소스로만 사용하는 것이 일반적입니다.

>**POST 실패 후 isNew 복원**

`_fetch()` 가 throw하면 `this._isNew = false` 줄이 실행되지 않습니다. 그러나 스냅샷에 `isNew: true` 가 포함되어 있으므로 `_rollback()` 이 항상 일관되게 복원합니다.
