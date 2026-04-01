# Type Alias: FromFormFactory

```ts
type FromFormFactory = (formOrId, handler, options?) => DomainState;
```

## Type Parameters

## Parameters

### formOrId

`string` \| `HTMLFormElement`

HTML Form 요소의 `id` 문자열 또는 `HTMLFormElement` 직접 참조

### handler

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

`ApiHandler` 인스턴스

### options?

[`FromFormOptions`](plugins.form-binder.FormBinder.Interface.FromFormOptions.md)

추가 옵션

## Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)
