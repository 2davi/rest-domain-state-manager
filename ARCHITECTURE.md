# rest-domain-state-manager 아키텍처 종합 설명서

본 문서는 `rest-domain-state-manager` 라이브러리의 전체 설계 구조,
각 레이어의 역할과 책임, 그리고 주요 의사결정 과정을 종합 정리한 것이다.

---

## Part 1. 라이브러리 설계

### 1. 목표와 역할 정의

- `fetch()`로 받아온 JSON DTO를 역직렬화하여 JS Object로 변환한다.
- 이 Domain Object를 JS Proxy로 감싸, 화면이 떠 있는 동안 **단일 상태 소스(Single Source of Truth)** 로 사용한다.
- DOM 요소를 이 Proxy 객체와 바인딩하며, 주요 필드의 값 변경 시 Proxy를 통해 내부 상태를 수정한다.
- 저장 시점에 Proxy 내부에서 수집된 변경 이력(로그 배열)을 이용하여:
  - 전체 객체를 PUT으로 보내거나,
  - RFC 6902 JSON Patch 규칙을 따른 부분 변경 문서를 만들어 PATCH로 전송하거나,
  - 신규 리소스일 경우 POST 요청을 생성한다.

### 2. 전체 아키텍처 레이어

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        외부 개발자 진입점                           │
│                 rest-domain-state-manager.js                        │
│       { api, DomainState, DomainVO, DomainPipeline,                 │
│         DomainRenderer }                                            │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │                              │
┌──────────────▼───────────────┐  ┌───────────▼──────────────────────┐
│          model/              │  │           plugin/                │
│                              │  │                                  │
│  DomainState                 │  │  domain-renderer/                │
│    ├─ fromJSON()             │  │    ├─ DomainRenderer.js          │
│    ├─ fromForm()             │  │    │    (install → prototype 주입)│
│    ├─ fromVO()               │  │    └─ renderers/                 │
│    ├─ save()                 │  │         ├─ select.renderer.js    │
│    ├─ remove()               │  │         ├─ radio-checkbox.js     │
│    └─ all() ─────────────────────────────▶└─ button.renderer.js    │
│                              │  └──────────────────────────────────┘
│  DomainVO                    │
│    └─ toSkeleton()           │
│       getValidators()        │
│       getTransformers()      │
│       checkSchema()          │
│                              │
│  DomainPipeline              │
│    ├─ after()                │
│    └─ run()                  │
└──────────────┬───────────────┘
               │ 내부 호출
