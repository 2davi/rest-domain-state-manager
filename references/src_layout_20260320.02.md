# Src Layout (2026-03-20)

## (a) TypeDoc 빌드 에러 확인

| 파일 | 수정 내용 |
|---|---|
| `src/core/url-resolver.js` | `module:handler/api-handler` → `{@link ApiHandler}` |
| `src/debug/debug-channel.js` | `module:model/DomainState` → `{@link DomainState}` |
| `src/core/api-mapper.js` | `module:core/api-proxy` → `{@link createProxy}` |
| `src/domain/DomainState.js` | `module:domain/DomainVO`, `module:domain/DomainPipeline`, `module:network/api-handler` → 각 심볼명 |
| `src/domain/DomainVO.js` | `module:domain/DomainState` → `{@link DomainState}` |
| `src/domain/DomainPipeline.js` | `module:domain/DomainState` → `{@link DomainState}` |
| `src/network/api-handler.js` | `module:domain/DomainState`, `module:core/url-resolver` → 각 심볼명 |
| `src/plugins/domain-renderer/DomainRenderer.js` | 렌더러 4개 링크 → 각 심볼명 |
| `src/plugins/domain-renderer/renderer.const.js` | `module:plugins/...` 2개 → 각 심볼명 |
| `src/plugins/form-binder/FormBinder.js` | `module:domain/DomainState`, `module:core/api-proxy` → 각 심볼명 |
| `src/plugins/domain-renderer/renderers/*.js` | `module:plugins/domain-renderer/DomainRenderer` → `{@link DomainRenderer}` |

```markdown
fix(docs): replace module: namespace links with TypeDoc-compatible symbol links

  - TypeDoc은 {&#64;link module:X} JSDoc 네임스페이스 구문을 resolve하지 못함
  - 전체 파일의 @see {&#64;link module:경로 심볼} → @see {&#64;link 심볼} 로 교체
  - src/core/url-resolver.js: handler/api-handler → network/api-handler 경로 수정
  - src/debug/debug-channel.js: model/DomainState → domain/DomainState 경로 수정
```
