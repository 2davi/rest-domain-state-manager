# Interface: FromVoOptions

## Properties

### debug?

> `optional` **debug?**: `boolean`

디버그 모드 활성화.

***

### label?

> `optional` **label?**: `string` \| `null`

디버그 팝업 표시 이름. 미입력 시 `vo.constructor.name`.

***

### urlConfig?

> `optional` **urlConfig?**: [`NormalizedUrlConfig`](domain.DomainState.Interface.NormalizedUrlConfig.md) \| `null`

URL 설정 오버라이드. 미입력 시 `vo.getBaseURL()` 폴백.
