# CDR-0001: Save Strategy Pivot & Library Repositioning

- **Status:** In-Progress
- **Period:** 2026-04-25 ~ ongoing
- **Trigger:** v1.2.4 시점에서 작성된 외부 평가 보고서가 식별한 라이브러리의 시장 적합성·운영 위생·구조 부채 약점들. 이를 해결하기 위한 개선 로드맵을 수립하는 과정에서 라이브러리의 정체성과 기술적 자유도에 대한 본질적 질문이 제기되었다.
- **Decider(s):** 2davi
- **Tags:** positioning, save-strategy, payload, adapter, market-fit, adr-formalization

---

## Context

본 사이클은 v1.2.4 릴리스 직후, 라이브러리의 외부 평가 보고서가 작성된 시점에 시작되었다. 직전 사이클(ard-0003)에서 v2.0.0 방향성을 정의하긴 했으나, 그 방향성은 "DomainState 분리"와 "UIComposer 도입"이라는 내부 개선에 머물렀고, 시장에서 이 라이브러리의 정체성이 무엇인가라는 질문에는 답하지 않았다.

평가 보고서가 식별한 약점은 세 층위였다:

1. 운영 위생 — semantic-release 위생 실패(1.2.x 4연속 patch), 버전 정합성 균열, 한국어 단일 문서 등.
2. 시장 포지셔닝 — "JSP+jQuery SI 구원자"와 "React Headless 상태 관리자" 두 트랙 동시 공략의 무모함.
3. 구조 부채 — DomainState.js 1,403줄 God Class, RFC 6902 PATCH 강제로 인한 백엔드 종속성.

이 사이클은 (1)을 ROADMAP Phase 1~3으로 처리하고, (2)와 (3)에 대한 본질적 결정을 내리는 것을 목표로 시작되었다. 그러나 논의가 진행되면서 (2)와 (3)이 분리된 문제가 아니라 하나의 정체성 문제라는 인식에 도달했다 — 라이브러리가 "RFC 6902 자동 분기 도구"로 정의되는 한 백엔드 종속성과 시장 협소성은 불가분이라는 것.

이 인식이 본 사이클을 단순 "리포지셔닝"이 아닌 "정체성 재정의(Pivot)"로 격상시켰다.

---

## Discussion

### Sub-topic 1: 평가 보고서를 토대로 한 개선 로드맵 수립

#### 발단

EVALUATION.md가 12개 개선 포인트를 식별했다. 그 중 영문화(Phase 6)는 글로벌 채용/OSS 진입에 가장 큰 비용 대비 효과를 가진다고 평가되었다. 그러나 영문화를 곧바로 진행하기 전에 한국어판 내부의 위생·일관성·포지셔닝을 정리할지, 아니면 영문화부터 우선 처리할지 순서 결정이 필요했다.

#### 수집한 선택지와 그 이유

- **Option A — 영문화 우선**
  - 정의: 한국어판은 그대로 두고 영문 README/PORTFOLIO 작성부터 시작.
  - 근거: 글로벌 임팩트가 가장 큰 단일 변경. NPM 페이지가 영어로 보이게 되면 평가자 첫인상이 즉시 개선됨.
  - 한계: 한국어판이 두 트랙을 동시 공략하는 형태로 적혀 있으면 영문 번역도 같은 혼란을 답습.
- **Option B — 한국어판 위생 정리 우선**
  - 정의: 영문화 이전에 한국어판 내부의 운영 위생, 측정 가능성, 포지셔닝을 먼저 정리.
  - 근거: 평가의 첫 관문은 "한 문장 가치 명제의 명료성". 평가자가 README 첫 화면에서 30초 내에 가치를 파악하지 못하면 후속 평가가 무의미. 가치 명제가 한국어로 정리되어야 영문도 같은 명제로 번역 가능.
  - 한계: 영문화 시점이 늦어짐.
- **Option C — 두 작업 병행**
  - 정의: 한국어 정리와 영문 작성을 동시에 진행.
  - 근거: 시간 효율 극대화.
  - 한계: 단일 커미터 환경에서 컨텍스트 스위칭 비용이 큼. 한국어 정리 결과가 영문 작성 도중 변경되면 영문 작성을 재진행해야 함.

