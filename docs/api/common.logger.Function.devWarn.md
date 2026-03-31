# Function: devWarn()

> **devWarn**(`message`): `void`

개발 환경에서만 `console.warn`을 발화한다. `silent: true`이면 억제된다.

Extra Keys 감지처럼 기능에 영향이 없는 정보성 경고에 사용한다.

## 프로덕션 Tree-shaking 전략
`process.env.NODE_ENV`를 소비자 번들러(Rollup/Vite/Webpack)가
`'production'`으로 치환하면 이 함수 내부의 `if` 블록이 `if (false)` 형태가 되어
Dead Code Elimination으로 번들에서 완전히 제거된다.

`typeof process !== 'undefined'` 가드는 브라우저 순수 ESM 환경에서
번들러 define이 적용되기 전 `process` 미존재로 인한 ReferenceError를 방어한다.

## Parameters

### message

`string`

출력할 경고 메시지

## Returns

`void`
