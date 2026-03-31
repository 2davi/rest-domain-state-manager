# adapters/react

DomainState — React 어댑터

`useSyncExternalStore`를 통해 `DomainState`의 Shadow State를
React 렌더링 사이클에 연결하는 커스텀 훅을 제공한다.

## 사용 조건
React 18 이상이 설치되어 있어야 한다.
이 파일은 코어 번들에 포함되지 않는다.
`@2davi/rest-domain-state-manager/adapters/react` 서브패스로 별도 import한다.

## Framework-Agnostic 철학 준수
`subscribe()` / `getSnapshot()`은 코어 `DomainState`의 공개 메서드다.
React 없이 Vanilla JS / Vue에서도 직접 사용 가능하다.
이 파일은 `useSyncExternalStore` 래핑의 편의를 제공할 뿐이다.

## See

[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)

## Functions

- [useDomainState](adapters.react.Function.useDomainState.md)
