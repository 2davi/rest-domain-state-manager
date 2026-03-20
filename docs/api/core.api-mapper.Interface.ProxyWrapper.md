# Interface: ProxyWrapper

## Properties

### clearChangeLog

> **clearChangeLog**: () => `void`

동기화 성공 후 변경 이력 전체를 초기화한다.

#### Returns

`void`

***

### clearDirtyFields

> **clearDirtyFields**: () => `void`

변경된 최상위 키 집합을 초기화한다.

#### Returns

`void`

***

### getChangeLog

> **getChangeLog**: () => [`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

현재 변경 이력의 얕은 복사본을 반환한다. 외부 변조 방지.

#### Returns

[`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

***

### getDirtyFields

> **getDirtyFields**: () => `Set`\<`string`\>

변경된 최상위 키 집합의 복사본을 반환한다.

#### Returns

`Set`\<`string`\>

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

***

### restoreChangeLog

> **restoreChangeLog**: (`entries`) => `void`

changeLog를 스냅샷 항목으로 교체한다.

#### Parameters

##### entries

[`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

#### Returns

`void`

***

### restoreDirtyFields

> **restoreDirtyFields**: (`fields`) => `void`

dirtyFields를 스냅샷 키 집합으로 교체한다.

#### Parameters

##### fields

`Set`\<`string`\>

#### Returns

`void`

***

### restoreTarget

> **restoreTarget**: (`data`) => `void`

domainObject를 스냅샷 데이터로 직접 복원한다. Proxy 우회.

#### Parameters

##### data

`object`

#### Returns

`void`
