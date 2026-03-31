# common/logger

라이브러리 전역 로그 제어 모듈

`DomainState.configure({ silent: true })`를 통해 모든 내부 로그를 억제할 수 있다.
모듈 레벨 클로저 변수로 상태를 관리하여 외부에서 직접 접근을 차단한다.

## 로그 레벨 분류 체계

| 함수         | 발화 조건                              | 용도                         |
|--------------|----------------------------------------|------------------------------|
| `devWarn`    | 개발 환경 + silent 아님                | Extra Keys 등 정보성 경고    |
| `logError`   | silent 아님 (환경 무관)                | Missing Keys 등 기능 이상    |

`silent: true` 설정 시 두 함수 모두 억제된다.

## Functions

- [devWarn](common.logger.Function.devWarn.md)
- [isSilent](common.logger.Function.isSilent.md)
- [logError](common.logger.Function.logError.md)
- [setSilent](common.logger.Function.setSilent.md)
