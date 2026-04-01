# Function: resolveProtocol()

```ts
function resolveProtocol(opts?): string;
```

주어진 옵션을 우선순위에 따라 평가하여 프로토콜 문자열을 결정한다.

## 우선순위
1. `protocol` 명시 → `PROTOCOL[key]` 반환 (예: `'https://'`)
2. `env` 명시 → `DEFAULT_PROTOCOL[env]` 반환 (없으면 `DEFAULT_PROTOCOL['development']`)
3. `debug: true` → `PROTOCOL.HTTP` (`'http://'`)
4. 그 외 → `PROTOCOL.HTTPS` (`'https://'`) — 보안 기본값

`normalizeUrlConfig()` 내부에서 호출되며, 단독으로도 사용 가능하다.

## Parameters

### opts?

[`ResolveProtocolOptions`](core.url-resolver.Interface.ResolveProtocolOptions.md) = `{}`

프로토콜 결정 옵션

## Returns

`string`

확정된 프로토콜 문자열 (예: `'http://'`, `'https://'`, `'file://'`)

## Throws

`protocol` 값이 `VALID_PROTOCOL_KEYS`에 없는 경우

## Examples

```ts
resolveProtocol({ protocol: 'HTTPS' }); // → 'https://'
resolveProtocol({ protocol: 'http' });  // → 'http://'  (대소문자 무관)
```

```ts
resolveProtocol({ env: 'production' });  // → 'https://'
resolveProtocol({ env: 'development' }); // → 'http://'
```

```ts
resolveProtocol({ debug: true });  // → 'http://'
resolveProtocol({ debug: false }); // → 'https://'
resolveProtocol({});               // → 'https://'  (기본값)
```

```ts
resolveProtocol({ protocol: 'FTP' }); // → Error throw
```
