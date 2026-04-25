# ARD-0002 Extensions: 배열 상태 관리 및 UI 바인딩 레이어 아키텍처 설계

> **작성 시점:** ard-0002-alignment.md의 개발 목표(CSRF 방어, DI Composition Root, Rollup 빌드 전환,
> Shadow State, 보상 트랜잭션)가 모두 달성되어 v1.0.0이 릴리즈된 이후를 기준으로 한다.
> 이 문서는 v1.x.x 개발 사이클과 그 이후 v2.0.0을 향해 나아갈 방향의 설계 근거를 기록한다.

---

## 배경 — 이 논의가 시작된 계기

### 최초 요구사항의 출발점

SI/SM 환경에서 1:N 관계의 화면을 구현할 때마다 반복되는 보일러플레이트가 있다.
그리드(Grid) UI에서 사용자가 행(Row)을 추가하거나 제거할 때, 개발자는 다음 작업들을 매번 손으로 작성한다.

- `fnAddRow()`: 새 `<tr>`을 HTML 문자열로 직접 작성하여 DOM에 삽입
- `fnRemoveRow()`: 체크된 행의 `<tr>`을 DOM에서 제거
- `fnReindexRows()`: `save()` 직전에 모든 행의 `input.name`을 `list[0].field`, `list[1].field` 형태로 재정렬
- `fnSelectAll()` / `fnUpdateCheckboxAll()`: 전체선택 체크박스 상태 동기화
- `$('#frm').serialize()`: 최종적으로 form 전체를 직렬화하여 AJAX 전송

실제 작성한 `createExthnfAllot.jsp`와 `updateExthnfAllot.jsp`를 보면, 이 패턴이 화면마다 복붙되면서
컬럼 구조와 `name` 값만 손으로 고쳐 쓰는 구조임을 확인할 수 있다. JSP `<script>` 태그 안에
`fnReindexRows()` 함수가 50줄씩 작성되어 있고, 컬럼이 달라지면 그 안의 `attr('name', ...)` 코드를
모두 다시 써야 한다. `createExthnfIdxStdrModal.jsp`처럼 배열 자체를 JSON으로 전송하는 케이스도 있는데,
이 경우에는 체크된 행의 `dataset`을 읽어 JS 배열을 수동으로 조립한 뒤 `JSON.stringify()`로 POST한다.

**DSM이 이 보일러플레이트를 흡수해야 한다.**

요구사항을 정리하면 두 가지 시나리오로 나뉜다.

- **e.g.1 (Nested Array):** 사용자정보와 자격증목록이 하나의 `<form>` 안에 있을 때.
  `PUT /api/users/{id}` 한 번으로 `{ userId: '...', certificateList: [...] }` 전체를 전송하는 구조.
  서버는 Spring MVC의 `@ModelAttribute`로 `UserVO { List<CertificateVO> certificateList }` 형태로 받는다.

- **e.g.2 (Root Array):** 배열 자체가 독립적인 REST 리소스일 때.
  `POST /api/certificates`로 `List<CertificateVO>` 배열을 전송하는 구조.
  서버는 `@RequestBody List<CertificateVO>`로 받는다.

이 두 시나리오는 REST API 계층에서 완전히 다른 구조를 가지며, 하나의 클래스로 억지로 통합하면
내부 복잡도가 폭발한다는 것이 설계 논의 과정에서 확인되었다.

---

## 1부. Source of Truth 결정 — Reactive 채택과 그 조건

### 1.1. 세 가지 선택지와 각각의 트레이드오프

배열 상태 관리에서 "누가 Source of Truth인가"는 전체 설계의 분기점이었다.

**Option A — Reactive (State가 Source of Truth):**
모든 `input` 변경이 실시간으로 DomainState Proxy를 업데이트한다. Vue의 `v-model`과 같은 방식.
사용자가 그리드 셀에 값을 입력하는 즉시 `proxy.set` 트랩이 발화되고 changeLog가 기록된다.

- 장점: changeLog가 항상 정확하고 완전함. Optimistic Update 롤백이 완벽하게 작동함.
- 단점: 그리드에 100개 행 × 5개 컬럼 = 최소 500개 input 이벤트 리스너.
  입력마다 Proxy set 트랩 → changeLog 기록 → Microtask Batching → BroadcastChannel 경로가 실행됨.

**Option B — Lazy Sync (DOM이 Source of Truth):**
사용자 입력은 DOM만 변경한다. `save()` 호출 직전에 DOM을 읽어 DomainState를 재구성한다.
기존 `fnReindexRows()` 후 `serialize()` 패턴과 개념적으로 동일.

- 장점: 성능 부담 없음.
- 단점: changeLog가 save() 직전까지 비어있어 PATCH/PUT 분기 판단 불가.
  Optimistic Update 롤백의 기준점이 의미 없어짐.

**Option C — Hybrid:**
행의 추가/삭제는 DomainState 배열에 즉시 반영(구조 변경), 각 행 내부의 필드 값은
save() 직전 DOM에서 읽어 flush(값 동기화). 기존 `fnReindexRows()` 역할을 라이브러리가 흡수.

### 1.2. 최종 결정: Option A (Reactive) 채택

Option C는 현실적인 타협점이나, 이 라이브러리의 핵심 정체성인 changeLog 기반
HTTP 메서드 자동 분기를 반쪽짜리로 만든다는 판단이 들었다.
flush 이전까지 changeLog가 비어있으면, PATCH payload가 정확하게 생성되지 않는다.

Option A의 성능 우려는 두 가지 근거로 해소했다.

첫째, **debug 모드 비활성화 시 BroadcastChannel과 Microtask Batching의 비용이 사라진다.**
changeLog 기록 자체는 단순한 배열 `push` 연산이므로 500회 발생해도 실질적인 병목이 아니다.

