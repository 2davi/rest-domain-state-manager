# CDR-0001: Save Strategy Pivot & Library Repositioning

- **Status:** In-Progress
- **Period:** 2026-04-25 ~ ongoing
- **Trigger:** v1.2.4 시점에서 작성된 외부 평가 보고서(`EVALUATION.md`)가 식별한 라이브러리의 시장 적합성·운영 위생·구조 부채 약점들. 후속으로 작성된 한국어판 개선 로드맵(`ROADMAP.md`) Phase 4의 포지셔닝 결정 과정에서 라이브러리의 정체성과 기술적 자유도에 대한 본질적 질문이 제기되었다.
- **Decider(s):** 2davi
- **Tags:** positioning, save-strategy, payload, adapter, market-fit, adr-formalization

---

## Context

본 사이클은 v1.2.4 릴리스 직후, 라이브러리의 외부 평가 보고서가 작성된 시점에 시작되었다. 직전 사이클(ard-0003)에서 v2.0.0 방향성을 정의하긴 했으나, 그 방향성은 "DomainState 분리"와 "UIComposer 도입"이라는 내부 개선에 머물렀고, **시장에서 이 라이브러리의 정체성이 무엇인가**라는 질문에는 답하지 않았다.

평가 보고서가 식별한 약점은 세 층위였다:

1. **운영 위생** — semantic-release 위생 실패(1.2.x 4연속 patch), 버전 정합성 균열, 한국어 단일 문서 등.
2. **시장 포지셔닝** — "JSP+jQuery SI 구원자"와 "React Headless 상태 관리자" 두 트랙 동시 공략의 무모함.
3. **구조 부채** — `DomainState.js` 1,403줄 God Class, RFC 6902 PATCH 강제로 인한 백엔드 종속성.

이 사이클은 (1)을 ROADMAP Phase 1~3으로 처리하고, (2)와 (3)에 대한 본질적 결정을 내리는 것을 목표로 시작되었다. 그러나 논의가 진행되면서 **(2)와 (3)이 분리된 문제가 아니라 하나의 정체성 문제**라는 인식에 도달했다 — 라이브러리가 "RFC 6902 자동 분기 도구"로 정의되는 한 백엔드 종속성과 시장 협소성은 불가분이라는 것.

이 인식이 본 사이클을 단순 "리포지셔닝"이 아닌 **"정체성 재정의 (Pivot)"**로 격상시켰다.

---

## Discussion

### 1. 평가 보고서 → 한국어판 개선 로드맵

`EVALUATION.md` 작성 후 식별된 12개 개선 포인트를 영문화 이전에 한국어판 내에서 정리하는 로드맵이 필요했다. 의존성을 분석한 결과:

- Phase 1 (위생) ↔ Phase 2 (릴리스 자동화)는 거의 독립
- **Phase 4 (포지셔닝 결정)이 Phase 6 (영문화)을 결정** — 포지셔닝이 흐린 상태로 영문화하면 한국어판의 혼란이 그대로 영어로 복제됨
- Phase 5 (구조 부채)는 영문화와 독립

이 의존성 분석이 6단계 로드맵으로 정리되었고(`ROADMAP.md`), Phase 4가 본 사이클의 핵심 의사결정 지점으로 부상했다.

### 2. 어댑터 동등 분리의 가능성 — Option B 채택

Phase 4의 "SI vs React 메인 트랙 결정"에 대해 사용자가 다른 각도의 질문을 제기했다:

> "SI와 React, 이 둘을 모두 플러그인으로 동등한 계층 취급을 하고 떼어내서 메인 코드를 분리하는 게 가능할까?"

이 질문은 "두 트랙 중 하나 선택"이라는 프레임을 깨고, **"두 트랙 모두 어댑터로 격리, core는 framework-agnostic 엔진으로 정의"**라는 새로운 가능성을 열었다. 코드 분석 결과:

- `adapters/react.js`는 이미 subpath export로 격리되어 있고, core에 React 의존성은 0이었다 (`subscribe`/`getSnapshot`은 useSyncExternalStore "규약"이지 React 의존성이 아님).
- `UIComposer`는 `install()` 패턴으로 부분 플러그인화되어 있으나, prototype을 monkey-patching하는 방식이어서 진짜 "동등 어댑터"는 아니었다.

