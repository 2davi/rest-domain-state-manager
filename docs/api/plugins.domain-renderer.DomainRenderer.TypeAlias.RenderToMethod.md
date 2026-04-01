# Type Alias: RenderToMethod

```ts
type RenderToMethod = (container, config) => RenderResult;
```

## Type Parameters

## Parameters

### container

`string` \| `HTMLElement`

렌더링 결과를 삽입할 컨테이너. CSS 셀렉터 형식 문자열(`'#id'` 또는 `'id'`) 또는 `HTMLElement`.

### config

[`RenderConfig`](plugins.domain-renderer.DomainRenderer.TypeAlias.RenderConfig.md)

렌더링 설정 옵션

## Returns

[`RenderResult`](plugins.domain-renderer.DomainRenderer.TypeAlias.RenderResult.md)