둘째, **실제 SI 화면의 현실적인 사용 패턴을 고려하면** 500개 행이 동시에 새로 입력되는
케이스는 엑셀 임포트 같은 별도 기능으로 처리하는 것이 맞고, 그 케이스는 DSM의 책임 범위 밖이다.
대부분의 수정 폼은 "서버에서 받아온 기존 데이터 위에 행 하나를 추가하거나 특정 셀 값을 수정하는" 패턴이며,
이 경우 changeLog가 무지막지하게 쌓일 이유가 없다.

권장 최대 행 수와 guard 처리는 실측 테스트 후 수치를 결정하기로 한다.

---

## 2부. trackingMode — 두 가지 상태 추적 방식

### 2.1. 논의 배경

Reactive 채택 이후에도 성능 우려를 완전히 지울 수 없었다. 특히 운용 환경(production)에서
사용자에게 가능한 한 빠른 UX를 제공하고 싶다는 요구가 있었다.
changeLog를 실시간으로 쌓는 대신, `save()` 시점에 초기 상태와 현재 상태를 대조하여
changeLog를 그 자리에서 한 번에 계산하는 방식을 도입하기로 했다.

### 2.2. 두 가지 모드

**`'realtime'` 모드:**
현재 구현 그대로. Proxy `set` 트랩 발화마다 changeLog에 즉시 기록.
사용자가 `name`을 `'A' → 'B' → 'C'`로 바꾸면 changeLog에 2개 항목이 쌓인다.
개발 단계에서 실제 데이터 흐름을 눈으로 확인하는 데 유리하다.

**`'lazy'` 모드 (신규):**
`save()` 호출 시점에 인스턴스 생성 시 저장해둔 초기 상태 스냅샷(`_initialSnapshot`)과
현재 상태(`getTarget()`)를 필드 단위로 deep diff하여 changeLog를 그 자리에서 생성한다.
평상시 changeLog는 비어있으므로 Proxy set 트랩에서 기록 비용이 발생하지 않는다.
사용자가 `name`을 `'A' → 'B' → 'C'`로 바꾸면 최종 결과인 `A → C` 하나만 기록된다.
네트워크 페이로드가 더 작고 깔끔하며, 서버 측 JSON Patch 파싱 비용도 줄어든다.

### 2.3. 이름 결정 과정

초기에 Mode B의 이름으로 `'snapshot'`을 검토했으나, ard-0002에서 이미 다른 의미로
고착화된 단어(`_snapshot`, `structuredClone` 기반 롤백 스냅샷)와 혼동을 유발한다고 판단하여 반려했다.
이어서 `'diff'`를 검토했으나, "뭔가 realtime이랑 다른 모드인가봐"처럼 메커니즘이 전혀 보이지 않는다는
이유로 반려했다. 최종적으로 **`'lazy'`** 를 채택했다.

`'realtime'`이 "언제 기록하는가"를 이름에 담고 있듯, `'lazy'` 역시 같은 축에서 대칭을 이룬다.
"changeLog 기록을 save() 시점까지 미룬다"는 개념이 Lazy Evaluation(지연 평가)이며,
이 라이브러리 내부에서도 이미 `Lazy Proxy`, `Lazy Singleton`으로 동일한 의미로 쓰고 있다.

### 2.4. 플래그 주입 방식 결정

이 모드를 라이브러리 전역 기본값(default)으로 설정하는 방안을 검토했으나 채택하지 않았다.
이유는 다음과 같다.

개발 환경(development)과 운용 환경(production)의 기본값을 라이브러리가 결정하는 것은
비즈니스 차원의 결정이다. 중간 서버가 몇 개인지, 언제 환경변수가 주입되는지는 회사마다 다르고,
개발 서버에서도 개발자가 `'lazy'` 모드의 체감 성능을 먼저 확인하고 싶을 수 있다.
기본값이 자꾸 늘어나면 개발자가 라이브러리의 암묵적 동작을 추적하기 어려워진다.
따라서 각 DomainState 인스턴스 생성 시 명시적인 플래그로 선택하게 한다.

```javascript
const user = DomainState.fromJSON(jsonText, api, {
    trackingMode: 'realtime', // 기본 흐름, 개발 단계 디버깅에 유리
});

const user = DomainState.fromVO(new UserVO(), api, {
    trackingMode: 'lazy',     // save() 시점에 초기값 대비 diff 계산
});
```

이 플래그들을 나중에 모아서 특정 환경에서 default로 가져가는 방향은 별도 개발 사이클에서
논의하기로 한다.

---

## 3부. DomainCollection 클래스 — e.g.2 시나리오 대응

### 3.1. 이름 결정 과정

e.g.2 시나리오(Root Array)를 담당할 클래스의 이름으로 다음 후보들을 검토했다.

| 후보 | 검토 결과 |
| --- | --- |
| `CollectionState` | Collection이 너무 generic하고, 상태를 추적하는 클래스라는 의미가 Collection이라는 단어로 충분히 전달되지 않는다는 판단 |
| `DomainStateList` | `DomainState`가 중첩되어 읽히는 어색함 |
| `StateList` / `StateArray` | 라이브러리 내부 구현체처럼 보임 |
| **`DomainCollection`** | `Domain*` 네이밍 시리즈(`DomainState`, `DomainVO`, `DomainPipeline`)에 자연스럽게 편입. Java 유추로 `DomainState ≈ Map<K,V>`, `DomainCollection ≈ List<DomainState>` |

**`DomainCollection`** 으로 확정했다.

### 3.2. 두 시나리오의 구조적 차이

같은 "배열 관리"처럼 보이지만, REST API 계층에서 완전히 다른 구조를 가진다.