#### 결정 또는 미룬 이유

Option B 채택.

본 라이브러리의 평가는 "기술적 정확성"에 앞서 "한 문장 가치 명제의 명료성"으로 결정된다. 한국어 README가 두 트랙을 동시 공략하는 형태로 적혀 있는 한 영문 번역도 같은 혼란을 답습하게 된다. 따라서 영문화 이전에 한국어판의 가치 명제를 한 문장으로 정리하는 것이 선결 과제로 설정되었다.

이 결정에 따라 ROADMAP.md가 6단계로 구성되었으며, Phase 4(포지셔닝 결정)가 본 사이클의 핵심 의사결정 지점으로 부상했다.

### Sub-topic 2: 어댑터 격리 옵션 검토

#### 발단

ROADMAP Phase 4의 초기 형태는 "SI 트랙과 React 트랙 중 하나를 메인으로 결정"하는 구도였다. 이는 한 트랙을 보조로 강등하고 README의 메인 메시지를 다른 트랙으로 집중시키는 마케팅 결정이었다. 그러나 이 결정 자체가 라이브러리의 가치를 절반으로 줄이는 형태라는 문제 인식이 생겼다 — 두 트랙 모두를 살리는 구조적 가능성이 있는가?

코드를 분석해보니 흥미로운 비대칭이 발견되었다. React 어댑터(adapters/react.js)는 이미 subpath export로 격리되어 있고 core에 React 의존성이 0이다. subscribe()/getSnapshot()은 useSyncExternalStore "규약"을 따르는 framework-agnostic 메서드이지 React 의존성이 아니다. 반면 UIComposer는 install() 패턴으로 prototype을 monkey-patching하는 방식이라 진짜 "동등 어댑터"는 아니었다.

#### 수집한 선택지와 그 이유

- **Option A — 모두 install() 플러그인 패턴으로 통일**
  - 정의: SI 트랙(UIComposer)이 사용하는 `DomainState.use(plugin)` install 패턴을 React 어댑터에도 적용.
  - 근거: 한 가지 패턴으로 모든 어댑터를 통일하면 학습 곡선이 단일.
  - 한계: React 훅(useDomainState)은 컴포넌트 함수 호출 컨텍스트에서만 동작하므로 prototype에 메서드로 붙일 수 없다. install 패턴 자체가 React 훅과 호환되지 않는다.
- **Option B — 모두 외부 함수형 모듈로 통일**
  - 정의: UIComposer를 install 패턴 대신 외부에서 import하는 함수(`bindForm(state, ...)`, `bindGrid(collection, ...)`)로 노출. React의 `useDomainState`와 동일한 패턴.
  - 근거: core를 prototype 변형 없이 둠. V8 Hidden Class 친화. 두 어댑터가 진짜 "동등 계층"이 됨.
  - 한계: 기존 사용자에게 breaking change. 단, 본 사이클 결정 시점에 현재 사용자 0명이라 이 비용은 0.
- **Option C — Subpath exports + 선택적 install**
  - 정의: index.js에서 UIComposer 등을 export 제거하고 `@2davi/rest-dsm/adapters/jquery` subpath로만 노출. React와 동일한 subpath 격리.
  - 근거: 현재 구조의 최소 변경 발전형. install 패턴 유지하면서 격리.
  - 한계: 어댑터가 두 가지 다른 사용 형태(install vs hook)를 가지므로 진짜 "동등"은 아니다.

#### 결정 또는 미룬 이유

Option B 채택.

근거는 세 가지다.

첫째, 현재 사용자 0명이라 breaking change 비용이 없다. 비용 없이 가장 깨끗한 구조를 채택할 수 있는 시점이다.

둘째, V8 Hidden Class 친화성을 PORTFOLIO §3-1에서 라이브러리의 기술적 자산으로 강조해왔는데, prototype 변형 패턴(install)은 이 자산과 모순된다. install로 메서드를 추가하면 클래스의 Hidden Class가 런타임에 변경되어 V8 Inline Cache가 무효화될 수 있다. Option B는 prototype 변형을 0으로 만들어 이 자산과 일관된다.

