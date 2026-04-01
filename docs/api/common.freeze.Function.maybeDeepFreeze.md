# Function: maybeDeepFreeze()

```ts
function maybeDeepFreeze<T>(obj): T;
```

개발 환경에서만 `deepFreeze`를 적용한다. 프로덕션에서는 no-op.

Shadow State 스냅샷 생성 시 사용한다.
`process.env.NODE_ENV` 치환은 소비자 번들러가 담당한다.
프로덕션 빌드 시 `if (false) { ... }` 분기가 Tree-shaking으로 제거된다.

## 환경 탐지 가드
`typeof process !== 'undefined'` 검사로 `process`가 없는 브라우저
순수 ESM 환경(번들러 define 미적용)에서의 ReferenceError를 방어한다.

## Type Parameters

### T

`T`

## Parameters

### obj

`T`

조건부 동결할 값

## Returns

`T`

개발 환경이면 동결된 값, 프로덕션이면 원본 그대로