| 구분             | e.g.1 (Nested Array)                              | e.g.2 (Root Array / DomainCollection)     |
| ---------------- | ------------------------------------------------- | ----------------------------------------- |
| 서버 수신 구조   | `PUT /api/users/{id}` → `UserVO { List<CertVO> }` | `POST /api/certificates` → `List<CertVO>` |
| DomainState 관계 | 부모 DomainState 내부 필드가 배열                 | N개의 독립적인 DomainState들의 컬렉션     |
| changeLog 위치   | 배열 변경이 부모 DomainState의 changeLog에 기록됨 | 각 DomainState가 각자의 changeLog를 가짐  |
| save() 흐름      | 부모 DomainState 1번의 `.save()`                  | `DomainCollection.saveAll()`              |

### 3.3. Nested 선언 방식 — 런타임 연결(방향 B) 채택

DomainVO의 `static fields`에 `type: DomainCollection, itemVO: CertificateVO` 형태로
Nested Array를 선언하는 방안(방향 A)을 먼저 검토했다. 그러나 이 방식은
`DomainVO`가 `DomainCollection`을 import해야 하므로, ard-0002에서 이미 충분히 경험한
**순환 참조** 문제를 재발시킨다는 판단에 즉각 반려했다.

채택한 방향은 **런타임 연결(방향 B)**이다. DomainVO는 `static fields`에 배열 기본값만 선언하고,
`bindCollection()` 호출 시점에 라이브러리가 런타임에 해당 필드를 DomainCollection과 연결한다.

```javascript
// DomainVO — 데이터 스키마만 선언. DomainCollection을 알지 못한다.
class UserVO extends DomainVO {
    static fields = {
        userId:          { default: '' },
        name:            { default: '' },
        certificateList: { default: [] }, // 배열 기본값만 선언
    };
}

// 화면 스크립트 — bindCollection() 시점에 런타임 연결
const { addEmpty, removeChecked } =
    userState.bindCollection('certificateList', '#certGrid', { ... });
```

이 패턴은 `DomainVO`와 `DomainState`의 관계와 동일하다.
`DomainVO`는 `DomainState` 없이도 선언 가능하고, `fromVO()` 호출 시점에 연결이 일어나는 것처럼.

---

## 4부. UI 바인딩 레이어 — 구조적 긴장과 해소

### 4.1. 기존 플러그인의 한계

ard-0002 이전부터 존재하던 두 플러그인의 역할을 다시 정의하면 다음과 같다.

**FormBinder:**
기존 DOM에 이미 작성된 `<form>` 요소와 DomainState를 **바인딩**한다.
DOM이 먼저 있고, State가 그것을 읽는 구조.

**DomainRenderer:**
DomainCollection(또는 서버 응답 배열)을 `<select>`, `<input type="radio">`,
`<button>` 등의 특정 DOM 요소에 **렌더링**한다.
State가 먼저 있고, DOM이 그것을 따라가는 구조.

배열 상태 관리를 위한 **CollectionBinder**를 새로 만든다면 그 역할은
State 기반으로 그리드 DOM을 **동적으로 생성하고 조작**하는 것이다.
State가 먼저 있고, DOM이 그것을 따라가는 구조.

CollectionBinder와 DomainRenderer는 방향이 같지만(State → DOM),
FormBinder는 방향이 정반대다(DOM ← State). 이 셋을 하나의 플러그인에 억지로 합치면
"지금 내가 DOM을 읽어야 하나, 만들어야 하나"를 매 함수마다 분기해야 하는 내부 혼란이 생긴다.

### 4.2. 공통 추상 레이어의 필요성 인식

세 역할을 하나의 구조 안에서 통합하려면, 역할의 **방향**이 아니라 **목적**을 기준으로
추상을 설계해야 한다. 세 역할 모두 "State와 DOM 사이의 인터페이스를 책임진다"는 공통 목적을 가진다.

이것이 **단일 통합 플러그인**을 새로 만들어야 하는 근거다.
기존 두 플러그인을 베이스로 수정하는 방식은 각자의 전제(DOM 먼저 vs State 먼저)가
충돌하여 오히려 더 복잡해진다. 새로 만들고, 기존 것을 흡수(deprecated)하는 게 맞다.

### 4.3. UI 계층의 성격 재정의 — "Domain이 아닌 화면 중심"

플러그인 이름을 짓는 과정에서 중요한 개념적 결정이 내려졌다.

`DomainUI`라는 이름을 처음 검토했으나, 이 이름이 "Domain에 속한 UI"처럼 읽힌다는
문제가 제기되었다. 근본적으로 UI 규칙은 **Domain 단위가 아닌 화면 단위**로 결정된다.

**`CertificateVO`라는 하나의 VO가 있을 때:**

- 목록 화면에서는 읽기 전용 `<span>` 나열
- 등록 폼에서는 편집 가능한 `<input>` 그리드
- 모달에서는 체크박스 선택 테이블

세 화면이 세 개의 다른 UI 선언을 가져야 한다. 이것은 Domain이 결정하는 것이 아니라
**화면이, 더 정확히는 개발자의 목적이** 결정한다.

따라서 이 플러그인과 그것이 도입하는 클래스들은 `Domain*` 접두사를 가져서는 안 된다.
`Domain*` 시리즈(`DomainState`, `DomainVO`, `DomainCollection`, `DomainPipeline`)는
전부 데이터 세계의 구성원이다. 이 플러그인은 데이터 세계와 UI 세계를 잇는 다리이며,
다리는 어느 한쪽 세계에 속하지 않는다.

`ApiHandler`가 `Domain*`이 아닌 것도 같은 이유다. HTTP 세계와 데이터 세계를 잇는 레이어라서.

### 4.4. 플러그인 이름 결정: `UIComposer`

