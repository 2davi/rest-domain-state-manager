# constants/dirty.const

Dirty Checking 기반 HTTP 메서드 자동 분기 상수

`DomainState.save()` 내부에서 PATCH / PUT을 결정할 때
변경된 최상위 필드의 비율(dirtyFields.size / totalFields)을
이 임계값과 비교한다.

## 임계값 결정 근거
- PATCH : 변경된 필드만 JSON Patch 배열로 전송 → 페이로드가 작을수록 유리
- PUT   : 전체 객체를 직렬화하여 전송 → 변경 필드 수가 일정 수준을 넘으면
          PATCH 배열 생성 비용보다 단순 전체 직렬화가 더 효율적

0.7 (70%)은 실무 RESTful API 설계 가이드라인에서 통용되는 경험적 기준값이다.
라이브러리 소비자가 별도로 재정의하는 공개 옵션은 제공하지 않는다.
(복잡도 증가 대비 실익이 없음)

## See

[RFC 7396 — JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396)

## Variables

- [DIRTY\_THRESHOLD](constants.dirty.const.Variable.DIRTY_THRESHOLD.md)