┌──────────────▼────────────────────────────────────────────────────┐
│                        src/ (내부 레이어)                         │
│                                                                   │
│  handler/         core/              constants/       debug/      │
│  api-handler.js   api-proxy.js       error.messages   debug-      │
│  (fetch 래퍼)     api-mapper.js      log.messages     channel.js  │
│                   url-resolver.js    op.const                     │
│                                      protocol.const               │
│                   common/            channel.const                │
│                   js-object-util.js                               │
└───────────────────────────────────────────────────────────────────┘
```

### 3. DTO(디티오) → DomainState 생성 플로우

1. `fetch()`로 JSON DTO 수신.
2. `toDomain()`이 JSON String을 JS Object로 변환:
   - JSON 필드명 ↔ 도메인 필드명 매핑.
   - DomainVO가 선언된 경우, 스키마 정합성 검증 및 타입 보정.
3. 도메인 모델을 `createProxy()`로 감싸는 팩토리 호출:
   - `proxy`, `getChangeLog`, `getTarget`, `clearChangeLog` 네 개의 클로저(Closure)를 `DomainState`가 보관.
4. 화면에서 `domainState.data`(= Proxy)를 직접 사용:
   - 읽기: 화면 렌더링에 활용.
   - 쓰기: `domainState.data.name = '...'` 식으로 갱신 시 changeLog에 자동 기록.
5. 저장 시점:
   - 변경 이력 기반으로 JSON Patch 또는 최종 DTO 생성.
   - `save()`가 isNew 플래그와 changeLog 길이를 보고 POST / PATCH / PUT 자동 분기.

### 4. Proxy 핸들러(Handler) 설계

#### 4.1 핵심 트랩(Trap)

- **get(겟)**
  - 기본 역할: `Reflect.get`으로 target 값을 반환.
  - 반환값이 Object / Array 이면 **deep proxy** 로 다시 감싸서 반환.
  - 경로 정보를 자식 Proxy에 전파 (예: `/user`, `/user/address`).
  - Symbol(심볼) 프로퍼티, `toJSON`, `then`, `valueOf`는 bypass — `JSON.stringify`와 Promise(프로미스) 체인을 보존하기 위함.

- **set(셋)**
  - 호출 시점: `proxy.name = 'Davi'` 등 필드 갱신.
  - 기존에 없던 키: changeLog에 `op: 'add'`로 기록.
  - 기존에 있던 키 값 변경: `op: 'replace'`로 기록.
  - 내부 target에도 실제 값을 반영한다.

- **deleteProperty(딜리트프로퍼티)**
  - 호출 시점: `delete proxy.phone`.
  - 실제 target에서 삭제.
  - changeLog에 `op: 'remove'`, `oldValue` 기록.

#### 4.2 경로 누적 방식

루트 Proxy 생성 시 `basePath = ''`에서 시작하며,
중첩 객체에 접근할 때마다 `makeHandler(basePath + '/' + prop)`을 재귀 호출한다.

```text
proxy.address.city = 'Seoul'
  → get 트랩: prop='address', path='/address' → 새 Proxy 반환
  → set 트랩: prop='city', path='/address/city' → changeLog에 기록
```

### 5. 변경 이력 구조 및 JSON Patch 매핑

#### 5.1 내부 변경 로그 포맷

```javascript
{ op: 'add' | 'replace' | 'remove', path: '/name', value: 'Davi', oldValue: 'Lee' }
```

#### 5.2 RFC 6902 JSON Patch 매핑

- `add` / `replace`: `value`에 `newValue` 사용.
- `remove`: `value` 필드 생략.
- 서버가 PATCH를 지원하지 않을 경우: 변경 로그를 재생하여 최종 DTO를 구성, PUT으로 전송.

### 6. 폼(Form) 바인딩 전략

- `fromForm(formEl, handler, opts)`은 `HTMLFormElement` 또는 form의 id 문자열을 받는다.
- 각 `input[name]`의 name 속성을 경로 표현식(`address.city`)으로 사용하며,
  `.`(점)으로 중첩 접근, Proxy의 해당 위치에 값을 대입한다.
- 이벤트 추적 전략:
  - `input[type='text']`, `textarea` → **blur(블러)** 시 추적 (타이핑 중 불필요한 set 트랩 방지).
  - `select`, `radio`, `checkbox` → **change(체인지)** 시 추적 (선택 즉시 값이 확정되므로 즉시 반영).

### 7. save() 분기 전략

```text
isNew === true
    → POST  (toPayload — 전체 객체 직렬화)

isNew === false
    changeLog.length > 0
        → PATCH (toPatch — RFC 6902 JSON Patch 배열)
    changeLog.length === 0
        → PUT   (toPayload — 전체 객체 직렬화)
```

POST 성공 후 `isNew`는 `false`로 전환된다.
PATCH / PUT 성공 후 `clearChangeLog()`가 호출된다.

### 8. URL 조합 전략

두 가지 입력 방식을 모두 지원하며 충돌 시 자동 해소한다.

- **방식 (1) 구조 분해형**: `{ protocol, host, basePath }`
- **방식 (2) 통합 문자열형**: `{ protocol, baseURL }`

최종 URL = `protocol + host + basePath + requestPath`

프로토콜 결정 우선순위:

```markdown
1. 명시적 protocol 인자
2. env 플래그 → DEFAULT_PROTOCOL[env]
3. env 없음 + debug: true  → HTTP
4. env 없음 + debug: false → HTTPS
```

충돌 해소 (host + baseURL 동시 입력):

| 케이스 | 조건 | 처리 |
| -------- | ------ | ------ |
| A | baseURL이 host로 시작 | basePath로 해석 + 콘솔 경고 |
| B | baseURL 안에 host 포함 | host 무시 + 콘솔 경고 |
| C | 두 값이 무관 | Error throw |

### 9. DomainPipeline 실행 모델

```javascript
DomainState.all(resourceMap, { strict: false })
  .after('roles', handler)   // 등록 순서 = 실행 순서
  .after('user',  handler)
  .run()