플러그인이 담당하는 세 역할을 하나의 단어로 포괄해야 했다.

| 역할 | 방향 | 흡수 대상 |
| --- | --- | --- |
| 렌더링 | State → DOM 생성 | DomainRenderer |
| 바인딩 | 기존 DOM ↔ State 연결 | FormBinder |
| 컬렉션 조작 | State 기반 동적 DOM 관리 | 신규 |

검토한 후보들:

| 후보 | 검토 결과 |
| --- | --- |
| `DomainUI` | "Domain에 속한 UI" 오독 가능. 화면 중심 정체성과 충돌. |
| `UIBinder` | Binding만 강조됨. Rendering이 안 보임. |
| `UILayer` | 어감이 내부 구현체처럼 들림. |
| `UIBridge` | 역할은 정확하지만 Bridge가 보조 단어처럼 들림. |
| **`UIComposer`** | "재료(State)를 가지고 결과물(UI)을 구성한다"는 동사 Compose. 렌더링, 바인딩, 조작 세 역할을 모두 포괄. React의 Composition 패턴, Vue의 Composables와 같은 어근으로 프론트엔드 커뮤니티에 이미 익숙한 단어. |

**`UIComposer`** 로 확정했다.

### 4.5. UI 규칙 클래스 이름 결정: `UILayout`

개발자가 화면마다 선언하는 UI 규칙 클래스(DomainVO의 대응 역할을 UI 계층에서 담당하는 것)의
이름을 정해야 했다.

초기에 `GridSchema`를 검토했으나, `Schema`라는 단어가 어색하다는 이유로 반려했다.
다른 프론트엔드 프레임워크에서 사용자에게 `Schema`가 들어간 클래스를 직접 쓰게 하는 경우가
드물다는 점도 고려했다.

더 중요한 반려 이유는 확장성이었다. 반드시 `<table>` 구조로만 그린다는 보장이 없다.
`<li>`로 리스트를 만들 수도 있고, `<div>`로 카드 레이아웃을 구성할 수도 있다.
또한 목록 화면에서 데이터를 `<span>`이나 텍스트 노드로만 뿌리는 **읽기 모드**도 지원해야 한다.

이 모든 케이스를 담을 수 있는 단어는 `Schema`보다 `Layout`이 적절하다.
`Layout`은 "이 데이터를 화면에 어떻게 배치하고 표현할 것인가"를 선언한다는 의미를 자연스럽게 전달한다.

`DomainVO`가 데이터 계약을 선언하듯, `UILayout`이 UI 계약을 선언하는 구조:

```text
DomainVO    → 데이터 계약 선언 ("이 도메인의 필드 구조는 이렇다")
UILayout    → UI 계약 선언   ("이 데이터를 화면에 이렇게 표현한다")
```

**`UILayout`** 으로 확정했다.

---

## 5부. UILayout 설계 원칙

### 5.1. DomainVO와의 관심사 분리

DomainVO의 `static fields`에 UI 메타데이터(어떤 `<input>` 타입을 쓸지, 라벨이 무엇인지 등)를
함께 선언하는 방안을 처음 검토했으나 두 가지 이유로 반려했다.

첫째, **관심사 분리 원칙 위반.** DomainVO는 DB Schema를 본 따 만든 데이터 계약 객체다.
여기에 UI 메타데이터가 섞이면 단일 책임 원칙이 깨진다.

둘째, **실제 사용 패턴과의 불일치.** 하나의 VO를 여러 화면에서 가져다 쓸 수 있는데,
어떤 화면에서는 `<radio>`로, 다른 화면에서는 `<select>`로, 또 다른 화면에서는
`disabled="true"`인 `<input type="text">`로 보여줄 수 있다. UI에 대한 결정은
각 화면의 스크립트 안에서 이루어지는 것이 올바르다.

### 5.2. UILayout의 핵심 원칙: HTML Template-Driven Binding

초기 설계에서 `static item = { tag: 'tr', cellTag: 'td' }` 형태로 JS 객체에 태그 이름을
하드코딩하고, 라이브러리가 `document.createElement`로 DOM을 직접 빚어내는 방식을 채택했다.
이는 "개발자에게 백틱 문자열로 HTML을 직접 그리게 하지 않겠다"는 원칙을 지키려는 의도였으나,
**DOM 구조에 대한 통제권이 여전히 라이브러리에 귀속된다**는 점에서 방향이 틀렸다.

SI 환경의 화면은 `<td>` 안에 `<div>`가 3개 들어가고 그 안에 `<span>`이 껴있는 구조가
일상적이다. 이런 기형적인(그러나 실무에서는 완전히 정상적인) 구조를 JS 객체 속성
(`childTag`, `wrapperTag` 등)으로 표현하려 들면 속성이 끝없이 늘어나고,
결국 라이브러리가 감당할 수 없는 복잡도에 도달하게 된다.

**올바른 원칙: 라이브러리는 HTML 구조를 생성하지 않는다. 통제권은 HTML 작성자에게 있다.**

개발자는 HTML 파일 안에 `<template>` 요소로 행(row) 하나의 완전한 DOM 구조를 직접 선언한다.
`UILayout`은 그 템플릿을 복제할 때 **"어떤 요소(selector)에 어떤 필드를 연결할 것인가"**만
정의한다. 구조를 만드는 것이 아니라 데이터를 매핑하는 것이 UILayout의 역할이다.

