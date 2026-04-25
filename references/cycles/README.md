# Cycles — 사이클별 논의 기록

이 디렉토리는 **사이클 단위 논의 기록**을 모아둔다. 단위 결정 기록은 `references/decisions/`(ADR)에 별도로 보관한다.

## 두 장르의 구분

| 장르 | 위치 | 단위 | 분량 | 용도 |
| --- | --- | --- | --- | --- |
| **ARD** (Architectural Requirements Document, 명칭 보존) | `cycles/ard-XXXX-alignment.md` | 사이클 1개 = 문서 1개 | 길음 (회고 + 다중 결정) | v1.x 이전의 역사적 자산 |
| **CDR** (Cycle Discussion Record) | `cycles/cdr-XXXX-*.md` | 사이클 1개 = 문서 1개 | 길음 (논의·학습·정렬) | v1.2.4 이후 신규 사이클 |
| **ADR** (Architecture Decision Record) | `decisions/adr-XXXX-*.md` | 결정 1건 = 문서 1개 | 짧음 (1~3 페이지) | 단위 결정 추적 |

## ARD vs CDR — 명칭 변경 배경

v1.x 이전 사이클(ard-0000 ~ ard-0003)은 "ARD"라는 명칭으로 작성되었다.
표준 약어는 ADR(Architecture Decision Record)이며, ARD는 통상 "Architectural Requirements Document"를 의미하므로 본 저장소에서 의도한 "사이클 정렬·학습·결정 모음"과 어휘적으로 일치하지 않았다.

v1.2.4 이후 신규 사이클은 다음과 같이 분리된다:
- **단위 결정 → ADR** (`decisions/adr-XXXX-*.md`, MADR 양식)
- **사이클 논의 → CDR** (`cycles/cdr-XXXX-*.md`, 본 디렉토리의 `CDR_TEMPLATE.md` 양식)

기존 ard-XXXX-alignment.md는 **rename하지 않고 보존**한다. 명명 진화 자체가 저장소의 역사적 자산이다.

## 인덱스

### ARD (역사적 자산, v1.x 이전)

| # | 파일 | 사이클 | 기간 |
| :---: | --- | --- | --- |
| 0000 | [ard-0000-alignment.md](./ard-0000-alignment.md) | 초기 진단 | 2026-03-18 |
| 0001 | [ard-0001-alignment.md](./ard-0001-alignment.md) | 코어 리팩토링 | 2026-03-18 ~ 03-23 |
| 0002 | [ard-0002-alignment.md](./ard-0002-alignment.md) | 아키텍처 고도화 | 2026-03-24 ~ 03-31 |
| 0003 | [ard-0003-alignment.md](./ard-0003-alignment.md) | 기능 확장 + 전략 전환 | 2026-03-31 ~ 04-02 |

### CDR (신규 사이클, v1.2.4 이후)

| # | 파일 | 사이클 | 기간 |
| :---: | --- | --- | --- |
| 0001 | [cdr-0001-save-strategy-pivot.md](./cdr-0001-save-strategy-pivot.md) | Save Strategy Pivot & Library Repositioning | 2026-04-25 ~ ongoing |

## CDR 양식

신규 CDR은 [CDR_TEMPLATE.md](./CDR_TEMPLATE.md)를 복사하여 시작한다.

## 양식 규칙

1. **ADR은 짧다.** 1~3 페이지. 본문이 길어지면 토론 내용을 CDR로 옮기고, ADR에는 결과만.
2. **CDR은 길다.** 학습·논의 과정을 포함하므로 분량 제한 없음.
3. **결정은 ADR에만.** CDR에서 "결정했다"고 적지 말고 "ADR-NNNN으로 결정"이라고 링크.
4. **상호 참조 의무.** ADR은 자신을 트리거한 CDR을 `Related`에 명시. CDR은 자신이 도출한 ADR을 `Outcomes`에 명시.
5. **Status는 거짓말하지 않는다.** Draft 상태로 머무는 건 정직. Settled로 옮길 때 회고를 함께.
6. **Superseded는 흔적을 남긴다.** ADR을 갈아엎을 때 원본을 지우지 않고 Status를 "Superseded by ADR-XXXX"로 변경.
