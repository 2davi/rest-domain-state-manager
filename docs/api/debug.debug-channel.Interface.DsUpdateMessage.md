# Interface: DsUpdateMessage

## Properties

### label

```ts
label: string;
```

변경된 `DomainState`의 식별 레이블

***

### snapshot

```ts
snapshot: DomainStateSnapshot;
```

변경 직후 스냅샷

***

### tabId

```ts
tabId: string;
```

전송 탭의 고유 ID

***

### tabUrl

```ts
tabUrl: string;
```

전송 탭의 현재 URL

***

### type

```ts
type: "DS_UPDATE";
```

메시지 타입
