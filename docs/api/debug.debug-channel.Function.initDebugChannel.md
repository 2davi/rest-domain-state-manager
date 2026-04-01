# Function: initDebugChannel()

```ts
function initDebugChannel(): void;
```

디버그 채널의 브라우저 전용 사이드 이펙트를 초기화한다.

아래 세 가지 동작을 수행하며, 브라우저 환경에서 단 한 번만 실행된다:
1. `TAB_PING` 수신 시 `registerTab()`으로 응답하는 채널 리스너 등록
2. `beforeunload` 시 `TAB_UNREGISTER` 전송 리스너 등록
3. 초기 `registerTab()` 호출 (팝업이 이미 열려있다면 즉시 이 탭을 인식함)

`broadcastUpdate()` 내부에서 lazy하게 호출되므로,
실제로 `debug: true`인 `DomainState` 인스턴스가 상태 변경을 일으키기 전까지는
실행되지 않는다.

`window`가 존재하지 않는 환경(Node.js, Vitest node environment)에서는
즉시 반환하여 아무 동작도 하지 않는다 (no-op).

## Returns

`void`