```

실행 단계:

1. `Promise.allSettled()`로 모든 리소스를 병렬 fetch.
   - fetch 실패는 `_errors`에 기록 (`strict: false`) 또는 즉시 reject (`strict: true`).
2. `after()` 큐를 등록 순서대로 순차 `await`.
   - 핸들러 실패도 동일한 strict 분기 적용.
3. `{ ...DomainStates, _errors? }` 반환.

### 10. 플러그인(Plugin) 시스템

```javascript
DomainState.use(plugin)  // install(DomainState) 계약 강제
```

- `plugin.install(DomainState)`가 없으면 TypeError.
- `_installedPlugins Set`으로 중복 등록 방지.
- `use()` 자체가 `DomainState`를 반환하므로 체이닝 가능.

### 11. 디버그(Debug) 팝업

`BroadcastChannel` — 브라우저 내장 Web API, 외부 의존성 없음.

- 채널명: `'dsm_debug'`
- 탭 ID: `dsm_${Date.now()}_${random}`
- BroadcastChannel은 자기 자신이 보낸 메시지를 수신하지 않는다.
  TAB_PING을 팝업이 직접 broadcast하고, 각 탭이 TAB_REGISTER로 응답하는 구조로 이 제약을 우회한다.

---

## Part 2. 의사결정 과정 및 고려 사항

### 1. Proxy 적용 범위에 대한 선택

#### 1.1 서비스/도메인 계층 vs 뷰/상태 계층

- **대안 A: 서비스/도메인 계층에서만 Proxy 사용**
  - Proxy는 데이터/도메인 레이어에서만 쓰고, 컴포넌트/뷰에는 평범한 객체를 넘기는 방식.
  - 장점:
    - React 등 프레임워크의 불변성/참조 비교 규칙과 충돌을 최소화.
    - 버그 발생 시 디버깅 범위가 서비스 내부로 좁혀짐.
  - 단점:
    - "속성 대입만으로 REST 동기화"를 뷰 계층에서 직접 누리기 어려움.

- **대안 B: 뷰/상태 계층까지 Proxy 전달**
  - Proxy 객체를 React State나 전역 Store에 그대로 넣고 사용.
  - 장점:
    - `model.name = '...'` 같은 직관적인 코드로 변경 및 동기화 트리거 가능.
  - 단점:
    - React의 얕은 비교, reference 기반 렌더링 전략과 충돌 가능성.
    - `Array.isArray`, `instanceof Array` 등의 타입 체크에서 Proxy로 인해 예상치 못한 동작 발생 가능성.
    - 디버깅 난도 상승 (개발자 도구에 보이는 값과 실제 트랩 흐름 사이 괴리 가능성).

> **의사결정**
>
> 1차 구현 및 네이티브 JS 테스트 단계에서는 **서비스/도메인 계층에서만 Proxy를 사용**하는 방향을 채택한다.
> React 등 상위 프레임워크로 확장할 때는 이후 별도 실험 브랜치에서 평가하는 확장 갈래로 남겨 둔다.

### 2. save() HTTP 메서드 전략에 대한 선택

#### 2.1 전체 PUT만 사용

- 장점:
  - 구현 단순. 변경 추적 로직이 필요 없음.
- 단점:
  - "경로 단위 변경 추적"이라는 핵심 요구사항을 만족하지 못함.
  - 대형 객체일 경우 불필요한 네트워크 비용 발생.

#### 2.2 PATCH만 사용

- 장점:
  - 변경 경로/필드만 서버에 전달 가능.
- 단점:
  - 변경이 없을 때도 빈 배열을 보내는 어색함이 있음.
  - POST Method 분기가 별도로 필요하므로 단독으로 완결되지 않음.

#### 2.3 POST / PATCH / PUT 혼합

- `isNew === true`이면 POST, 변경 있으면 PATCH, 변경 없으면 PUT.
- 장점:
  - 각 시나리오에 맞는 HTTP 메서드를 의미론적으로 정확히 사용.
  - 변경이 없는 재저장을 PUT으로 처리해 서버 멱등성(Idempotency)을 보장.

> **의사결정**
>
> **POST / PATCH / PUT 혼합 전략**을 채택한다.
> `isNew` 플래그와 changeLog 길이의 조합으로 분기하며,
> 변경 로그를 RFC 6902 JSON Patch 문서로 변환하여 PATCH 호출한다.

### 3. deep proxy 적용 범위에 대한 선택

#### 3.1 순수 Object만 대상으로 시작

- 장점:
  - 경로 추적과 변경 로그 구조를 단일 Object 기준으로 먼저 명확히 검증 가능.
  - Proxy 로직이 단순해지고, 배열 특수 케이스(Array 메서드, length 조작 등)를 나중으로 미룰 수 있음.
- 단점:
  - 실무에서는 리스트/컬렉션이 거의 항상 등장하므로, 배열 지원 없이는 사용 범위가 좁음.

#### 3.2 Object + Array를 초반부터 고려

- 장점:
  - JSON Patch의 `/items/0/name` 같은 패턴을 자연스럽게 포함.
  - 설계 초기에 전체 그림을 잡을 수 있음.
- 단점:
  - `push`, `splice` 등 Array 변형 메서드 래핑이 필요하여 1차 구현 복잡도 증가.

> **의사결정**
>
> 설계 자체는 **Object + 1차원 Array까지**를 전제로 두되,
> 구현 순서는 "순수 Object → 단순 Array 인덱스 접근 → 중첩 구조" 순의 **단계적 접근**을 택한다.
> Array 변형 메서드(`push`, `splice`)의 추적 정밀도 개선은 추후 과제로 남긴다.

### 4. 변경 기록 포맷에 대한 선택

#### 4.1 내부 전용 포맷 + 변환 레이어

- 내부적으로는 `{ op, path, oldValue, newValue }` 식으로 자유롭게 기록.
- REST 호출 직전, RFC 6902 JSON Patch 문서로 변환하거나 최종 DTO로 재구성.
- 장점:
  - 클라이언트 내부에서 oldValue, diff 등 추가 정보를 자유롭게 활용 가능.
  - 백엔드 변경이나 프로토콜 변경에 유연하게 대응.

#### 4.2 처음부터 JSON Patch 형식 고정

- 로그를 바로 JSON Patch 배열 형태로 쌓음.
- 장점: 서버 구현과 바로 연결 가능.
- 단점: oldValue 등 추가 정보가 필요할 때 유연성이 떨어짐.

> **의사결정**
>
> 클라이언트 내부에서는 **내부 전용 포맷**을 사용하고,
> REST API 레이어(`api-mapper.js`)에서 JSON Patch 또는 DTO 형식으로 변환하는 추상화 레이어를 둔다.

### 5. 폼 바인딩 방식에 대한 선택

#### 5.1 기존 방식 — 직접 DOM 조회

- 저장 시점마다 `document.getElementById` 등으로 폼 요소 값을 조회하고 JSON을 수작업으로 구성.
- 이 라이브러리의 존재 이유 자체가 이 방식을 제거하는 것이므로, 선택지에서 제외한다.

#### 5.2 경로 기반 바인딩

- 각 폼 요소의 `name` 속성에 경로 표현식(`address.city`)을 기록.
- 이벤트 핸들러에서 경로를 파싱하여 Proxy 객체의 해당 위치에 값을 대입.
- 장점:
  - Proxy 쪽에서는 set 트랩만 구현해 두면, 바인딩 로직은 단순하게 유지 가능.
  - `fromForm()` 팩토리 하나로 폼 초기화 + 이벤트 바인딩 + 상태 추적이 완결.

> **의사결정**
>
> **경로 기반 폼 바인딩**을 전제로 Proxy와 연동하는 구조를 채택한다.
> 폼 요소 ↔ Proxy 속성 연결 고리만 맞추면,
> 나머지 JSON 직렬화 / REST 호출은 `DomainState.save()`가 책임지는 형태로 간다.

### 6. DomainPipeline strict 기본값에 대한 선택

#### 6.1 strict: true를 기본값으로

- 첫 실패에서 즉시 reject하여 개발자가 에러를 빠르게 인지.
- 단점: 독립적인 리소스 fetch 실패가 전체 파이프라인을 중단시키는 과잉 반응.

#### 6.2 strict: false를 기본값으로

- 실패한 리소스는 `_errors` 배열에 기록하고 나머지를 계속 진행.
- Request(요청) / Response(응답)는 이미 완료된 비용이다.
  후처리 핸들러 실패는 독립적인 관심사이므로,
  계속 진행하면서 `_errors`로 실패 지점을 추적하는 것이 유지보수에 유리하다.

> **의사결정**
>
> **strict: false를 기본값**으로 채택한다.
> 엄격한 중단이 필요한 케이스에서만 `{ strict: true }`를 명시하도록 한다.

### 7. 디버그 팝업 통신 방식에 대한 선택

#### 7.1 window.opener 방식

- 팝업에서 `window.opener`로 부모 탭의 전역 객체에 직접 접근.
- 단점:
  - 동일 출처(Same Origin)에서만 동작.
  - 탭 종료 감지가 어렵고, 다중 탭 지원이 자연스럽지 않음.

#### 7.2 BroadcastChannel 방식

- 브라우저 내장 Web API로 외부 의존성 없음.
- 탭 종료 감지(`beforeunload` + `TAB_UNREGISTER`)와 다중 탭 지원이 자연스럽게 구성됨.
- BroadcastChannel은 자기 자신이 보낸 메시지를 수신하지 않는다는 제약이 있으나,
  TAB_PING을 팝업이 직접 broadcast하는 구조로 우회 가능.

> **의사결정**
>
> **BroadcastChannel** 방식을 채택한다.
> 팝업 HTML 자체도 `_buildPopupHTML()` 함수로 문자열 생성하여
> `window.open()` + `document.write()`로 주입함으로써,
> 별도 팝업 HTML 파일 없이 단일 모듈로 디버거를 완결한다.

### 8. radio / checkbox name 속성 기본값에 대한 선택

`DomainRenderer`의 `radio` / `checkbox` 렌더링 시, `input[name]` 속성 기본값을 무엇으로 할지 결정이 필요했다.

#### 8.1 별도 name 옵션 필수화

- 개발자가 항상 `name`을 명시해야 함.
- 단점: 대부분의 경우 valueField와 같은 값을 반복 입력하는 중복 발생.

#### 8.2 valueField를 name 기본값으로 사용

- `radio` / `checkbox`의 `input[name]`을 `valueField`와 동일하게 기본 설정.
- MyBatis(마이바티스) form submit 시 필드명이 자동으로 일치하여 별도 매핑 불필요.
- 별도 지정이 필요한 예외 케이스만 `name` 옵션으로 오버라이드.

> **의사결정**
>
> **valueField를 name 기본값**으로 채택한다.
> MyBatis ResultMap 필드명과의 자동 일치를 의도한 설계이며,
> SI 프로젝트의 JSP 폼 submit 패턴에서 별도 설정 없이 동작하도록 한다.

---

본 문서는 네이티브 JavaScript 위에서 Proxy 모듈의 핵심 개념(깊은 경로 추적, 변경 로그, DTO 변환)을 검증하고,
이후 React 등 상위 프레임워크로 확장할 때도 재사용 가능한 형태를 목표로 한 설계 기록이다.

각 단계(순수 Object, Array, 중첩 구조, 실제 REST 연동)에 대한 테스트케이스와 제약사항은
`proxy.test.html`의 6개 케이스와 본 문서의 의사결정 기록을 함께 참고한다.
