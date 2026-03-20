# Interface: TabRegisterMessage

## Properties

### states

> **states**: `Record`\<`string`, [`DomainStateSnapshot`](debug.debug-channel.Interface.DomainStateSnapshot.md)\>

이 탭의 모든 DomainState 스냅샷 맵

***

### tabId

> **tabId**: `string`

이 탭의 고유 ID (`dsm_{timestamp}_{random}` 형식)

***

### tabUrl

> **tabUrl**: `string`

이 탭의 현재 URL (`location.href`)

***

### type

> **type**: `"TAB_REGISTER"`

메시지 타입
