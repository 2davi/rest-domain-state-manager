# common/freeze

불변성 강제 유틸리티

Shadow State의 스냅샷 객체를 개발 환경에서 동결(freeze)하여
소비자가 스냅샷을 직접 변이시키려 할 때 즉시 에러를 발생시킨다.

## 프로덕션 전략
`process.env.NODE_ENV !== 'production'` 조건 분기로 개발 환경에서만
재귀 순회를 수행한다. 프로덕션에서는 no-op이며, 소비자 번들러의
Tree-shaking으로 해당 코드 블록이 번들에서 완전히 제거된다.

## Functions

- [deepFreeze](common.freeze.Function.deepFreeze.md)
- [maybeDeepFreeze](common.freeze.Function.maybeDeepFreeze.md)
