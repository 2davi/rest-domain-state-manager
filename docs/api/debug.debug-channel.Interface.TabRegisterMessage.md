# Interface: TabRegisterMessage

## Properties

### states

```ts
states: Record<string, DomainStateSnapshot>;
```

이 탭의 모든 DomainState 스냅샷 맵

***

### tabId

```ts
tabId: string;
```

이 탭의 고유 ID (`dsm_{timestamp}_{random}` 형식)

***

### tabUrl

```ts
tabUrl: string;
```

이 탭의 현재 URL (`location.href`)

***

### type

```ts
type: "TAB_REGISTER";
```

메시지 타입
