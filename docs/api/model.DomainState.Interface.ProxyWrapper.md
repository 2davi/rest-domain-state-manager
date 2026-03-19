# Interface: ProxyWrapper

## Properties

### clearChangeLog

> **clearChangeLog**: () => `void`

동기화 성공 후 변경 이력 전체를 초기화한다.

#### Returns

`void`

***

### getChangeLog

> **getChangeLog**: () => `ChangeLogEntry`[]

현재 변경 이력의 얕은 복사본을 반환한다. 외부 변조 방지.

#### Returns

`ChangeLogEntry`[]

***

### getTarget

> **getTarget**: () => `object`

변경이 누적된 원본 객체를 반환한다.

#### Returns

`object`

***

### proxy

> **proxy**: `object`

변경 추적이 활성화된 Proxy 객체. 유일한 외부 진입점.
