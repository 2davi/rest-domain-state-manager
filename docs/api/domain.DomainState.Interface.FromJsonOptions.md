# Interface: FromJsonOptions

## Properties

### debug?

> `optional` **debug?**: `boolean`

디버그 모드 활성화.

***

### label?

> `optional` **label?**: `string` \| `null`

디버그 팝업 표시 이름. 미입력 시 `json_{timestamp}`.

***

### urlConfig?

> `optional` **urlConfig?**: [`NormalizedUrlConfig`](domain.DomainState.Interface.NormalizedUrlConfig.md) \| `null`

URL 설정 오버라이드.

***

### vo?

> `optional` **vo?**: [`DomainVO`](domain.DomainVO.Class.DomainVO.md) \| `null`

DomainVO 인스턴스. 스키마 검증 + validators/transformers 주입.
