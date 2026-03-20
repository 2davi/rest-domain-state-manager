# Interface: DomainStateSnapshot

## Properties

### changeLog

> **changeLog**: [`ChangeLogEntry`](core.api-mapper.Interface.ChangeLogEntry.md)[]

현재 변경 이력

***

### data

> **data**: `object`

`DomainState._getTarget()` 결과 (원본 객체)

***

### errors

> **errors**: `any`[]

인스턴스 수준 에러 목록

***

### isNew

> **isNew**: `boolean`

신규 리소스 여부

***

### label

> **label**: `string`

`DomainState`의 식별 레이블