셋째, "core + 두 동등 어댑터" 구도가 시장 메시지를 명료화한다. 어떤 어댑터를 메인으로 정할지 고민하는 대신 "core 자체가 framework-agnostic이고 각 어댑터는 같은 계층의 모듈"이라는 일관된 설명이 가능하다.

### Sub-topic 3: 코드 격리와 시장 포지셔닝의 분리

#### 발단

Option B 채택 직후, "코드 레벨에서 두 어댑터가 동등 계층으로 격리되면 시장 포지셔닝 문제도 자동 해결되는가?"라는 후속 질문이 떠올랐다. 만약 코드 격리만으로 README의 첫 문장이 "core + 두 어댑터" 구도로 자연스럽게 답해진다면 Phase 4의 마케팅 결정이 불필요해진다.

#### 수집한 선택지와 그 이유

- **Option A — 코드 격리만으로 충분**
  - 정의: README 첫 문장을 "core engine + jquery/react adapters"로 답하면 평가자가 30초 내 가치 파악.
  - 근거: 어댑터가 동등하게 격리되었으므로 메시지도 균형 있게 나갈 수 있음.
  - 한계: 평가자가 30초 내 파악해야 하는 것은 "이 라이브러리가 누구의 어떤 통증을 풀어주는가"이지 "어떤 모듈로 구성되어 있는가"가 아니다.
- **Option B — 코드 격리는 별개, 마케팅 메시지는 한 트랙을 메인으로**
  - 정의: 코드는 동등 격리되더라도 README 첫 문장은 한 명확한 사용자 페르소나를 답해야 함.
  - 근거: 첫 문장의 답은 "사용자 페르소나"이지 "구조"가 아님. 모듈 구조는 두 번째 문단의 답.
  - 한계: 한 트랙을 메인으로 정하는 결정 자체가 여전히 필요. 다만 코드는 양쪽 모두 작동하므로 마케팅 결정만의 문제가 됨.

#### 결정 또는 미룬 이유

Option B 채택.

코드 동등 격리가 가능하다는 사실은 두 번째 문단의 보조 카드로 활용할 수 있을 뿐 첫 문단의 답이 되지 않는다. 첫 문단은 여전히 "이 라이브러리는 ___ 환경의 ___ 를 위한 것이다"라는 한 문장 답이 필요하다.

다만 Option B 후 이 결정의 성격이 바뀐다. 코드 격리 전에는 "한 트랙을 메인으로 정하면 다른 트랙은 코드 측면에서도 불완전해진다"는 부담이 있었으나, 코드 격리 후에는 "마케팅 메시지만 한 트랙을 강조해도 코드는 모두 동등하게 작동한다"는 자유도가 생긴다. 즉 마케팅 결정이 코드 결정으로부터 분리된다.

이 분리가 본 사이클의 중요한 발견 중 하나다. 마케팅 메시지 결정은 ADR-0006으로 별도 분리되었다.

### Sub-topic 4: Core의 시장적 가치 분석

#### 발단

Option B 후 어댑터를 떼어내고 core만 남겼을 때 어떤 시장적 가치를 갖는지 명확히 해야 마케팅 메시지가 결정된다. core의 정체성이 흐리면 어떤 사용자 페르소나를 메인으로 정할지도 결정할 수 없다.

#### 수집한 선택지와 그 이유 (평가 축)

다섯 가지 평가 축으로 분석했다.

- **기술적 독창성**
  - 정의: 변경 추적 + HTTP 자동 분기 + 보상 트랜잭션 + RFC 6902 직렬화의 4중 통합.
  - 평가: STRONG. 시장에 이 4가지를 모두 묶은 라이브러리가 거의 없음. Immer는 변경 추적은 있지만 HTTP 자동 분기 없음. Valtio는 Proxy 추적은 있지만 HTTP 자동 분기 없음. TanStack Query는 server state cache는 있지만 변경 추적 없음. fast-json-patch는 RFC 6902는 있지만 변경 추적/롤백 없음.