세 가지 분리 옵션을 비교했다:

- **Option A** — 모두 `install()` 플러그인으로 통일: React 훅이 prototype에 붙을 수 없어 기각.
- **Option B** — 모두 외부 함수형 모듈로 통일: prototype 변형 0, V8 친화, 진짜 동등 계층. 단, 기존 사용자에게 breaking change.
- **Option C** — Subpath exports + 선택적 install: 현재 구조의 최소 변경 발전형, non-breaking.

사용자가 **Option B를 선택**했다. 결정 근거:
- 현재 사용자 0명이라 breaking change 비용이 없음.
- V8 Hidden Class 친화성 주장(PORTFOLIO §3-1)과 가장 정합적.
- "core + 두 어댑터" 구도가 시장 메시지를 명료화함.

### 3. 그러나 — 코드 분리는 시장 포지셔닝을 해결하지 않는다

Option B 결정 직후 짚어야 했던 핵심: **"코드 레벨에서 두 어댑터가 동등해도, 마케팅 레벨에서는 한 트랙이 메인 메시지여야 한다."** README 첫 문장은 한 문장으로 타겟 사용자를 답해야 평가자가 30초 안에 가치를 파악함.

이 통찰이 다음 질문으로 이어졌다 — Option B 후 **core 자체의 시장적 가치는 무엇인가?**

### 4. Core의 시장적 가치 분석

5가지 축으로 평가:

| 축 | 평가 |
| --- | :---: |
| 기술적 독창성 (변경 추적 + HTTP 자동 분기 + 보상 트랜잭션 + RFC 6902 4중 통합) | ★★★★ |
| 시장 사이즈 (REST 비주류화 흐름) | ★★ |
| 시장 진입 가능성 (TanStack Query 그늘) | ★★ |
| 포트폴리오 시그널 | ★★★★★ |
| 장기 OSS 가치 | ★★★ |

핵심 결론: **Core는 글로벌 트렌딩 라이브러리가 되기는 어렵지만, 기술적 깊이를 증명하는 도구로서는 매우 강하다. 그 강함은 사용자 수에 좌우되지 않는다.**

가치 명제 진화:
- 현재: "RFC 6902로 자동 분기되는 REST 상태 관리자"
- Option B 후: "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진"

### 5. PATCH 강제로 인한 백엔드 종속성 인식

이 시점에서 사용자가 본 사이클의 가장 큰 통찰을 제기했다:

> "PATCH 방식이 강제되는 것이 문제라고 생각했어. 개발자의 백엔드 자율도를 떨어뜨리잖아. JSON Patch 알고리즘을 라이브러리의 내부 로직으로 살려두면서, 개발자의 백엔드 API 작성 자유도를 거의 무한으로 만들어버릴 방법은 없을까?"

이 질문은 SOM을 한 자릿수 배 확장할 수 있는 결정적 통찰이었다. 분석 결과 "PATCH를 쓸지 말지 선택"이라는 표현 안에 6개의 독립된 자유도가 있음을 확인했다:

1. 메서드 분기 로직 (현재: dirtyRatio 0.7 강제)
2. PATCH 페이로드 포맷 (현재: RFC 6902 array 강제)
3. PUT/POST 페이로드 포맷 (현재: 전체 객체 강제)
4. 메서드별 헤더
5. URL 변형
6. 응답 파싱

이 6개를 모두 자유롭게 만들지 않으면 진짜 자유가 아니라는 결론. 동시에 **core의 5가지 핵심 자산은 보존**되어야 함:

- Proxy 변경 추적 + changeLog + dirtyFields
- structuredClone 4종 상태 스냅샷 + 롤백
- Microtask 배칭 + Shadow State
- Idempotency-Key 생명주기
- Lazy mode + LCS deep diff

이 자산들은 **L1 (변경 추적 엔진)**으로 묶이고, 자유도가 풀리는 건 **L2 (직렬화) + L3 (라우팅) + L4 (전송)**이라는 레이어 분리가 도출되었다.

이 분리가 가능하다는 것이 본 사이클의 가장 큰 발견이다 — "변경 추적은 표준 내부 포맷, 직렬화는 자유"라는 메시지가 성립.

### 6. Save Strategy 인터페이스 — Option γ 채택

