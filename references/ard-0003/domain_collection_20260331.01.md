# DomainCollection & saveAll (2026-03-31)

> **Milestone:** `v1.3.x`
> **Branch:** `feature/domain-collection`
> **References:** `ard-0003-alignment.md § 4.3`, `ard-0002-alignment.md § 4`, `ard-0002-extensions.md § 3부`, `§ 6부`

---

## (a) 현행 코드 진단

### 1:N 화면 구현 시 반복되는 보일러플레이트

```javascript
// 현재 JSP 화면에서 1:N 그리드를 저장할 때 (실제 실무 코드 패턴)
function fnSave() {
    fnReindexRows();   // name 속성 재정렬 (50줄)
    const data = [];
    $('#certGrid tr.cert-row').each(function(i) {
        data.push({
            certId:   $(this).find('[name="certId"]').val(),
            certName: $(this).find('[name="certName"]').val(),
            certType: $(this).find('[name="certType"]').val(),
        });
    });
    $.ajax({ url: '/api/certificates', method: 'POST', data: JSON.stringify(data) });
}
```

`DomainState`는 단일 DTO 객체를 다루는 데 충분히 강력하나,
이 패턴의 보일러플레이트를 흡수하지 못한다.
배열 상태를 관리하는 전용 클래스가 필요하다.

### 두 가지 시나리오의 구조적 차이

| 구분 | Nested Array | Root Array |
|---|---|---|
| 서버 수신 구조 | `PUT /api/users/{id}` → `UserVO { List<CertVO> }` | `POST /api/certificates` → `List<CertVO>` |
| DomainState 관계 | 부모 DomainState 내부 필드가 배열 | N개의 독립적인 DomainState들의 컬렉션 |
| changeLog 위치 | 배열 변경이 부모 DomainState의 changeLog에 기록 | 각 DomainState가 각자의 changeLog를 가짐 |
| save() 흐름 | 부모 DomainState 1번의 `.save()` | `DomainCollection.saveAll()` |

이 두 시나리오는 REST API 계층에서 완전히 다른 구조이며, 하나의 클래스로 통합하면 내부 복잡도가 폭발한다.
`DomainCollection`은 **Root Array 시나리오** 전용 컨테이너다.

### `saveAll()` 전략 결정 — `batch` 단독

SI 레거시 환경에서 1:N 배열 저장 시 백엔드는 대부분 리스트 전체를 한 번에 덮어쓰는 방식
(DELETE ALL + INSERT, 또는 MERGE)으로 처리한다.
`sequential` / `parallel`은 개별 API를 쏘는 방식으로 SI 레거시에서 트랜잭션이 꼬이기 쉽다.

**`batch` (배열 전체를 단일 통신)를 MVP로 단독 구현한다.**
`sequential` / `parallel`은 `DomainPipeline` 보상 트랜잭션 완성 이후 v2.x에서 연계한다.

---

## (b) 목표 아키텍처 설계

### `DomainCollection` 클래스 정의

```text
DomainState ≈ Map<K,V>        (단일 DTO 객체 관리)
DomainCollection ≈ List<DomainState>  (DomainState 배열 컨테이너)
```

`DomainCollection`은 UI와 완전히 독립된 순수 상태 레이어다.
`UIComposer` 없이도 `DomainCollection.saveAll({ strategy: 'batch' })`로 배열 전체를 전송할 수 있어야 한다.

### Nested Array 선언 방식 — 런타임 연결 채택

`DomainVO.static fields`에 `type: DomainCollection`을 선언하면
`DomainVO`가 `DomainCollection`을 `import`해야 한다.
ard-0002에서 이미 충분히 경험한 순환 참조 문제가 재발한다. **즉각 반려.**

```javascript
// DomainVO — 배열 기본값만 선언. DomainCollection을 알지 못한다.
class UserVO extends DomainVO {
    static fields = {
        userId:          { default: '' },
        certificateList: { default: [] },  // 배열 기본값만 선언
    };
}

// bindCollection() 호출 시점에 런타임 연결 (v1.4.x에서 UIComposer가 담당)
const { addEmpty } = userState.bindCollection('certificateList', '#certGrid', { ... });
```

### `lazy` 모드와 `DomainCollection`의 상호작용

`lazy` 모드에서는 행 추가/삭제 시 DomainCollection 내부 메모리 배열만 변경하고
changeLog에 아무것도 기록하지 않는다. 예외 없이 일관성 유지.

