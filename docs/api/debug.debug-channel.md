# debug/debug-channel

디버그 BroadcastChannel 통신 및 팝업 관리

같은 출처(Origin)의 모든 브라우저 탭이 `'dsm_debug'` 채널로 연결되어
디버그 팝업 창에서 모든 탭의 `DomainState` 상태를 실시간으로 확인할 수 있다.

## 아키텍처 — BroadcastChannel 기반 멀티탭 통신

```
[탭 A]              [탭 B]              [디버그 팝업]
  │                   │                      │
  │◄──── TAB_PING ────┼──────────────────────│  팝업이 ping 전송
  │                   │                      │
  ├──── TAB_REGISTER ─┼──────────────────────►  각 탭이 자신을 등록
  │                   ├──── TAB_REGISTER ────►
  │                   │                      │
  ├──── DS_UPDATE ────┼──────────────────────►  상태 변경 시 broadcast
  │                   │                      │
  │ (탭 닫힘/새로고침)│                      │
  ├── TAB_UNREGISTER ─┼──────────────────────►  탭 해제 알림
```

## BroadcastChannel 자기 수신 불가 제약 우회
BroadcastChannel은 자기 자신이 보낸 메시지를 수신하지 않는다.
따라서 팝업이 직접 `TAB_PING`을 broadcast하고, 각 탭이 `TAB_REGISTER`로 응답한다.

## Heartbeat & GC 전략
팝업은 2초마다 `TAB_PING`을 전송하고, 탭은 `TAB_REGISTER`로 응답한다.
팝업의 GC 로직이 2초마다 `lastSeen` 타임스탬프를 확인하여
5초 이상 응답이 없는 탭을 죽은 탭으로 판단하고 레지스트리에서 제거한다.
`beforeunload` 이벤트에 의존하지 않아 모바일 브라우저나 강제 종료에도 대응한다.

## 메모리 누수 방지
SPA 환경에서 컴포넌트가 언마운트될 때 `closeDebugChannel()`을 호출하여
`BroadcastChannel`을 명시적으로 닫고 GC 대상이 되도록 해야 한다.

## 초기화 전략 — Lazy Initialization
이 모듈은 import 시 브라우저 전용 사이드 이펙트를 즉시 실행하지 않는다.
`broadcastUpdate()`가 최초 호출되는 시점, 즉 `debug: true`인 `DomainState`가
처음으로 상태를 broadcast하는 순간에 `initDebugChannel()`이 lazy하게 실행된다.

이 구조를 통해 Node.js / Vitest 테스트 환경에서 `window`, `location` 등
브라우저 전용 전역 객체에 대한 `ReferenceError` 없이 모듈을 안전하게 import할 수 있다.

초기화 순서:
1. `broadcastUpdate()` 최초 호출 → `initDebugChannel()` 실행
2. `TAB_PING` 수신 시 `registerTab()` 응답 리스너 등록
3. `beforeunload` 시 `TAB_UNREGISTER` 전송 리스너 등록
4. 초기 `registerTab()` 호출 (페이지 로드 직후 자기 등록)

## See

 - [MDN — BroadcastChannel](https://developer.mozilla.org/ko/docs/Web/API/BroadcastChannel)
 - module:domain/DomainState DomainState

## Interfaces

- [BroadcastSnapshot](debug.debug-channel.Interface.BroadcastSnapshot.md)
- [DomainStateSnapshot](debug.debug-channel.Interface.DomainStateSnapshot.md)
- [DsErrorMessage](debug.debug-channel.Interface.DsErrorMessage.md)
- [DsUpdateMessage](debug.debug-channel.Interface.DsUpdateMessage.md)
- [TabRegisterMessage](debug.debug-channel.Interface.TabRegisterMessage.md)
- [TabUnregisterMessage](debug.debug-channel.Interface.TabUnregisterMessage.md)

## Type Aliases

- [DebugMessageType](debug.debug-channel.TypeAlias.DebugMessageType.md)

## Functions

- [broadcastError](debug.debug-channel.Function.broadcastError.md)
- [broadcastUpdate](debug.debug-channel.Function.broadcastUpdate.md)
- [closeDebugChannel](debug.debug-channel.Function.closeDebugChannel.md)
- [initDebugChannel](debug.debug-channel.Function.initDebugChannel.md)
- [openDebugPopup](debug.debug-channel.Function.openDebugPopup.md)
