# constants/protocol.const

URL 프로토콜 및 실행 환경 상수

URL 조합 시 프로토콜 결정 우선순위:
  1. 명시적 protocol 인자
  2. env 플래그 → DEFAULT_PROTOCOL[env]
  3. env 없음 + debug: true  → HTTP  (개발 환경으로 판단)
  4. env 없음 + debug: false → HTTPS (프로덕션으로 판단)

## Enumerations

- [ENV](constants.protocol.const.Enumeration.ENV.md)
- [PROTOCOL](constants.protocol.const.Enumeration.PROTOCOL.md)

## Variables

- [DEFAULT\_PROTOCOL](constants.protocol.const.Variable.DEFAULT_PROTOCOL.md)
- [VALID\_PROTOCOL\_KEYS](constants.protocol.const.Variable.VALID_PROTOCOL_KEYS.md)