`saveAll()` 호출 시점에 `_initialSnapshot` 배열과 현재 메모리 배열 전체를 Deep Diff하여
changeLog를 그 자리에서 한 번에 계산한다.
이때 `UILayout.static itemKey`로 지정된 필드를 기준으로 LCS diff를 수행한다. (v1.2.x 구현 재사용)

### `saveAll()` batch 전략 흐름

```text
DomainCollection.saveAll({ strategy: 'batch' })

  ① lazy 모드인 경우: diff 연산으로 각 DomainState의 changeLog 생성
     realtime 모드: 각 DomainState의 changeLog 이미 존재

  ② toJSON()으로 현재 배열 전체를 직렬화
     → Array<object>: 각 DomainState._getTarget() 결과 배열

  ③ handler._fetch(url, { method, body: JSON.stringify(array) })
     POST 또는 PUT: isNew 플래그 기반 분기

  ④ 성공 → 각 DomainState의 clearChangeLog() + clearDirtyFields()
            _initialSnapshot 갱신 (lazy 모드)
     실패 → 각 DomainState의 _rollback() 수행 (restore() 위임)
```

---

## (c) 변경 파일별 세부 분석

### `src/domain/DomainCollection.js` — 신규 생성

#### 팩토리 메서드

```text
DomainCollection.create(api, options)
  → 빈 컬렉션 생성
  → options: { itemVO?, urlConfig?, debug?, trackingMode? }

DomainCollection.fromJSONArray(jsonText, api, options)
  → GET 응답 배열 텍스트 파싱
  → 각 항목을 DomainState.fromJSON()으로 생성
  → _initialSnapshot = structuredClone(parsedArray) 저장 (lazy 모드)
```

#### 핵심 메서드

```text
add(initialData?)       → DomainCollection에 새 DomainState 추가 + 내부 배열 갱신
remove(indexOrState)    → 인덱스 또는 DomainState 인스턴스로 항목 삭제
                          역순(LIFO) splice 처리 필수 (정방향 splice는 인덱스 밀림 버그)
getItems()              → DomainState[] 전체 반환
getCheckedItems()       → 체크된 DomainState[] 반환 (UIComposer 연동 후 유효)
getCount()              → 총 항목 수 반환
toJSON()                → Array<object> 직렬화 (각 DomainState._getTarget() 결과)
saveAll({ strategy })   → batch: 배열 전체 단일 통신
```

#### `remove()` 역순 splice 처리

복수 항목 삭제 시 반드시 내림차순(LIFO) 정렬 후 splice를 수행한다.

```text
체크된 항목 인덱스: [0, 2]

정방향 splice (버그):
  splice(0) → 배열: [B, C]
  splice(2) → 배열 범위 초과. 아무것도 삭제 안 됨.

역순 splice (정확):
  splice(2) → 배열: [A, B]
  splice(0) → 배열: [B]
  결과: A, C 삭제 완료
```

### `index.js` — `DomainCollection` export 추가

```javascript
import { DomainCollection } from './src/domain/DomainCollection.js';

export {
    ApiHandler,
    DomainState,
    DomainVO,
    DomainPipeline,
    DomainCollection,   // ← 추가
    DomainRenderer,
    FormBinder,
    closeDebugChannel,
};
```

`DomainCollection`이 `DomainPipeline`과 상호작용하는 경우(파이프라인 결과물을 컬렉션에 hydrate)에
대한 순환 참조 가능성을 사전 점검한다.
`DomainCollection`은 `DomainPipeline`을 `import`하지 않고,
파이프라인 결과를 `fromJSONArray()`로 수신하는 단방향 구조를 유지한다.

---

## (d) 예상 시나리오

### 시나리오 1. Root Array — 신규 생성 후 batch 저장

```javascript
// 빈 컬렉션에서 시작
const certCollection = DomainCollection.create(api);

// UIComposer.bindCollection()이 addEmpty() 호출할 때마다 내부적으로 실행됨
certCollection.add({ certName: '정보처리기사', certType: 'IT' });
certCollection.add({ certName: '한국사', certType: 'HISTORY' });

await certCollection.saveAll({
    strategy: 'batch',
    path:     '/api/certificates',
});
// → POST /api/certificates
// → body: [{ certName: '정보처리기사', certType: 'IT' }, { certName: '한국사', certType: 'HISTORY' }]
```

