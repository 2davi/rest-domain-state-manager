# Interface: PipelineOptions

## Properties

### strict?

> `optional` **strict?**: `boolean`

`true`이면 fetch 또는 `after()` 핸들러 실패 시 즉시 reject.
  `false`(기본값)이면 `_errors`에 기록하고 계속 진행.
