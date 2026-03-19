# Type Alias: FromFormFactory

> **FromFormFactory** = (`formOrId`, `handler`, `options?`) => [`DomainState`](model.DomainState.Class.DomainState.md)

## Type Parameters

## Parameters

### formOrId

`string` \| `HTMLFormElement`

HTML Form 요소의 `id` 문자열 또는 `HTMLFormElement` 직접 참조

### handler

[`ApiHandler`](handler.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

### options?

[`FromFormOptions`](plugin.form-binding.FormBinder.Interface.FromFormOptions.md)

추가 옵션

## Returns

[`DomainState`](model.DomainState.Class.DomainState.md)
