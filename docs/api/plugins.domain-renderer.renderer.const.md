# plugins/domain-renderer/renderer.const

DomainRenderer 플러그인 내부 상수 모음

`renderTo()` config의 `type` 식별자,
폼 이벤트 추적 전략 분류,
텍스트 계열 input type 집합을 정의한다.

## 사용처

| 상수                | 사용 모듈                          | 용도                                    |
|--------------------|-----------------------------------|-----------------------------------------|
| `RENDERER_TYPE`    | `DomainRenderer.js`               | `renderTo()` config의 `type` 검증       |
| `RENDERER_TYPE`    | `DomainRenderer.js` switch 분기   | 타입별 렌더러 위임                        |
| `TRACK_EVENT`      | `FormBinder.js` (참고용)          | 이벤트 전략 분류 명시                     |
| `TEXT_LIKE_TYPES`  | `FormBinder.js`                   | text 계열 input 판별                     |

## See

 - module:plugins/domain-renderer/DomainRenderer DomainRenderer
 - module:plugins/form-binder/FormBinder FormBinder

## Enumerations

- [RENDERER\_TYPE](plugins.domain-renderer.renderer.const.Enumeration.RENDERER_TYPE.md)
- [TRACK\_EVENT](plugins.domain-renderer.renderer.const.Enumeration.TRACK_EVENT.md)

## Type Aliases

- [RendererTypeValue](plugins.domain-renderer.renderer.const.TypeAlias.RendererTypeValue.md)
- [TrackEventValue](plugins.domain-renderer.renderer.const.TypeAlias.TrackEventValue.md)

## Variables

- [TEXT\_LIKE\_TYPES](plugins.domain-renderer.renderer.const.Variable.TEXT_LIKE_TYPES.md)
