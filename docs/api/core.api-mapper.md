# core/api-mapper

REST API ↔ DomainState 직렬화/역직렬화 매퍼

`DomainState` 내부 전용 레이어.
**외부 개발자는 이 모듈을 직접 import하지 않는다.**

## 역할

| 함수           | 방향                             | 호출 시점                         |
|---------------|----------------------------------|----------------------------------|
| `toDomain()`  | JSON 문자열 → Proxy 래퍼 객체    | `ApiHandler.get()` 응답 수신 후   |
| `toPayload()` | 원본 객체 → JSON 문자열          | `DomainState.save()` POST / PUT  |
| `toPatch()`   | 변경 이력 → RFC 6902 Patch 배열  | `DomainState.save()` PATCH       |

## 의존성
- `createProxy()` — `toDomain()` 내부에서 JSON.parse 결과를 Proxy로 래핑
- `OP` — RFC 6902 연산 상수 (`'add'` | `'replace'` | `'remove'`)

## See

 - module:core/api-proxy createProxy
 - [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)

## Interfaces

- [ChangeLogEntry](core.api-mapper.Interface.ChangeLogEntry.md)
- [JsonPatchOperation](core.api-mapper.Interface.JsonPatchOperation.md)
- [ProxyWrapper](core.api-mapper.Interface.ProxyWrapper.md)

## Type Aliases

- [OnMutateCallback](core.api-mapper.TypeAlias.OnMutateCallback.md)

## Functions

- [toDomain](core.api-mapper.Function.toDomain.md)
- [toPatch](core.api-mapper.Function.toPatch.md)
- [toPayload](core.api-mapper.Function.toPayload.md)