```html
<!-- HTML 파일 안에 개발자가 직접 선언 — 태그 구조, CSS 클래스, 중첩 div 모두 자유 -->
<template id="certRowTemplate">
    <tr class="text-center cert-row">
        <td>
            <div class="custom-checkbox custom-control">
                <input type="checkbox" class="custom-control-input dsm-checkbox" />
                <label class="custom-control-label"></label>
            </div>
            <input type="hidden" data-field="certId" />
        </td>
        <td class="text-truncate">
            <div class="column">
                <input type="text" class="form-control" data-field="certName" />
                <div class="invalid-feedback"></div>
            </div>
        </td>
        <td class="text-truncate">
            <div class="column">
                <select class="custom-select" data-field="certType"></select>
                <div class="invalid-feedback"></div>
            </div>
        </td>
    </tr>
</template>
```

```javascript
// UILayout — 구조 생성(X), 데이터 매핑(O)
class CertificateEditLayout extends UILayout {
    // 어떤 <template>을 복제해서 쓸 것인가
    static templateSelector = '#certRowTemplate';

    // 템플릿 안의 어떤 요소에 어떤 필드를 연결할 것인가
    static columns = {
        certId:   { selector: '[data-field="certId"]' },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: {
            selector:  '[data-field="certType"]',
            sourceKey: 'certTypes', // 런타임에 DomainCollection이 주입될 key
        },
    };
}
```

이 구조가 가져오는 이점은 명확하다.

- **HTML 구조의 완전한 자유:** `<td>` 안에 `<div>`가 몇 겹이든, `<span>`이 끼어있든,
  `class`가 얼마나 복잡하든 라이브러리가 전혀 관여하지 않는다.
  개발자가 원하는 Bootstrap 구조든, Tailwind CSS 구조든 그대로 쓰면 된다.

- **읽기 모드도 동일한 방식으로 처리:** `mode: 'read'`일 때 라이브러리는 input 요소에
  값을 채우는 대신 `textContent`만 설정하거나, 별도 `readonlyTemplate`을 복제한다.
  HTML 구조 생성 로직이 없으니 읽기/편집 모드 분기도 단순해진다.

- **미결 사항 소멸:** 구 설계의 미결 사항 3번("중첩 셀 지원 범위")은 이 결정으로
  즉각 소멸한다. 라이브러리가 중첩을 고민할 이유 자체가 없어졌다.

HTML Living Standard의 `<template>` 요소는 파싱은 되지만 렌더링은 되지 않으며,
`document.importNode(template.content, true)` 호출 전까지 완전히 비활성 상태다.
이 특성이 행 복제 패턴에 정확히 맞는다.

### 5.3. sourceKey 패턴 — 정적 선언과 런타임 주입 분리

`UILayout` 설계에서 핵심 긴장 지점이 있었다.

`UILayout`은 코드 작성 시점에 선언된다. 그런데 `certTypes` DomainCollection은
`DomainPipeline.run()` 이후, 즉 런타임에야 존재한다. **정적 선언이 런타임 데이터를 직접 참조할 수 없다.**

이 긴장을 해소하기 위해 **`sourceKey` 패턴**을 도입한다.
UILayout에서는 "어떤 데이터 소스를 쓸 것인지"를 문자열 키(key)로만 선언하고,
실제 DomainCollection은 `bind()` 호출 시점에 `sources` 옵션으로 주입받는다.

```javascript
// DomainPipeline 실행 후 — 런타임에 실제 데이터 주입
const result = await DomainState.all({
    certTypes:   api.get('/api/common/codes/CERT_TYPE'), // DomainCollection
    certificate: api.get('/api/certificates/1'),        // DomainState
}).run();

// bind() 호출 시 sources로 주입 — sourceKey 'certTypes'와 실제 컬렉션 연결
result.certificate.bind('#certForm', {
    layout:  CertificateEditLayout,
    sources: { certTypes: result.certTypes },
    mode:    'edit',
});
```

**`bind()` 내부 동작 흐름:**

```text
columns 순회
  → certType 필드: type='select', sourceKey='certTypes' 발견
  → sources['certTypes'] 조회 → DomainCollection 확인
  → DomainCollection.getItems() → DomainState[]
  → 각 DomainState의 데이터로 <option> 생성
  → <select> 완성
```

이 패턴은 Angular의 DI 토큰 패턴과 개념적으로 동일하다.
기존 `DomainRenderer.renderTo()`가 하던 공통코드 렌더링 역할이 이 구조 안으로 자연스럽게 흡수된다.

### 5.4. mode: 'read' | 'edit' 지원

같은 `UILayout`이라도 바인딩 시점에 `mode`로 전체 동작을 override할 수 있다.

- `mode: 'edit'`: `<input>`, `<select>` 등 편집 가능한 form 요소 생성
- `mode: 'read'`: `<span>` 또는 텍스트 노드만 생성. form 요소 없음. UIComposer 없이 읽기 뷰도 가능.

`mode: 'read'` 는 목록 화면에서 DomainCollection을 받아 데이터를 화면에 뿌릴 때 유용하다.
이 경우 굳이 FormBinder 없이도 데이터를 렌더링할 수 있다.

---

## 6부. CollectionBinder — 기능 목록화 및 우선순위

### 6.1. 업계 표준 기능 목록

그리드 UI의 배열 조작과 관련하여 AG Grid, Handsontable, DevExtreme DataGrid 등
엔터프라이즈 그리드 라이브러리의 공통 기능과 SI 환경 실무 패턴을 합쳐 정리했다.

**[기본 행 조작] — Priority: MVP**

- `addEmpty`: 빈 행 추가 (DomainCollection에 새 DomainState 추가 + DOM에 새 행 생성)
- `removeChecked`: 선택된 행 삭제 (역순 splice 처리 필수)
- `removeAll`: 전체 행 삭제
- `selectAll`: 전체 행 선택/해제
- `invertSelection`: 선택 반전
- `selectOne`: 개별 행 선택 — 동적 DOM이므로 이벤트 위임으로 내부 자동 처리. 소비자가 직접 바인딩 불가.

