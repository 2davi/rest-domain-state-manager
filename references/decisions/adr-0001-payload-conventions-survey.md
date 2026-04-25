# ADR-0001: Payload Convention 시장 조사 및 1차 빌트인 프리셋 선별

- **Status:** Proposed
- **Date:** 2026-04-25
- **Decider:** 2davi
- **Tags:** payload, strategy, market-survey, presets
- **Related:** CDR-0001

---

## Context and Problem Statement

본 라이브러리는 v1.2.4까지 RFC 6902 JSON Patch를 사용한 PATCH 페이로드를 강제했다. 이 결정은 SOM(Serviceable Obtainable Market)을 "JSON Patch를 받는 백엔드를 가진 팀"으로 좁혔으며, 시장 침투의 결정적 장벽이었다.

CDR-0001 §5에서 도출된 결정에 따라 PATCH 페이로드 포맷, 메서드 분기 로직, 페이로드 직렬화 방식 등 6개 차원의 자유도를 풀어주는 Save Strategy 패턴이 도입된다 (인터페이스 시그니처는 ADR-0002에서 결정).

본 ADR은 Save Strategy의 빌트인 프리셋(built-in presets) 1차 셋을 결정하기 위한 시장 조사를 기록한다. 빌트인 프리셋은 사용자가 한 줄로 자신의 백엔드 컨벤션과 매칭할 수 있도록 라이브러리가 제공하는 기성 strategy 객체이다.

본 ADR이 답해야 할 질문:

1. 어떤 페이로드 컨벤션이 시장에 존재하는가?
2. 그 중 본 라이브러리의 빌트인 프리셋으로 포함할 1차 셋은 무엇인가?
3. 포함하지 않은 컨벤션은 어떻게 처리할 것인가? (사용자 정의 strategy 가이드)

## Decision Drivers

빌트인 프리셋 선별 기준:

1. **시장 점유율** — 추정 채택률이 5% 이상인 컨벤션 우선.
2. **차별화** — 다른 프리셋과 페이로드 구조가 명확히 다를 것. 변형이라면 base 프리셋 + 옵션으로 흡수.
3. **본 라이브러리의 페르소나 적합성** — 한국 SI, 엔터프라이즈, RESTful 모던 백엔드 모두 커버.
4. **구현 명확성** — 1~2일 구현 가능한 단순함. 도메인 전용(헬스케어 FHIR 등)은 사용자 정의로.
5. **번들 크기** — Tree-shaking 친화. 6~7개 이상이면 코어 번들 크기 영향 검토.
6. **현재 사용자 0명 전제** — Breaking change 비용 없음. 현재 default(RFC 6902)를 유지할 의무는 없으나, 하위 호환을 위해 default로 권장 가능.

## Considered Options

페이로드 컨벤션 12종 후보. 각 컨벤션의 정의, 페이로드 예시, 점유율 추정, 채택 평가를 정리한다.

채택 평가 등급은 다음 5단계 영단어로 표기한다:

- **STRONG_FIT** — 본 라이브러리의 핵심 페르소나와 직접 일치. 1차 빌트인 필수.
- **GOOD_FIT** — 페르소나 일부와 일치. 1차 빌트인 추천.
- **MODERATE_FIT** — 일부 사용자 직접 커버. 빌트인 가치 있음.
- **WEAK_FIT** — 다른 프리셋으로 커버 가능 또는 차별화 약함. 빌트인 권장 안 함.
- **POOR_FIT** — 도메인 전용 또는 본 라이브러리 영역 밖. 빌트인 거부.

### Option 1 — RFC 6902 JSON Patch

> HTTP PATCH 표준 페이로드. operation 배열로 변경 이력을 직렬화.

```http
PATCH /api/users/1
Content-Type: application/json-patch+json

[
  { "op": "replace", "path": "/name",  "value": "Davi" },
  { "op": "remove",  "path": "/email" },
  { "op": "add",     "path": "/age",   "value": 30 }
]
```

