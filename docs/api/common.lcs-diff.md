# common/lcs-diff

LCS(Longest Common Subsequence) 기반 깊은 비교 유틸리티

`DomainState`의 `lazy` tracking mode에서 `save()` 호출 시,
인스턴스 생성 시점에 저장된 `_initialSnapshot`과 현재 도메인 객체를 비교하여
RFC 6902 형식의 `changeLog` 배열을 생성한다.

## `realtime` 모드와의 차이
`realtime` 모드에서는 Proxy `set` 트랩이 발화될 때마다 changeLog에 즉시 기록한다.
`lazy` 모드에서는 set 트랩 기록을 건너뛰고, `save()` 시점에 이 유틸로 한 번에 계산한다.
동일한 필드를 10번 바꿔도 최종 변경 결과만 1개 항목으로 기록되어
네트워크 페이로드가 최소화된다.

## 배열 비교 전략
- `itemKey` 지정 시: LCS 알고리즘으로 항목 동일성(itemKey 필드값 기준)을 판단한다.
  위치가 달라도 같은 항목으로 인식하며, 삭제/추가가 정확히 구분된다.
- `itemKey` 미지정 시: 위치(positional) 기준 비교를 수행한다.
  같은 위치의 값이 달라지면 'replace'로 기록한다.

## `itemKey` 필요성 예시
```
초기: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
현재: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }]

positional(오류):
  index 0: id:1 → id:2 → 'replace'
  index 1: id:2 → id:3 → 'replace'

LCS(itemKey='id', 정확):
  id:1 → 초기에만 있음 → 'remove'
  id:2 → 양쪽에 있음  → no-op
  id:3 → 현재에만 있음 → 'add'
```

## See

 - [LCS 알고리즘 참조](https://www.cs.columbia.edu/~allen/S14/NOTES/lcs.pdf)
 - [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)

## Interfaces

- [ChangeLogEntry](common.lcs-diff.Interface.ChangeLogEntry.md)

## Functions

- [deepDiff](common.lcs-diff.Function.deepDiff.md)
