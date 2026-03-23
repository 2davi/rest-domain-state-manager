# Interface: DomainStateOptions

## Properties

### debug?

> `optional` **debug?**: `boolean`

`true`이면 `log()` / `openDebugger()` 활성화 및 디버그 채널 연결.

***

### handler?

> `optional` **handler?**: [`ApiHandler`](network.api-handler.Class.ApiHandler.md) \| `null`

`ApiHandler` 인스턴스. `save()` / `remove()` 호출에 필수.

***

### isNew?

> `optional` **isNew?**: `boolean`

`true`이면 `save()` 시 POST, `false`이면 PATCH/PUT.

***

### label?

> `optional` **label?**: `string`

디버그 팝업에 표시될 식별 레이블. 미입력 시 `ds_{timestamp}` 자동 생성.

***

### transformers?

> `optional` **transformers?**: [`TransformerMap`](domain.DomainState.TypeAlias.TransformerMap.md)

필드별 타입 변환 함수 맵. `DomainVO.getTransformers()` 결과.

***

### urlConfig?

> `optional` **urlConfig?**: [`NormalizedUrlConfig`](domain.DomainState.Interface.NormalizedUrlConfig.md) \| `null`

정규화된 URL 설정. 미입력 시 `handler.getUrlConfig()` 폴백.

***

### validators?

> `optional` **validators?**: [`ValidatorMap`](domain.DomainState.TypeAlias.ValidatorMap.md)

필드별 유효성 검사 함수 맵. `DomainVO.getValidators()` 결과.
