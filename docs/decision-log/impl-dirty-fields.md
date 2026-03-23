# IMPL-001 — Dirty Checking 기반 HTTP 분기 알고리즘

| 항목      | 내용                               |
| --------- | ---------------------------------- |
| 날짜      | 2026-03-20                         |
| 브랜치    | `feature/dirty-fields-tracking`    |
| 상위 결정 | [ARD-0001](/decision-log/ard-0001) |
| 상태      | 완료                               |

## 1. 문제 정의

### 1.1 기존 분기 로직의 의미론적 오류

ARD-0001이 진단한 핵심 결함 중 하나는 `save()` 의 PUT/PATCH 분기 기준이 잘못되었다는 것이었다. 기존 구현은 다음과 같았다.

```javascript
// 기존 save() 분기 — 의미론적으로 잘못됨
const log = this._getChangeLog();
if (log.length > 0) {
    // PATCH
} else {
    // PUT
}
```

`changeLog` 는 RFC 6902 형식의 감사 이력(Audit Log)이다. `changeLog.length === 0` 은 "변경 이력이 없다"는 의미이지, "타겟 리소스를 전체 교체해야 한다"는 의미가 아니다. PUT은 RFC 7231 §4.3.4에 따라 타겟 리소스의 **완전한 교체(full replacement)** 를 의미하며, 이 시맨틱을 "변경 이력이 없을 때"와 동일시하는 것은 REST 표준에 어긋난다.

추가적으로 기존 로직에는 PUT이 필요한 경우인 "70% 이상 필드가 변경된 경우"가 아예 고려되지 않았다.

### 1.2 `changeLog`와 분리된 분기 추적 수단의 필요성

`changeLog` 를 PUT/PATCH 분기 비율 계산에 직접 사용하는 것도 문제가 있다. 동일 필드를 `A → B → A` 순으로 두 번 변경하면 `changeLog` 에는 두 개의 항목이 남지만, 실질적으로 변경된 최상위 키는 0개다. 변경된 필드의 "존재 여부"를 추적하는 데는 `Set<string>` 이 적합하다.

## 2. 설계 결정

### 2.1 두 자료구조의 역할 분리

| \         | `changeLog`                   | `_dirtyFields`                 |
| --------- | ----------------------------- | ------------------------------ |
| 자료구조  | `ChangeLogEntry[]` (RFC 6902) | `Set<string>`                  |
| 저장 단위 | op 단위 (add/replace/remove)  | 최상위 키(top-level key) 단위  |
| 목적      | PATCH 페이로드 직렬화         | PUT/PATCH 분기 비율 계산       |
| 중복 처리 | 동일 경로 변경 시 항목이 쌓임 | Set이므로 같은 키는 1회만 기록 |

### 2.2 최상위 키(Top-level Key) 추출 원리

`dirtyFields` 는 최상위 키만 추적한다. 이것이 `totalFields = Object.keys(domainObject).length` 와 수학적으로 정합하다.

경로(path)는 JSON Pointer(RFC 6901) 형식으로 `/` 로 시작하며, 두 번째 세그먼트가 최상위 키다.

```text
'/name'          → split('/')[1] → 'name'
'/address/city'  → split('/')[1] → 'address'
'/items/0/price' → split('/')[1] → 'items'
```

`sort`, `reverse` 처럼 배열 전체를 REPLACE로 기록하는 경우에도 `basePath` 의 두 번째 세그먼트를 추출하므로 정합하다.

### 2.3 DIRTY_THRESHOLD = 0.7 선택 근거

PATCH 방식은 변경된 필드만 JSON Patch 배열로 전송하여 페이로드를 줄이는 것이 목적이다. 그러나 변경된 필드 수가 전체의 70% 이상에 달하면 JSON Patch 배열 자체의 직렬화 오버헤드가 전체 객체를 단순 직렬화하는 PUT보다 비효율적이 된다. 0.7은 실무 RESTful API 설계에서 통용되는 경험적 기준값이며, `src/constants/dirty.const.js` 에 상수로 분리하여 명시적으로 관리한다.