**[UI 보조] — Priority: MVP**

- 행 번호 자동 갱신 (내부 자동 처리)
- 전체선택 체크박스 상태 동기화 (내부 자동 처리)

**[유효성 검사] — Priority: MVP**

- `validate`: save() 전 전체 행 일괄 검증
- 행 단위 유효성 검사 결과 표시 (invalid-feedback 자동 처리)

**[행 순서 조작] — Priority: Extends (patch 버전 커밋)**

- `moveUp`: 선택 행 위로 이동
- `moveDown`: 선택 행 아래로 이동
- 드래그 앤 드롭 정렬 (복잡도가 높으므로 별도 논의)

**[데이터 조작] — Priority: Extends (patch 버전 커밋)**

- `duplicateChecked`: 선택 행 복사/복제
- 특정 필드 일괄 변경: 선택된 행들의 동일 필드를 하나의 값으로 설정 (SI 환경에서 빈번히 사용)

**[상태 조회]**

- `getCheckedItems`: 체크된 DomainState 목록 반환
- `getItems`: 전체 DomainState 목록 반환
- `getCount`: 총 행 수 반환
- `getDirtyItems`: 변경된 항목만 반환 (CollectionBinder가 아닌 DomainCollection 레이어의 기능)

### 6.2. 소비자 API 설계 원칙

소비자가 반환받은 컨트롤 함수를 **원하는 이름으로** destructuring해서 원하는 UI에 바인딩할 수 있어야 한다.

```javascript
DomainState.use(UIComposer);

const {
    addEmpty:      newCertificate,      // 원하는 함수명으로 받기
    removeChecked: deleteCertificates,
    selectAll:     checkAll,
    validate:      validateCerts,
    getChecked:    getSelectedCerts,
} = userState.bindCollection('certificateList', '#certGrid', {
    layout:  CertificateEditLayout,
    sources: { certTypes: certTypeCollection },
    mode:    'edit',
});

// 개발자가 원하는 UI에 원하는 방식으로 연결
$('#btnAdd')     .on('click',  newCertificate);
$('#btnRemove')  .on('click',  deleteCertificates);
$('#checkboxAll').on('change', (e) => checkAll(e.target.checked));
```

개별 행 체크박스 이벤트(`selectOne`)는 동적으로 생성되는 DOM이므로
내부에서 이벤트 위임으로 자동 처리한다. 소비자가 직접 바인딩하는 것은 허용하지 않는다.

**"개발자에게 백틱 문자열로 HTML DOM 요소를 직접 그리게 하는 방법은 절대로 채택하지 않는다."**
**"라이브러리가 JS 객체 설정을 읽어 `document.createElement`로 DOM을 빚어내는 방법도 채택하지 않는다."**
HTML 구조의 통제권은 전적으로 HTML `<template>` 작성자(개발자)에게 있다.
라이브러리는 템플릿을 복제한 뒤, UILayout의 `selector`를 기준으로 데이터를 해당 요소에 꽂을 뿐이다.

---

## 7부. 소스 레이어 구조 변경

### 7.1. 새로운 `ui/` 레이어 추가

기존 `plugins/`에 있는 `FormBinder`, `DomainRenderer`는 **편의 플러그인(utility plugin)**으로,
DSM 워크플로우를 더 쉽게 쓰게 해주는 것들이다. 없어도 DSM은 온전히 동작한다.

`UIComposer`는 다른 종류다. **애플리케이션 아키텍처에 view 레이어 자체를 선택적으로 위임할지
결정하는 플러그인**이다. 단순 편의가 아닌 아키텍처 선택이므로, 소스 구조에서도 다른 층위로 분리한다.

`view`와 `page`라는 이름은 Vue의 `src/views/`, Next.js의 `src/pages/`와 겹쳐
IDE 검색, 번들 분석, 오류 메시지에서 혼란을 유발할 수 있다는 판단 하에 채택하지 않았다.
**`ui/`** 가 가장 명확하고, 기존 어떤 프론트엔드 프레임워크의 프로젝트 디렉토리와도 겹치지 않는다.

```text
src/
├── common/
├── constants/
├── core/          ← Proxy 엔진, URL 처리, 직렬화
├── domain/        ← DomainState, DomainVO, DomainCollection, DomainPipeline
├── network/       ← ApiHandler
├── debug/         ← BroadcastChannel 디버거
├── plugins/       ← 편의 플러그인 (v2.0.0에서 deprecated 예정)
│   ├── domain-renderer/
│   └── form-binder/
└── ui/            ← v2.0.0: view 레이어 선택적 위임 (UIComposer)
    ├── UIComposer.js
    ├── UILayout.js
    ├── binder/        ← FormBinder 흡수
    ├── renderer/      ← DomainRenderer 흡수
    └── collection/    ← CollectionBinder 신규
```

`plugins/`는 향후 Vue, React 등 특정 프론트엔드 프레임워크와의 연동 어댑터를 배치하는
공간으로 역할이 전환될 수 있다.

### 7.2. UILayout export 위치

`UILayout`은 `src/ui/UILayout.js`에 위치하지만, export는 `index.js` 최상위에서 직접 한다.
`DomainVO`가 `src/domain/` 안에 있지만 소비자가 최상위에서 꺼내 쓰는 것과 동일한 패턴이다.

`UIComposer`를 설치하지 않은 상태에서도 `UILayout`을 상속해서 선언할 수 있어야 한다.
`bind()` 호출 시점에 `UIComposer`가 없으면 그 때 에러를 던진다.
`DomainVO`와 `DomainState`의 관계와 동일하다. `DomainVO`는 `DomainState` 없이도 선언 가능하고,
`fromVO()` 호출 시점에 연결이 일어나는 것처럼.

---

## 8부. 기존 플러그인 처우 — deprecated 정책