- **시장 사이즈**
  - 정의: REST API를 사용하는 프론트엔드 시장의 크기.
  - 평가: WEAK. REST가 점진적으로 비주류화 흐름이라 사이즈가 줄어드는 추세. 모던 스택은 GraphQL, tRPC, Server Actions로 이동 중.
- **시장 진입 가능성**
  - 정의: 기존 라이브러리(TanStack Query 등) 대비 인지도와 차별화 명료성.
  - 평가: WEAK. TanStack Query가 mutation/optimistic update 슬롯을 점령. "REST 전용 클라이언트 라이브러리" 슬롯이 좁아짐.
- **포트폴리오 시그널**
  - 정의: 채용/평가 시 라이브러리 자체보다 "이런 라이브러리를 만든 사람"이라는 시그널의 강도.
  - 평가: EXCELLENT. Proxy + Reflect + WeakMap, RFC 다수 인용, 분산 시스템 패턴 client-side 적용 등.
- **장기 OSS 가치**
  - 정의: 독립 OSS로서의 생존 가능성.
  - 평가: ADEQUATE. niche but real.

#### 결정 또는 미룬 이유

종합 결론: 글로벌 트렌딩 라이브러리가 되기는 어렵지만, 기술적 깊이를 증명하는 도구로서는 매우 강하다. 이 강함은 사용자 수에 좌우되지 않는다.

가치 명제의 1차 진화: "RFC 6902로 자동 분기되는 REST 상태 관리자"에서 "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진"으로.

이 시점에서는 가치 명제가 확정되지 않았다. 백엔드 종속성 문제가 §5에서 풀린 후 §7에서 최종 가치 명제가 결정된다.

### Sub-topic 5: PATCH 강제로 인한 백엔드 종속성 인식

#### 발단

§4의 시장 가치 분석에서 확인된 결정적 약점이 있었다. SOM(Serviceable Obtainable Market)이 "RFC 6902 JSON Patch를 받는 백엔드를 가진 팀"으로 좁혀진다는 점이다. 본 라이브러리가 PATCH 페이로드를 RFC 6902 형식으로 강제하므로, 백엔드가 이 형식을 받지 못하면 라이브러리 자체가 무용해진다. 이것이 시장 침투의 결정적 장벽이다.

이 장벽을 기술적으로 풀 수 있는가? "JSON Patch 알고리즘을 라이브러리 내부 로직으로는 살려두면서, 외부에 노출되는 페이로드 형식과 HTTP 메서드를 개발자가 자유롭게 커스터마이즈할 수 있는가?"라는 질문이 제기되었다.

#### 수집한 선택지와 그 이유 (자유도의 차원)

"PATCH를 쓸지 말지 선택"이라는 단순한 표현 안에 6개의 독립된 자유도가 있음을 발견했다.

- **(1) 메서드 분기 로직** — 현재: `dirtyRatio >= 0.7 → PUT, else PATCH` 강제. 자유도 부여 시: 항상 PUT, 항상 POST, threshold 변경, 자체 룰.
- **(2) PATCH 페이로드 포맷** — 현재: RFC 6902 array 강제. 자유도 부여 시: RFC 7396 Merge Patch, JSON:API, 자체 envelope.
- **(3) PUT/POST 페이로드 포맷** — 현재: 전체 객체 강제. 자유도 부여 시: dirty 필드만, envelope 래핑 등.
- **(4) 메서드별 헤더** — 현재: 기본만. 자유도 부여 시: `Content-Type: application/json-patch+json` 등.
- **(5) URL 변형** — 현재: path 그대로. 자유도 부여 시: suffix(`/update`), method override 헤더.
- **(6) 응답 파싱** — 현재: JSON 그대로. 자유도 부여 시: envelope unwrap (`response.data`).

각 자유도는 독립적이며, 한 차원만 풀고 나머지를 강제하면 진짜 자유가 아니다. envelope을 쓰는 백엔드가 PATCH 포맷만 자유롭게 만들면 절반의 시장만 잡힌다.