- **점유율 추정:** 약 10~15%. 표준은 명확하지만 백엔드 채택은 의외로 낮음. 프레임워크 라이브러리 미흡.
- **대표 사용처:** Microsoft API, 일부 엔터프라이즈 자바, Kubernetes API.
- **본 라이브러리 fit:** STRONG_FIT — 현재 default. changeLog가 직접적으로 매핑됨.

### Option 2 — RFC 7396 JSON Merge Patch

> HTTP PATCH 다른 표준. 변경된 부분만 객체로 보내고, null은 삭제 시그널.

```http
PATCH /api/users/1
Content-Type: application/merge-patch+json

{
  "name": "Davi",
  "email": null,
  "age": 30
}
```

- **점유율 추정:** 약 30~40%. 6902보다 직관적이라 더 보편적.
- **대표 사용처:** GitHub API, OpenAPI 권장, Django REST Framework 기본 PATCH 동작.
- **본 라이브러리 fit:** STRONG_FIT — 6902가 너무 verbose하다고 느끼는 백엔드의 첫 선택지.

### Option 3 — JSON:API spec

> REST API 명세. envelope 구조로 data, included, relationships, meta, errors 분리.

```http
PATCH /api/users/1
Content-Type: application/vnd.api+json

{
  "data": {
    "type": "users",
    "id": "1",
    "attributes": {
      "name": "Davi",
      "age": 30
    }
  }
}
```

- **점유율 추정:** 약 5~10%. Ember.js 생태계, 일부 Rails 프로젝트.
- **대표 사용처:** Ember Data, jsonapi-rb, Drupal JSON:API module.
- **본 라이브러리 fit:** MODERATE_FIT — envelope 패턴의 대표. 명세가 엄격해서 빌트인 가치 있음.

### Option 4 — HAL / Hypermedia

> 하이퍼미디어 링크 중심 응답 포맷. 요청 페이로드는 일반 JSON과 유사하나 응답에 _links, _embedded 포함.

```http
PATCH /api/users/1
Content-Type: application/hal+json

{
  "name": "Davi",
  "_links": { "self": { "href": "/api/users/1" } }
}
```

- **점유율 추정:** 약 5~10%. Spring HATEOAS 채택 영역.
- **대표 사용처:** Spring HATEOAS, Apache Camel, RESTful API 학술 영역.
- **본 라이브러리 fit:** WEAK_FIT — 응답 파싱은 의미 있으나 요청 페이로드는 일반 JSON. 차별화 약함.

### Option 5 — Spring Data REST 컨벤션

> Spring Boot 기본. PUT 전체 교체, PATCH는 JSON Patch 또는 Merge Patch 자동 선택. 표준 JSON 페이로드.

```http
PUT /api/users/1
Content-Type: application/json

{
  "id": 1,
  "name": "Davi",
  "email": "davi@example.com",
  "age": 30
}
```

- **점유율 추정:** 한국 엔터프라이즈 약 50%, 글로벌 자바 약 30%.
- **대표 사용처:** Spring Data REST를 채택한 모든 자바 백엔드.
- **본 라이브러리 fit:** GOOD_FIT — "PATCH 안 쓰고 PUT 전체 교체" 패턴의 대표. fullPut 프리셋의 모태.

### Option 6 — Django REST Framework

> Python Django 기본. PATCH는 Merge Patch 변형, PUT은 전체 교체. 표준 JSON 페이로드.

```http
PATCH /api/users/1/
Content-Type: application/json

{
  "name": "Davi",
  "age": 30
}
```

- **점유율 추정:** Python 백엔드 약 40%.
- **대표 사용처:** Django REST Framework 채택한 모든 Python 백엔드.
- **본 라이브러리 fit:** WEAK_FIT — 사실상 RFC 7396 Merge Patch와 동일. 별도 프리셋 불필요.