자유도를 어떻게 노출할지 세 가지 옵션을 비교:

- **Option α** — 옵션 객체 트리: 학습 비용 낮으나 IDE 자동완성/타입 체킹 어려움.
- **Option β** — Strategy 클래스 인터페이스: 재사용 단위 명확하나 클래스 문법 부담.
- **Option γ** — 함수형 빌더 + 빌트인 프리셋: Option B(어댑터 함수화)와 일관, Tree-shaking 친화.

사용자가 **Option γ를 선택**했다. 결정 근거: Option B의 함수형 정신과 일관, 라이브러리 안에 두 패러다임이 섞이지 않음.

### 7. 가치 명제의 최종 진화

| 시점 | 메시지 |
| --- | --- |
| 현재 (v1.2.4) | "RFC 6902로 자동 분기되는 REST 상태 관리자" |
| Option B 후 | "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진" |
| **Save Strategy 후 (목표)** | **"변경은 자동 추적된다. 저장 방식은 당신이 정한다."** |

마지막 메시지가 가장 강력한 이유:
- "자동"과 "통제"가 한 문장에 공존
- 백엔드 종속성이 메시지에서 사라짐
- TanStack Query와 차별화 (그쪽은 mutation을 자유롭게 짜지만 변경 추적은 없음)

### 8. ADR 작성 순서 결정

도출된 6개의 결정을 ADR로 분리하기로 합의:

| ADR # | 제목 | 의존성 |
| --- | --- | --- |
| ADR-0001 | Payload Convention 시장 조사 | — (입력 데이터) |
| ADR-0002 | Save Strategy 인터페이스 시그니처 | → 0001 |
| ADR-0003 | Lazy Mode와 Strategy 호환성 | → 0001, 0002 |
| ADR-0004 | Idempotency-Key 위치 | → 0002 |
| ADR-0005 | Adapter 격리 (Option B 패키징) | 독립 |
| ADR-0006 | 라이브러리 포지셔닝 메시지 | → 0001~0005 |

작성 순서: **0001 (시장 조사) → 0002 (인터페이스) → 0003, 0004 (병렬) → 0005 → 0006**.

이유: 시장 데이터(빌트인 프리셋의 1차 셋)가 인터페이스 시그니처를 결정하고, 인터페이스가 결정되면 lazy 호환성·idempotency 위치 분석의 출력 형태가 명확해짐.

### 9. ARD/ADR 명칭 + 양식 정형화

ADR 작성에 들어가기 전, 사용자가 메타 질문을 제기했다:

> "지금까지 references에 ard라고 적어왔는데, 공식 명칭은 adr이라며..? 의사결정 기록 문서들의 양식이 문제될 부분은 없던가?"

진단 결과:
- 명칭 오용: ARD(Architectural Requirements Document)가 아니라 ADR(Architecture Decision Record)이 표준.
- **양식 문제가 더 본질적**: 기존 ard-XXXX-alignment.md는 "사이클 회고 + 다중 결정 묶음" 장르로, 단위 ADR 양식과 다른 장르.
- 두 장르 공존 필요: 사이클 회고는 보존, 단위 결정은 새 장르로 분리.

결정:
- **CDR (Cycle Discussion Record)** — 신규 사이클 논의 기록 명칭으로 채택.
- **ADR (MADR 0.5 변형)** — 단위 결정 기록 양식.
- **기존 ard-XXXX는 rename 없이 보존** — 명명 진화 자체가 저장소의 역사적 자산.
- 디렉토리 분리: `references/cycles/` + `references/decisions/`.

이 결정이 사이클의 첫 외부 산출물(`chore/docs-cycles-decisions-split` PR)로 즉시 구현되었다.

---

## Outcomes

### 라이브러리 가치 명제의 Pivot

본 사이클의 가장 큰 결정. 라이브러리의 정체성이 변경된다.

| 시점 | 메시지 |
| --- | --- |
| v1.2.4 (사이클 진입 시) | "RFC 6902로 자동 분기되는 REST 상태 관리자" |
| Option B 채택 후 | "REST 리소스를 동기화 단위로 다루는 framework-agnostic 엔진" |
| **Save Strategy 도입 후 (목표 메시지)** | **"변경은 자동 추적된다. 저장 방식은 당신이 정한다."** |

