# Decisions — 단위 결정 기록 (ADR)

이 디렉토리는 **Architecture Decision Record**(ADR)을 모아둔다. 사이클 단위 논의 기록은 `references/cycles/`(CDR/ARD)에 별도로 보관한다.

## ADR이란

Michael Nygard 2011 article 기원의 업계 표준 양식. 단위 결정 1건당 문서 1개.

| 축 | 특성 |
| --- | --- |
| 단위 | 결정 1건 |
| 분량 | 1~3 페이지 (짧다) |
| 추적성 | `grep adr-NNNN`으로 즉시 |
| Status 관리 | Proposed / Accepted / Deprecated / Superseded |

본 저장소는 **MADR 0.5** 변형 양식을 사용한다 — Decision Drivers와 Considered Options를 명시적으로 분리하여 결정의 평가 기준과 검토한 대안을 추적 가능하게 한다.

## 인덱스

| # | 제목 | Status | Date | Tags |
| :---: | --- | --- | --- | --- |
| 0001 | [Payload Convention 시장 조사 및 1차 빌트인 프리셋 선별](./adr-0001-payload-conventions-survey.md) | Proposed | 2026-04-25 | payload, strategy, market-survey, presets |

## ADR 양식

신규 ADR은 [ADR_TEMPLATE.md](./ADR_TEMPLATE.md)를 복사하여 시작한다.

## ADR 작성 규칙

1. **짧게 유지.** 본문이 길어지면 토론 내용을 트리거 CDR로 옮기고, ADR에는 결과만 남긴다.
2. **Decision Drivers를 먼저.** 평가 기준이 옵션보다 먼저 정해져야 결정의 객관성이 확보된다.
3. **Considered Options를 빠뜨리지 않는다.** 채택하지 않은 옵션도 기록 — "왜 이걸 선택하지 않았는가"가 시그널의 절반이다.
4. **Consequences는 정직하게.** 긍정·부정·중립을 모두 적는다. 비용을 숨기지 않는다.
5. **Status는 거짓말하지 않는다.** 결정이 번복되면 새 ADR을 작성하고 원본을 "Superseded by ADR-XXXX"로 변경. 원본을 지우지 않는다.
6. **Related 필드 활용.** 트리거 CDR, 선행 ADR, 후속 ADR을 모두 명시.

## 명명 규칙

- 파일명: `adr-NNNN-<짧은-명사구-kebab-case>.md`
  - 예: `adr-0001-payload-conventions-survey.md`
  - 예: `adr-0002-strategy-interface.md`
- NNNN: 4자리 zero-padded. 0001부터 시작. 결번 허용 (Superseded 시 새 번호 부여).
- 제목(`# ADR-NNNN: ...`): 파일명과 일치하되 한국어 또는 영어 자연어 가능.

## 양식 가이드

- ADR 양식 본체: [ADR_TEMPLATE.md](./ADR_TEMPLATE.md)
- 두 장르의 관계: [../cycles/README.md](../cycles/README.md)