### 8.1. 결정

`FormBinder`와 `DomainRenderer`는 단순한 형태의 초기 DomainState를 모델로 하여
현재 잘 작동하고 있다. 이 두 플러그인을 즉시 제거하지 않는다.

v2.0.0 릴리즈 시점에 `UIComposer`가 두 플러그인의 모든 역할을 흡수하면,
`FormBinder`와 `DomainRenderer`를 공식 deprecated로 표시하고 migration guide를 함께 제공한다.
deprecated된 플러그인의 실제 제거 시점에 대한 정책(grace period, major version 범위)은
v2.0.0 릴리즈 이후 별도 논의한다.

### 8.2. deprecated 이후 `plugins/` 레이어의 역할

`plugins/` 레이어는 삭제하지 않는다. 향후 Vue, React, Angular 등 특정 프론트엔드 프레임워크와의
연동을 위한 공식 어댑터(adapter) 패키지를 배치하는 공간으로 역할을 재정의한다.

예를 들어 `plugins/vue-adapter/`와 같은 형태로, 프레임워크별 통합 코드가 이 레이어에 위치하게 된다.
이 방향은 DSM의 Framework-Agnostic 정체성을 유지하면서, 특정 프레임워크 사용자를 위한
공식 연동 경험을 제공하는 방향이다.

---

## 9부. 버전 전략

```text
[현재] v0.9.x — ard-0002-alignment.md 개발 목표 진행 중
  ↓
v1.0.0 — ard-0002 목표 완료
  - CSRF 토큰 주입 (ApiHandler 개편)
  - DI Composition Root 전환 (순환 참조 타파)
  - Rollup 직접 사용 빌드 체계 전환
  - Shadow State + useSyncExternalStore 연동
  - DomainPipeline 보상 트랜잭션 + restore() + failurePolicy
  ↓
v1.x.x — 이 문서(ard-0002-extentions.md)의 DomainCollection 영역
  - DomainCollection 클래스 구현 (src/domain/)
  - trackingMode: 'realtime' | 'lazy' 구현
  - CollectionBinder MVP: [기본 행 조작] + [UI 보조] + [유효성 검사]
  - UILayout 클래스 초안 (src/ui/)
  - UIComposer 플러그인 내부 구조 설계 착수 (아직 외부 노출 전)
  ↓
v2.0.0 — UIComposer 통합 플러그인 정식 출시
  - UIComposer 정식 릴리즈 (FormBinder + DomainRenderer + CollectionBinder 통합)
  - mode: 'read' | 'edit' 전면 지원
  - sourceKey 패턴 + DomainPipeline sources 연동 완성
  - [행 순서 조작], [데이터 조작] Extends 기능 추가
  - FormBinder, DomainRenderer 공식 deprecated
  - migration guide 제공
```

### 중간 API 파괴 방지 원칙

v1.x.x에서 CollectionBinder를 독립 플러그인으로 외부에 노출하면, v2.0.0에서 UIComposer로
흡수할 때 소비자가 migration 비용을 두 번 치르게 된다. 이를 피하기 위해 v1.x.x 단계에서
CollectionBinder 로직을 `UIComposer`의 내부 모듈로 처음부터 설계하고,
외부에는 `UIComposer` 이름으로만 노출한다.

---

## 10부. 결정 사항 추가 및 미결 사항

### 10.1. 추가 결정 사항

아래 항목들은 이 문서 작성 이후 외부 검토를 거쳐 추가로 확정된 결정이다.

**[결정] `DomainCollection.saveAll()` MVP 전략 — `batch` 단독 구현**

`batch` (배열 전체를 단일 통신으로 전송), `sequential` (직렬 개별 save),
`parallel` (병렬 개별 save) 세 가지 전략을 검토했다.

SI 레거시 환경에서 1:N 배열 저장 시 백엔드는 대부분 리스트 전체를 한 번에 덮어쓰는 방식
(DELETE ALL + INSERT, 또는 MERGE)으로 처리한다. 프론트엔드에서 `sequential`이나 `parallel`로
쪼개어 개별 API를 쏘는 것은 MSA 환경에서나 유효한 패턴이며, SI 레거시에서는 오히려
트랜잭션이 꼬이기 쉽다. **`batch`를 MVP로 단독 구현하고, `sequential`/`parallel`은
ard-0002의 DomainPipeline 보상 트랜잭션 완성 이후 연계한다.**

**[결정] UILayout — HTML Template-Driven Binding 채택, JS 태그 생성 방식 전면 폐기**

구 설계의 `static item = { tag: 'tr', cellTag: 'td' }` 방식은 "라이브러리가 JS 객체
설정을 읽어 `document.createElement`로 DOM을 빚어내는" 방식으로, DOM 구조에 대한 통제권이
라이브러리에 귀속된다. SI 환경의 복잡한 중첩 DOM 구조를 이 방식으로 표현하려 들면
`childTag`, `wrapperTag` 등 속성이 끝없이 늘어나 감당 불가 수준의 복잡도에 이른다.

**HTML `<template>` 요소 기반으로 전면 교체한다.** 개발자는 HTML 파일에 `<template>` 태그로
행 하나의 완전한 DOM 구조를 직접 선언하고, UILayout은 `templateSelector`로 해당 템플릿을
지정한 뒤 `columns`의 `selector`로 각 필드와 DOM 요소를 매핑하기만 한다.
DOM 구조에 대한 통제권이 완전히 HTML 작성자(개발자)에게 돌아간다. 상세 내용은 5부 참조.

**[결정] `trackingMode: 'lazy'`와 DomainCollection의 상호작용 — `itemKey` 기반 전체 Diff**