#### 결정 또는 미룬 이유

6개 자유도 모두를 풀어주는 방향으로 결정.

동시에 core의 5가지 핵심 자산은 보존해야 한다는 제약을 명시했다:

- Proxy 변경 추적 + changeLog + dirtyFields (직렬화 전 표준 내부 표현)
- structuredClone 4종 상태 스냅샷 + 롤백 (메서드/포맷과 무관해야 함)
- Microtask 배칭 + Shadow State (변경 감지 메커니즘)
- Idempotency-Key 생명주기 (메서드와 무관)
- Lazy mode + LCS deep diff (변경 추적 모드)

이 자산들은 L1(변경 추적 엔진)으로 묶이고, 자유도가 풀리는 영역은 L2(직렬화) + L3(라우팅) + L4(전송)이라는 레이어 분리가 도출되었다.

이 분리가 가능하다는 것이 본 사이클의 가장 큰 발견이다. "변경 추적은 표준 내부 포맷, 직렬화는 자유"라는 메시지가 성립한다.

### Sub-topic 6: Save Strategy 인터페이스 옵션 검토

#### 발단

§5에서 6개 자유도를 풀어주기로 결정한 뒤, 이를 어떤 형태의 API로 노출할지 결정이 필요했다. 사용자가 자기 백엔드 컨벤션을 라이브러리에 알려주는 방식이 학습 곡선과 사용성을 결정한다.

#### 수집한 선택지와 그 이유

- **Option α — 옵션 객체 트리**
  - 정의: ApiHandler 옵션에 깊은 객체 트리(`save: { decide, serialize: { POST, PATCH, PUT } }`)를 받음.
  - 근거: JSON 한 덩어리로 표현 — 학습 비용 낮음. 점진적 도입 가능 (옵션 안 주면 현재 동작).
  - 한계: 깊은 옵션 트리는 IDE 자동완성/타입 체킹 어려움. 재사용 단위가 명확하지 않음 (다른 ApiHandler 인스턴스에서 같은 컨벤션 재사용 시 옵션 객체를 통째 복사해야 함).
- **Option β — Strategy 클래스 인터페이스**
  - 정의: `class SaveStrategy { decide(...) {} serialize(...) {} }` 추상 클래스. 빌트인 프리셋도 클래스 (`Rfc6902Strategy`, `MergePatchStrategy` 등).
  - 근거: 재사용 단위가 클래스로 명확. 테스트 단위 1:1. 자체 strategy 작성 시 인터페이스 명확.
  - 한계: 클래스 문법 부담 (특히 함수형 선호 사용자). 약간 무거움. Option B(어댑터 함수화)와 패러다임 불일치.
- **Option γ — 함수형 빌더 + 빌트인 프리셋**
  - 정의: 빌트인 프리셋이 함수 (`strategies.rfc6902()`, `strategies.mergePatch()`). `composeStrategy({ decide, serialize, parseResponse })`로 자체 strategy 구성. ApiHandler 옵션으로 strategy 객체 주입.
  - 근거: Option B(어댑터 함수화)와 일관 — 라이브러리 안에 한 가지 패러다임만 존재. Tree-shaking 친화 (안 쓰는 프리셋은 번들에 안 들어감). 작은 단위 조합.
  - 한계: 학습 곡선 (composeStrategy의 의미 이해 필요).

#### 결정 또는 미룬 이유

Option γ 채택.

근거는 두 가지다.

첫째, Option B(어댑터 함수화)와 동일한 함수형 정신을 유지한다. 라이브러리 안에 두 패러다임이 섞이지 않는다. 클래스(Option β)와 함수(어댑터)가 공존하면 학습 부담이 두 배가 된다.

둘째, Tree-shaking 친화성이다. 사용자가 import한 프리셋만 번들에 포함되므로 빌트인을 6~7개로 늘려도 번들 크기 부담이 비선형 증가하지 않는다.

인터페이스 시그니처의 정확한 형태(ctx 객체 필드 셋, serialize/decide 함수 시그니처)는 본 CDR이 아닌 별도 ADR(ADR-0002)에서 결정된다.