### Option 7 — Rails ActiveResource

> Ruby on Rails 컨벤션. envelope으로 리소스 명을 키로 사용 ({"user": {...}}).

```http
PATCH /api/users/1
Content-Type: application/json

{
  "user": {
    "name": "Davi",
    "age": 30
  }
}
```

- **점유율 추정:** Rails 백엔드 약 15%.
- **대표 사용처:** Rails ActiveRecord serializer, ActiveModel.
- **본 라이브러리 fit:** MODERATE_FIT — envelope 변형. 일반화된 envelope strategy로 커버 가능.

### Option 8 — 한국 SI POST-only 패턴

> 모든 mutation을 POST로 처리. URL 또는 body에 action 필드 명시. 비-RESTful이지만 한국 SI에서 압도적.

```http
POST /api/user/update
Content-Type: application/json

{
  "action": "update",
  "userId": 1,
  "data": {
    "name": "Davi",
    "age": 30
  }
}
```

- **점유율 추정:** 한국 SI 사업장 약 70~80%.
- **대표 사용처:** 대다수 한국 SI 프로젝트, JSP+Spring 환경.
- **본 라이브러리 fit:** STRONG_FIT — 본 라이브러리의 핵심 페르소나(SI 트랙). 빌트인 필수.

### Option 9 — OData (Microsoft)

> Microsoft REST 표준. metadata 포함 페이로드, $filter, $expand 등 query 문법.

```http
PATCH /odata/Users(1)
Content-Type: application/json
OData-Version: 4.0

{
  "@odata.context": "$metadata#Users/$entity",
  "Name": "Davi",
  "Age": 30
}
```

- **점유율 추정:** 약 5%. Microsoft .NET 생태계.
- **대표 사용처:** Microsoft Graph, Dynamics 365, SAP.
- **본 라이브러리 fit:** WEAK_FIT — 매우 전용적. metadata 처리·query 문법 등 페이로드 직렬화 외 책임 다수.

### Option 10 — FHIR (헬스케어)

> HL7 의료 정보 표준. 도메인 전용의 매우 복잡한 envelope.

```http
PATCH /fhir/Patient/1
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "id": "1",
  "name": [{ "given": ["Davi"], "family": "Kim" }]
}
```

- **점유율 추정:** 약 5%. 의료 시스템 한정.
- **대표 사용처:** Epic, Cerner, AWS HealthLake, 의료기관 FHIR 서버.
- **본 라이브러리 fit:** POOR_FIT — 도메인 전용. 일반 라이브러리에 빌트인할 가치 없음.

### Option 11 — gRPC-Web

> gRPC를 HTTP/JSON으로 노출. Protobuf 또는 JSON 직렬화.

```http
POST /grpc/users.UserService/UpdateUser
Content-Type: application/grpc-web+proto
```

- **점유율 추정:** 약 3%. Google 영향권 일부.
- **대표 사용처:** Envoy proxy, Google Cloud, 일부 마이크로서비스.
- **본 라이브러리 fit:** POOR_FIT — REST가 아닌 RPC. 본 라이브러리의 영역 밖.

### Option 12 — GraphQL-over-REST 하이브리드

> REST 엔드포인트에 GraphQL-like 쿼리(?fields=...) 또는 mutation-style body.

```http
POST /api/users/1/mutate
Content-Type: application/json

{
  "query": "mutation { updateUser(id: 1, name: \"Davi\") { id name } }",
  "variables": { "id": 1, "name": "Davi" }
}
```

- **점유율 추정:** 약 5%. niche 패턴.
- **대표 사용처:** GraphQL을 부분 도입한 RESTful API.
- **본 라이브러리 fit:** POOR_FIT — 전용성 높음. GraphQL 라이브러리(Apollo)의 영역.

---

## Decision Outcome

**채택:** 1차 빌트인 프리셋 6종.