`lazy` 모드의 철학은 "모든 평가를 save() 시점까지 미룬다"이다. 행 추가/삭제와 같은
구조 변경에도 예외를 두지 않는다. 예외가 생기는 순간 `realtime`과 `lazy`의 경계가 흐려지고,
"이 연산은 즉시 기록인가 지연인가"를 매번 판단해야 하는 복잡도가 생긴다.

따라서 `lazy` 모드에서 행 추가/삭제 시 DomainCollection 내부 메모리 배열(`getTarget()`)의
상태만 변경하고 changeLog에는 아무것도 기록하지 않는다. `saveAll()` 호출 시점에
인스턴스 생성 시 저장해둔 `_initialSnapshot` 배열과 현재 메모리 배열 전체를 Deep Diff하여
changeLog를 그 자리에서 한 번에 계산한다.

단, 순수 위치(positional) 기반 Diff만으로는 "행 삭제 후 신규 추가" 케이스에서
잘못된 patch를 생성하는 문제가 있다. 예를 들어 초기 배열 `[{id:1},{id:2}]`에서
`{id:1}`을 삭제하고 `{id:3}`을 추가하면, 위치 기준 diff는 이를 두 개의 `replace`로
오독한다. 실제 의도는 `remove {id:1}` + `add {id:3}`이다.

이를 해소하기 위해 `UILayout`에 **`itemKey`** 를 선언한다.
`itemKey`로 지정된 필드를 기준으로 배열 항목의 동일성을 판단하여
LCS(Longest Common Subsequence) 기반 diff를 수행한다.
`itemKey`가 없는 경우에는 신규 항목(`id: null` 또는 `id: ''` 등 초기값인 항목)은
무조건 `add`로, 초기 배열에만 있고 현재 배열에 없는 항목은 `remove`로 처리하는
방어 로직을 적용한다.

```javascript
class CertificateEditLayout extends UILayout {
    static templateSelector = '#certRowTemplate';
    static itemKey = 'certId'; // Diff 시 동일성 기준 필드. lazy 모드에서 필수 권장.

    static columns = {
        certId:   { selector: '[data-field="certId"]' },
        certName: { selector: '[data-field="certName"]', required: true },
        certType: { selector: '[data-field="certType"]', sourceKey: 'certTypes' },
    };
}
```

이 결정으로 `realtime` 트랩 코드와 `lazy` 평가 코드가 완벽하게 격리되어 유지보수가 단순해진다.

---

### 10.2. 미결 사항

아래 항목들은 이 문서의 논의 과정에서 열린 채로 남겨진 것들이다. 향후 구현 단계에서
별도 논의가 필요하다.

1. **CollectionBinder 권장 최대 행 수 및 guard 수치:**
   실측 테스트 후 결정. guard 발동 시 throw할지, console.warn에 그칠지도 미확정.

2. **드래그 앤 드롭 정렬:**
   [행 순서 조작] 카테고리에 포함했으나, 외부 DnD 라이브러리 의존 여부 및
   DSM 내부 구현 범위를 별도 논의해야 한다.

3. **`plugins/` 레이어 프레임워크 어댑터 상세 설계:**
   v2.0.0 이후 의제. Vue용 `useCollection()` composable, React용 `useDomainCollection()` hook
   등의 상세 인터페이스는 이 문서의 범위를 벗어난다.

4. **UILayout `readonlyTemplate` 지원 범위:**
   `mode: 'read'`일 때 `templateSelector`와 별도의 `readonlyTemplateSelector`를 선언할 수 있게
   할지, 아니면 동일 템플릿 내에서 `input` → `textContent` 치환만으로 처리할지 미확정.
   두 접근법의 사용 편의성과 복잡도 트레이드오프를 구현 착수 전 논의한다.

#### ⚠️ 시니어의 잔소리 (구현 전 주의사항)

문서는 완벽한데, 이걸 코드로 옮길 때 네가 늪에 빠질 만한 곳이 딱 두 군데 보여. 미리 경고한다.

1. LCS Diff 알고리즘 성능 최적화 (ard-0002-alignment.md 5.1.2.B)
네가 itemKey 기반으로 LCS(Longest Common Subsequence) 알고리즘 쓴다고 했지? 이론상 완벽해. 근데 LCS 알고리즘은 기본적으로 시간 복잡도가 **O(N * M)**이야.
일반적인 SI 폼에서 배열 요소 50개, 100개 수준이면 티도 안 나겠지만, 엑셀 업로드 같은 걸로 2,000개짜리 배열 들어온 상태에서 saveAll() 누르면 메인 스레드 멈추고 화면 뻗을 수 있어.
구현할 때 초기화된(변동 없는) 앞뒤 인덱스는 먼저 잘라내고(Trim) 남은 중간 알맹이만 LCS 돌리는 식으로 최적화(Heuristic) 빡세게 걸어라.

2. mode: 'read' 처리의 딜레마 (ard-0002-alignment.md 5.2.2.C)
read 모드일 때 폼 요소 생성 안 하고 textContent만 설정한다고 썼지? 조심해라.
JSP 화면 짜는 놈들이 CSS 맞춘다고 `<input type="text" class="form-control">`에다가 패딩이랑 보더 떡칠해놨는데, 네가 라이브러리 단에서 그걸 냅다 텍스트 노드로 바꿔버리면 화면 레이아웃 와장창 깨진다.
제일 안전한 건, readonly나 disabled 속성만 주입하는 거야. 만약 진짜 텍스트로만 뿌리고 싶다면 라이브러리가 강제할 게 아니라, 개발자가 애초에 `<template id="certRowReadTemplate">`처럼 읽기 전용 템플릿을 따로 만들어서 주입하게 유도하는 게 네 설계 철학(통제권 위임)에 더 맞아. 이거 구현 들어가기 전에 확실히 결정해 둬.
