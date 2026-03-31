# common/clone

깊은 복사(Deep Clone) 유틸리티

`structuredClone()`을 1순위로 사용하고, 미지원 환경에서는
커스텀 재귀 함수(`_cloneDeep`)로 폴백하는 Progressive Enhancement 패턴을 따른다.

## 사용 범위
`DomainVO.toSkeleton()`의 `static fields` 기본값 deep copy에 사용된다.
기존 `JSON.parse(JSON.stringify())` 방식의 타입 파괴 문제를 해결한다.

## `_cloneDeep` 폴백 지원 타입
VO 레이어의 실제 사용 범위에 맞게 구현하였다.
`Map`·`Set`은 현 코드베이스의 VO 기본값에서 사용되지 않으므로 폴백에서 제외한다.
(폴백 미지원 시 `{}` 또는 `[]`로 대체됨)
`structuredClone` 경로는 `Map`·`Set`을 완벽히 처리한다.

## Functions

- [safeClone](common.clone.Function.safeClone.md)