### Sub-topic 7: 가치 명제의 최종 진화

#### 발단

§5와 §6의 결정을 거친 후 라이브러리의 메시지가 어떻게 변하는지 정리해야 했다. 가치 명제가 명확해야 README 첫 문장과 영문화 메시지가 결정 가능하다.

#### 수집한 선택지와 그 이유

가치 명제 후보는 사이클 진행에 따라 진화했다.

- **현재 (v1.2.4)** — "RFC 6902로 자동 분기되는 REST 상태 관리자"
  - 한계: "RFC 6902"가 메시지에 박혀 있어 백엔드 종속성이 시장 진입을 좁힘.
- **Option B 채택 후** — "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진"
  - 한계: "RFC 6902"는 빠졌지만 여전히 직렬화 형식 강제 의미가 남음.
- **Save Strategy 도입 후 (목표)** — "변경은 자동 추적된다. 저장 방식은 당신이 정한다."
  - 강점: "자동"과 "통제"가 한 문장에 공존. 백엔드 종속성이 메시지에서 사라짐. TanStack Query와 차별화 (그쪽은 mutation을 자유롭게 짜지만 변경 추적은 없음).

#### 결정 또는 미룬 이유

세 번째 메시지를 본 사이클의 목표 가치 명제로 채택.

"변경 자동 추적 + 저장 자유"의 조합은 시장에 비어 있는 가치 명제이며, 본 라이브러리의 차별화 위치를 가장 명료하게 표현한다.

이 메시지가 README, PORTFOLIO, NPM description, package.json description에 일관되게 반영되는 것이 본 CDR의 Settled 조건 중 하나다.

### Sub-topic 8: ADR 작성 순서 결정

#### 발단

본 사이클에서 6개의 단위 결정이 도출됨이 확인되었다(인터페이스 시그니처, 시장 조사, lazy 호환성, idempotency 위치, adapter 격리, 포지셔닝 메시지). 어떤 순서로 ADR을 작성할지 의존성 분석이 필요했다.

#### 수집한 선택지와 그 이유

- **Option A — 시장 조사를 첫 ADR**
  - 정의: 빌트인 프리셋 1차 셋이 결정되어야 인터페이스가 그것을 모두 표현 가능한 형태로 설계됨.
  - 근거: 시장 데이터가 "어떤 페이로드 컨벤션을 1차 지원할지" 결정. 인터페이스의 ctx 필드 셋과 serialize 시그니처가 이 결정에 종속.
- **Option B — 인터페이스 시그니처를 첫 ADR**
  - 정의: 인터페이스가 결정되면 시장 조사·lazy 호환성·idempotency 위치 분석의 출력 형태가 명확해짐.
  - 근거: 인터페이스가 골격이라 다른 모든 결정의 기준점.
  - 한계: 인터페이스 설계 시점에 "어떤 컨벤션들을 지원해야 하는가"의 입력이 없으면 ctx 객체 필드 셋이 임의적으로 결정될 위험.

#### 결정 또는 미룬 이유

Option A 채택 (시장 조사를 ADR-0001).

인터페이스 시그니처를 결정하려면 "이 인터페이스로 어떤 컨벤션들을 모두 표현해야 하는가"의 입력이 필요하다. 시장 조사가 그 입력을 제공한다. 즉 ADR-0001(시장 조사) → ADR-0002(인터페이스)의 의존 방향이 자연스럽다. lazy 호환성(ADR-0003)과 idempotency 위치(ADR-0004)는 인터페이스 시그니처에 종속되므로 그 다음에 작성한다.

작성 순서: ADR-0001 → ADR-0002 → ADR-0003, ADR-0004 (병렬 가능) → ADR-0005 → ADR-0006.

### Sub-topic 9: 의사결정 기록 양식 정형화

#### 발단

ADR 작성에 들어가기 전, 기존 references/ 디렉토리의 "ARD" 명칭이 표준인지 점검이 필요했다. 표준은 ADR(Architecture Decision Record)이며, ARD는 일반적으로 Architectural Requirements Document를 의미하므로 명칭이 어긋난다는 점이 인지되었다. 또한 기존 ard-XXXX-alignment.md의 양식 자체가 단위 결정 기록과 다른 장르라는 점도 확인되었다.