| # | 프리셋 명 | 모태 컨벤션 | fit 등급 | 채택 근거 |
| :---: | --- | --- | --- | --- |
| 1 | `rfc6902()` | Option 1 | STRONG_FIT | 표준 PATCH 페이로드. changeLog가 직접 매핑됨. 본 라이브러리의 기술적 정체성. |
| 2 | `mergePatch()` | Option 2 | STRONG_FIT | 가장 보편적인 PATCH 컨벤션. Django/GitHub 등 광범위 커버. |
| 3 | `fullPut()` | Option 5 | GOOD_FIT | 한국 엔터프라이즈/글로벌 자바의 표준. PATCH 안 쓰는 백엔드 커버. |
| 4 | `postOnly()` | Option 8 | STRONG_FIT | 한국 SI의 핵심 페르소나. 라이브러리 SOM의 결정적 확장 요소. |
| 5 | `jsonApi()` | Option 3 | MODERATE_FIT | envelope 패턴의 spec 기반 대표. Ember/Drupal/Rails 일부. |
| 6 | `envelope({ wrap, unwrap })` | Option 7 일반화 | MODERATE_FIT | Rails ActiveResource + 사용자 정의 envelope 모두 커버하는 일반화 프리셋. |

**default 프리셋:** `rfc6902()` 유지. 현재 사용자 0명이지만 PORTFOLIO/ARCHITECTURE에서 RFC 6902가 본 라이브러리의 기술적 자산으로 강조되어 있어 default 메시지의 일관성을 위해 유지.

**기각:** 6종.

| Option | fit 등급 | 기각 사유 |
| :---: | --- | --- |
| Option 4 (HAL) | WEAK_FIT | 응답 파싱 위주, 요청 페이로드는 일반 JSON. 차별화 약함. 사용자 정의 strategy로 충분. |
| Option 6 (Django REST) | WEAK_FIT | 사실상 Option 2(Merge Patch)와 동일. mergePatch 프리셋으로 커버. |
| Option 9 (OData) | WEAK_FIT | 도메인 전용성 높음. metadata/query 처리는 strategy 외 책임. 사용자 정의 strategy 가이드로 안내. |
| Option 10 (FHIR) | POOR_FIT | 헬스케어 도메인 전용. 일반 라이브러리에 빌트인할 가치 없음. |
| Option 11 (gRPC-Web) | POOR_FIT | RPC 패턴, 본 라이브러리의 REST 영역 밖. |
| Option 12 (GraphQL-over-REST) | POOR_FIT | niche 패턴. GraphQL 라이브러리의 영역. |

기각된 6종은 README의 "사용자 정의 strategy 작성 가이드" 섹션에서 예시로 다룬다 (ADR-0006 또는 별도 가이드 문서).

## Pros and Cons of the Options

### Option set A — 6종 채택안 (위 결정)

- PRO: 시장 점유율 합산 80% 이상 커버 (RFC 6902 + Merge Patch + Spring + 한국 SI + JSON:API + envelope).
- PRO: 한국 시장(SI POST-only)과 글로벌 시장(RESTful 표준) 양쪽 커버.
- PRO: 6종으로 번들 크기 부담 낮음. Tree-shaking 시 사용자가 import한 프리셋만 포함.
- PRO: envelope 일반화 프리셋이 Rails ActiveResource + 사용자 정의 envelope을 모두 흡수.
- CON: JSON:API와 envelope이 일부 기능적으로 겹침. 사용자가 어느 것을 선택해야 할지 혼란.
- CON: Spring HATEOAS, OData, FHIR 사용자는 자체 strategy 작성 필요 (그러나 이들은 niche).

### Option set B — 4종 최소 셋 (기각)

`rfc6902`, `mergePatch`, `fullPut`, `postOnly`만 빌트인.

- PRO: 번들 크기 최소.
- PRO: 결정 단순함.
- CON: envelope 패턴 사용자(Rails, JSON:API, 사용자 정의)는 모두 자체 strategy 작성 필요.
- CON: "강력한 default 제공"이라는 메시지가 약화됨.