### 시나리오 2. 기존 배열 수신 후 수정 → batch 저장

```javascript
const certCollection = await DomainCollection.fromJSONArray(
    await api.get('/api/certificates').then(res => res.text()),
    api,
    { trackingMode: 'lazy' }
);
// _initialSnapshot = [{ certId: 1, certName: '정보처리기사' }, ...]

// UIComposer를 통해 행 추가 (v1.4.x 이후)
certCollection.add({ certName: '한국사' });

await certCollection.saveAll({ strategy: 'batch', path: '/api/certificates' });
// → lazy 모드: diff 연산 → 기존 항목 유지, 신규 항목 add
// → PUT /api/certificates (기존 배열 전체 교체 방식)
// → body: [{ certId: 1, certName: '정보처리기사' }, { certName: '한국사' }]
```

### 시나리오 3. 역순 splice — 복수 행 삭제

```text
컬렉션: [A(0), B(1), C(2), D(3)]
체크된 인덱스: [0, 2]

certCollection.removeChecked([0, 2])
  → 역순 정렬: [2, 0]
  → splice(2): [A, B, D]
  → splice(0): [B, D]
  → 결과: A, C 삭제 완료
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일 | 변경 종류 | 변경 내용 |
|---|---|---|
| `src/domain/DomainCollection.js` | **신규 생성** | 팩토리 메서드 2종, 핵심 메서드, `saveAll({ strategy: 'batch' })` 구현 |
| `index.js` | **수정** | `DomainCollection` import + export 추가, 순환 참조 사전 점검 |
| `tests/domain/DomainCollection.test.js` | **신규 생성** | 팩토리, add/remove 역순 splice, saveAll batch, lazy diff 정확성 테스트 |

### Feature 브랜치명

```text
feature/domain-collection
```

### Commit Sequence

```markdown
# STEP A — DomainCollection 클래스 구현
feat(domain): implement DomainCollection class with create/fromJSONArray factories

  - src/domain/DomainCollection.js 신규 생성
  - create(api, options) 팩토리: 빈 컬렉션 생성
  - fromJSONArray(jsonText, api, options) 팩토리: 배열 파싱 + DomainState 목록 생성
  - _initialSnapshot 저장 (lazy 모드 전용)
  - add(), remove() 구현: 역순(LIFO) splice 처리
  - getItems(), getCount(), toJSON() 구현


# STEP B — saveAll batch 전략 구현
feat(domain): implement saveAll({ strategy: 'batch' }) for DomainCollection

  - saveAll({ strategy, path }) 메서드 구현
  - batch: toJSON() 직렬화 → 단일 POST/PUT 전송
  - lazy 모드: v1.2.x diff Worker 호출 후 fetch
  - 성공: 각 DomainState clearChangeLog() + _initialSnapshot 갱신
  - 실패: 각 DomainState _rollback() 수행
  - sequential/parallel은 미구현 (v2.x DomainPipeline 연계 후)


# STEP C — index.js Composition Root 갱신
feat(core): export DomainCollection from index.js

  - DomainCollection import + export 추가
  - DomainPipeline 순환 참조 부재 확인 주석 추가


# STEP D — Vitest 단위 테스트 작성
test(domain): add DomainCollection unit tests

  - create/fromJSONArray 팩토리 동작 확인
  - add() 후 getCount() 증가 확인
  - remove() 역순 splice 정확성: 2개 항목 동시 삭제 시 올바른 항목 제거 확인
  - saveAll batch: toJSON() 직렬화 결과가 단일 POST body로 전달되는지 확인
  - lazy diff 정확성: 항목 삭제+추가 케이스에서 remove+add 생성 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목 | 기준 |
|---|---|
| `npm run lint` | error 0건 |
| `npm test` | 전체 테스트 통과 (기존 TC 회귀 없음) |
| `create()` | 빈 컬렉션 생성, `getCount() === 0` 확인 |
| `fromJSONArray()` | 배열 항목 수 == `getCount()` 확인 |
| `add()` | `getCount()` 증가 확인 |
| `remove()` 역순 | 2개 동시 삭제 시 올바른 항목만 제거 확인 |
| `saveAll({ strategy: 'batch' })` | 단일 POST body에 배열 전체 포함 확인 |
| lazy diff 정확성 | `remove` + `add` 생성 확인 (positional `replace` 아님) |
| `DomainPipeline` 순환 참조 | `npm run lint` `import/no-cycle` 위반 0건 |