#### 수집한 선택지와 그 이유

- **Option A — 기존 ARD 명칭 유지, 양식만 보강**
  - 정의: 명칭은 ARD 그대로, 본문에 Status/Considered Options 섹션을 추가하는 방식.
  - 근거: 기존 자산 변경 최소.
  - 한계: 표준 용어 오용은 평가 시 부정적 시그널. 또한 한 문서에 여러 결정이 묶이는 기존 양식은 단위 추적성이 약하다.
- **Option B — 모두 표준 ADR로 통일**
  - 정의: 기존 ard-XXXX를 ADR 양식으로 변환(rename + 본문 분해). 단위 결정 1건당 1문서.
  - 근거: 표준 통일성.
  - 한계: 기존 4편의 사이클 회고를 분해하면 회고로서의 가치가 손실됨. rename 작업도 부담.
- **Option C — 두 장르 분리**
  - 정의: 기존 ard-XXXX는 "사이클 회고" 장르로 보존(rename 안 함). 신규 단위 결정은 ADR(MADR 0.5)로. 사이클 회고 장르의 신규 명칭은 CDR(Cycle Discussion Record)로.
  - 근거: 두 장르 모두 장르적 가치를 보존. 명칭이 ADR과 CDR로 운율이 맞음. 디렉토리도 cycles/ + decisions/로 분리.
  - 한계: 두 장르가 공존해서 명명 규칙을 학습해야 함. 그러나 README.md에서 한 단락으로 안내 가능.

#### 결정 또는 미룬 이유

Option C 채택.

근거는 두 가지다.

첫째, 기존 4편 ard-XXXX-alignment.md는 사이클 회고 + 다중 결정 묶음이라는 장르적 가치를 가지며, ADR로 강제 변환하면 그 가치가 손실된다. 명명 진화 자체가 저장소의 역사적 자산으로 남는 것이 평가자 시각에서 오히려 시그널이 된다 — "저장소가 시간에 따라 어떻게 진화했는가"를 보여준다.

둘째, 디렉토리 분리(cycles/ + decisions/)가 두 장르의 추적성을 명확하게 한다. 사이클 회고를 찾을 때 cycles/만 보면 되고, 단위 결정을 추적할 때 decisions/만 grep하면 된다.

이 결정에 따라 본 사이클의 첫 외부 산출물로 `chore/docs-cycles-decisions-split` PR이 즉시 진행되었으며, references/cycles/와 references/decisions/ 디렉토리가 신설되었다. CDR_TEMPLATE.md와 ADR_TEMPLATE.md도 본 결정의 일부로 작성되었다.

추가로 양식 자체에 대한 두 가지 세부 지침이 본 sub-topic 진행 중에 정해졌다:

1. CDR은 대화 형식의 흔적을 완전히 배제하고 (1) 발단 / (2) 수집한 선택지와 이유 / (3) 결정 또는 미룬 이유의 3단 구조로 작성한다. 작성 톤은 비기너/주니어 개발자가 학습 정리 노트를 만들듯 구체적이고 세세하게.
2. 모든 문서·코드 주석에서 이모지와 별점 같은 시각 장식을 금지한다. 대체 표현은 영단어 CAPITAL CASE를 사용한다.

이 지침들은 본 CDR과 ADR-0001을 즉시 재작성하는 형태로 적용되었다.

---

## Outcomes

### 라이브러리 가치 명제의 Pivot

본 사이클의 가장 큰 결정. 라이브러리의 정체성이 변경된다.

| 시점 | 메시지 |
| --- | --- |
| v1.2.4 (사이클 진입 시) | "RFC 6902로 자동 분기되는 REST 상태 관리자" |
| Option B 채택 후 | "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진" |
| Save Strategy 도입 후 (목표 메시지) | "변경은 자동 추적된다. 저장 방식은 당신이 정한다." |