이 값을 라이브러리 소비자가 재정의하는 공개 옵션은 제공하지 않는다. 경계값 조정 기능을 공개하면 소비자가 이를 잘못 설정할 때 발생하는 버그가 라이브러리 버그인지 설정 오용인지 판단하기 어려워진다. 복잡도 대비 실익이 없다고 판단했다.

### 2.4 최종 분기 알고리즘

```text
save() 진입
 │
 ├─ _isNew === true
 │    → POST (전체 페이로드 직렬화. isNew 시맨틱: 서버에 아직 없는 신규 리소스)
 │
 └─ _isNew === false
      │
      ├─ dirtyFields.size === 0
      │    → PUT (변경 없는 의도적 재저장. 멱등성 보장)
      │
      ├─ dirtyRatio = dirtyFields.size / Object.keys(target).length
      │
      ├─ dirtyRatio >= 0.7
      │    → PUT (70% 이상 변경 — 전체 교체가 효율적)
      │
      └─ dirtyRatio < 0.7
           → PATCH (RFC 6902 JSON Patch 배열로 변경분만 전송)
```

### 2.5 Edge Case 처리

**빈 객체(`{}`):** `totalFields = 0` 이면 ZeroDivision을 방지하기 위해 `dirtyRatio = 0` 으로 강제한다. `dirtyFields.size` 도 0이므로 PUT으로 분기된다. 빈 도메인 객체에 대한 `save()` 는 PUT으로 처리하는 것이 의미론적으로 올바르다.

**배열 변이 메서드:** `isMuting` 플래그로 `set` 트랩을 차단한 뒤 변이를 실행하고, 완료 후 `record()` 를 직접 호출하는 방식이므로 `_dirtyFields` 업데이트가 정상적으로 이루어진다. 별도 처리가 필요 없다.

## 3. 변경 파일 및 커밋 시퀀스

| 파일                           | 변경 종류 | 주요 내용                                                                                                                        |
| ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/dirty.const.js` | 신규      | `DIRTY_THRESHOLD = 0.7` 상수 + JSDoc                                                                                             |
| `src/core/api-proxy.js`        | 수정      | `dirtyFields: Set` 클로저 추가, `record()` 내 top-level key 추출, `ProxyWrapper`에 `getDirtyFields()`, `clearDirtyFields()` 추가 |
| `src/domain/DomainState.js`    | 수정      | `_getDirtyFields`, `_clearDirtyFields` 바인딩, `save()` 분기 로직 교체                                                           |
| `src/core/api-mapper.js`       | 수정      | `toPayload()` JSDoc에 dirtyFields 기반 분기 시나리오 반영                                                                        |

```text
feat(constants): add DIRTY_THRESHOLD constant for smart PUT/PATCH routing
feat(core): add dirtyFields tracking to createProxy closure
feat(domain): replace save() branching with dirtyFields-based smart routing
docs(api-mapper): update toPayload() JSDoc to reflect dirty-based PUT routing
```

## 4. 결과 및 검증

분기 알고리즘의 정합성은 다음 5가지 시나리오로 검증했다.

| 케이스                   | isNew   | dirtyFields | dirtyRatio | 기대 메서드 | 결과 |
| ------------------------ | ------- | ----------- | ---------- | ----------- | ---- |
| 신규 리소스              | `true`  | —           | —          | POST        | OK   |
| 변경 없는 재저장         | `false` | 0개         | 0.0        | PUT         | OK   |
| 소량 변경 (5필드 중 1개) | `false` | 1개         | 0.2        | PATCH       | OK   |
| 대량 변경 (5필드 중 4개) | `false` | 4개         | 0.8        | PUT         | OK   |
| 빈 객체                  | `false` | 0개         | 0.0        | PUT         | OK   |

Vitest 테스트 케이스 TC-DS-001~005 통과 확인.