이 pivot이 모든 후속 ADR(0001~0006)의 방향성을 결정한다. 본 CDR이 Settled되는 시점은 이 새 메시지가 README, PORTFOLIO, NPM description에 일관되게 반영된 후이다.

### 도출 예정 단위 결정 (ADR)

각 ADR은 본 CDR의 어느 sub-topic(§N)에서 발화했는지 추적 가능하다.

| ADR # | 제목 | Trigger Sub-topic(s) | Status |
| :---: | --- | --- | --- |
| ADR-0001 | Payload Convention 시장 조사 | §5 | Pending |
| ADR-0002 | Save Strategy 인터페이스 시그니처 | §5, §6 | Pending |
| ADR-0003 | Lazy Mode와 Strategy 호환성 | §6 (open question) | Pending |
| ADR-0004 | Idempotency-Key 위치 분석 | §6 (open question) | Pending |
| ADR-0005 | Adapter 격리 (Option B 패키징) | §2, §3 | Pending |
| ADR-0006 | 라이브러리 포지셔닝 메시지 | §3, §4, §7 | Pending |

§1, §8, §9는 ADR을 직접 도출하지 않는다 — 각각 ROADMAP 작성(외부 산출물), ADR 작성 순서에 대한 메타 결정, 본 사이클의 첫 PR(`chore/docs-cycles-decisions-split`)로 즉시 구현된 양식 결정이다.

각 ADR이 Accepted로 전환될 때 본 CDR의 Outcomes 표 Status를 갱신하고, ADR 본문의 `Related` 필드에 `CDR-0001`을 명시한다.

### 변경된 외부 산출물

본 사이클이 코드/문서에 반영된 흔적:

- **`references/cycles/`, `references/decisions/` 디렉토리 신설** — `chore/docs-cycles-decisions-split` PR로 머지 예정.
- **`EVALUATION.md`** — 평가 보고서, 저장소 루트, 본 사이클의 트리거 문서. 별도 PR 예정.
- **`ROADMAP.md`** — 한국어판 개선 로드맵, 저장소 루트, 본 사이클의 산출물. 별도 PR 예정. ADR-0001~0006이 머지된 후 Phase 4 섹션 갱신 예정.
- **CLAUDE.md** — 저장소 가이드, 별도 PR 예정. 본 사이클과 직접 관련 없으나 같은 시기 작성됨.

### 결정되지 않은 미해결 질문

본 사이클이 끝나기 전에 확정되어야 할 것:
- 빌트인 프리셋 1차 셋의 정확한 범위 (ADR-0001에서 결정).
- Strategy의 `parseResponse` optional 여부 (ADR-0002에서 결정).
- `Idempotency-Key` 위치 — 현재 ApiHandler 옵션이지만 strategy 내부로 이동할지 (ADR-0004에서 결정).
- Phase 5 (`DomainState.js` 분리)와 Save Strategy 도입 작업의 통합/분리 여부 (ADR-0006 또는 후속 CDR에서 결정).

---

## Reflections

_본 사이클이 In-Progress 상태이므로 회고는 Settled 시점에 작성한다._

사이클 종료 조건: ADR-0001~0006 모두 Accepted 상태 + Save Strategy 구현 완료 + ROADMAP Phase 4c 종료.

---

## Links

### 직전 사이클
- [ard-0003-alignment.md](./ard-0003-alignment.md) — v1.x 마지막 사이클, "기능 확장 + 전략 전환"

### 본 사이클의 트리거 / 산출물 (저장소 루트)
- `EVALUATION.md` — 외부 평가 보고서 (사이클 트리거)
- `ROADMAP.md` — 한국어판 개선 로드맵 (사이클 산출물)
- `CLAUDE.md` — Claude Code 운영 가이드

### 외부 참조 (논의 중 인용된 자료)
- [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
- [RFC 7396 — JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396)
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)
- [IETF — Idempotency-Key HTTP Header Field (draft)](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) (경쟁 분석 대상)
- [Valtio](https://github.com/pmndrs/valtio) (Proxy 기반 상태 관리 비교 대상)

### 관련 PR
- `chore/docs-cycles-decisions-split` — 디렉토리 마이그레이션 + ADR/CDR 양식 정형화