이 pivot이 모든 후속 ADR(0001~0006)의 방향성을 결정한다. 본 CDR이 Settled되는 시점은 이 새 메시지가 README, PORTFOLIO, NPM description에 일관되게 반영된 후이다.

### 도출 예정 단위 결정 (ADR)

각 ADR은 본 CDR의 어느 sub-topic(§N)에서 발화했는지 추적 가능하다.

| ADR # | 제목 | Trigger Sub-topic(s) | Status |
| :---: | --- | --- | --- |
| ADR-0001 | Payload Convention 시장 조사 | §5 | Proposed |
| ADR-0002 | Save Strategy 인터페이스 시그니처 | §5, §6 | Pending |
| ADR-0003 | Lazy Mode와 Strategy 호환성 | §6 (open question) | Pending |
| ADR-0004 | Idempotency-Key 위치 분석 | §6 (open question) | Pending |
| ADR-0005 | Adapter 격리 (Option B 패키징) | §2, §3 | Pending |
| ADR-0006 | 라이브러리 포지셔닝 메시지 | §3, §4, §7 | Pending |

§1, §8, §9는 ADR을 직접 도출하지 않는다 — 각각 ROADMAP 작성(외부 산출물), ADR 작성 순서에 대한 메타 결정, 본 사이클의 첫 PR(`chore/docs-cycles-decisions-split`)로 즉시 구현된 양식 결정이다.

각 ADR이 Accepted로 전환될 때 본 CDR의 Outcomes 표 Status를 갱신하고, ADR 본문의 `Related` 필드에 `CDR-0001`을 명시한다.

### 변경된 외부 산출물

본 사이클이 코드/문서에 반영된 흔적:

- references/cycles/, references/decisions/ 디렉토리 신설 — `chore/docs-cycles-decisions-split` PR로 머지 완료.
- CDR_TEMPLATE.md, ADR_TEMPLATE.md 작성 — 본 사이클의 양식 결정의 결과물. §9의 양식 지침에 따라 재작성.

### 결정되지 않은 미해결 질문

본 사이클이 끝나기 전에 확정되어야 할 것:

- 빌트인 프리셋 1차 셋의 정확한 범위 (ADR-0001에서 결정 진행 중).
- Strategy의 parseResponse optional 여부 (ADR-0002에서 결정).
- Idempotency-Key 위치 — 현재 ApiHandler 옵션이지만 strategy 내부로 이동할지 (ADR-0004에서 결정).
- Phase 5(DomainState.js 분리)와 Save Strategy 도입 작업의 통합/분리 여부 (ADR-0006 또는 후속 CDR에서 결정).

---

## Reflections

본 사이클이 In-Progress 상태이므로 회고는 Settled 시점에 작성한다.

사이클 종료 조건: ADR-0001~0006 모두 Accepted 상태 + Save Strategy 구현 완료 + ROADMAP Phase 4c 종료 + 새 가치 명제가 README/PORTFOLIO/NPM description에 일관 반영.

---

## Links

### 직전 사이클
- ard-0003-alignment.md — v1.x 마지막 사이클, "기능 확장 + 전략 전환"

### 본 사이클의 트리거 / 산출물 (저장소 외부, 로컬 관리)
- EVALUATION.md — 외부 평가 보고서 (사이클 트리거)
- ROADMAP.md — 한국어판 개선 로드맵 (사이클 산출물)
- CLAUDE.md — Claude Code 운영 가이드

### 외부 참조
- RFC 6902 — JSON Patch
- RFC 7396 — JSON Merge Patch
- RFC 9110 — HTTP Semantics
- IETF — Idempotency-Key HTTP Header Field (draft)
- TanStack Query — Mutations (경쟁 분석 대상)
- Valtio (Proxy 기반 상태 관리 비교 대상)

### 관련 PR (머지 완료)
- chore/docs-cycles-decisions-split — 디렉토리 마이그레이션 + ADR/CDR 양식 정형화
- docs/cdr-0001-save-strategy-pivot — 본 CDR 작성
- docs/adr-0001-payload-conventions-survey — ADR-0001 작성