### Option set C — 9종 풍부한 셋 (기각)

위 6종 + Option 4 (HAL), Option 9 (OData), Option 12 (GraphQL-REST) 추가.

- PRO: 더 많은 페르소나 직접 커버.
- CON: HAL/OData는 페이로드 직렬화 외 책임이 strategy를 넘어섬 (응답 hypermedia 처리, query 문법 등).
- CON: 빌트인 프리셋이 9개를 넘으면 사용자 선택 부담 증가, 번들 크기 영향 비선형 증가.
- CON: niche 컨벤션을 빌트인하면 메시지가 흐려짐 ("이 라이브러리는 무엇을 위한 것인가?").

## Consequences

- BENEFIT: 6종 빌트인으로 시장 점유율 80% 이상 커버. SOM이 "RFC 6902 친화 백엔드"에서 "REST API를 사용하는 대다수 백엔드"로 확장.
- BENEFIT: `postOnly` 빌트인이 한국 SI 트랙의 1급 시민화. PORTFOLIO §1의 "SI 통증" narrative와 코드가 일치.
- BENEFIT: `envelope` 일반화 프리셋이 사용자 정의 envelope 패턴을 절반 이상 흡수 — 자체 strategy 작성 부담 감소.
- BENEFIT: 본 ADR이 ADR-0002(인터페이스 시그니처)의 입력 데이터로 작용. ctx 객체 필드 셋, serialize/decide 시그니처가 6종 프리셋을 모두 표현 가능해야 함.

- CAUTION: 빌트인 6종 각각의 단위 테스트 + e2e 시나리오 작성 부담. 매트릭스 = 6 프리셋 × (POST/PATCH/PUT) = 18 핵심 케이스 + 사용자 정의 케이스.
- CAUTION: HAL, OData, FHIR, GraphQL-REST 사용자에게 "사용자 정의 strategy 작성" 안내 문서 작성 필요. README 또는 별도 가이드.
- CAUTION: 점유율 추정치가 데이터 기반이 아닌 경험적 추정. 1년 이내 NPM 다운로드 데이터와 GitHub 이슈를 통해 검증 필요. 추정이 크게 틀린 경우 빌트인 셋 재조정.

- NEXT: ADR-0002 (Strategy 인터페이스 시그니처) — 본 ADR의 6종 프리셋을 모두 표현 가능한 ctx 객체 필드 셋, serialize/decide 함수 시그니처 결정.
- NEXT: ADR-0003 (Lazy Mode 호환성) — 6종 프리셋이 lazy mode의 deepDiff 결과를 입력으로 받을 때 호환성 분석.
- NEXT: ADR-0004 (Idempotency-Key 위치) — 6종 중 `postOnly`는 PUT 멱등성 가정이 깨짐. Idempotency-Key 강제 권장 여부 결정.

## Links

### 표준 명세
- [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
- [RFC 7396 — JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396)
- [JSON:API spec](https://jsonapi.org/)
- [HAL spec](https://stateless.group/hal_specification.html)
- [OData v4](https://www.odata.org/documentation/)
- [FHIR (HL7)](https://www.hl7.org/fhir/)

### 프레임워크 문서
- [Spring Data REST](https://docs.spring.io/spring-data/rest/docs/current/reference/html/)
- [Django REST Framework — PATCH](https://www.django-rest-framework.org/api-guide/generic-views/#updateapiview)
- [Rails ActiveResource](https://github.com/rails/activeresource)
- [GitHub API — Merge Patch](https://docs.github.com/en/rest/overview/api-versions)

### 본 사이클
- CDR-0001 §5 (PATCH 강제로 인한 백엔드 종속성 인식) — 본 ADR의 trigger
- ADR-0002 (예정) — 본 ADR을 입력으로 인터페이스 결정
