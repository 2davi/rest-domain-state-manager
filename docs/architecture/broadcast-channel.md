# 디버그 채널 프로토콜

이 문서는 `src/debug/debug-channel.js` 가 구현하는 BroadcastChannel 기반 멀티탭 통신 프로토콜의 설계와 메시지 스펙을 기술합니다.

## 아키텍처 개요

같은 출처(Origin)의 모든 브라우저 탭이 `'dsm_debug'` 채널로 연결됩니다. 디버그 팝업은 이 채널을 구독하여 모든 탭의 `DomainState` 상태를 실시간으로 수신합니다.

```text
[탭 A]              [탭 B]              [디버그 팝업]
  │                   │                      │
  │◄──── TAB_PING ────┼──────────────────────┤  팝업이 ping 전송
  │                   │                      │
  ├──── TAB_REGISTER ─┼──────────────────────►  각 탭이 자신을 등록
  │                   ├──── TAB_REGISTER ────►
  │                   │                      │
  ├──── DS_UPDATE ────┼──────────────────────►  상태 변경 시 broadcast
  │                   │                      │
  │ (탭 닫힘/새로고침)│                      │
  ├── TAB_UNREGISTER ─┼──────────────────────►  탭 해제 알림
```

### BroadcastChannel 자기 수신 불가 제약 우회

BroadcastChannel은 자신이 보낸 메시지를 수신하지 않습니다. 이 특성 때문에 팝업이 직접 `TAB_PING` 을 broadcast하고, 각 탭이 `TAB_REGISTER` 로 응답하는 역방향 구조를 사용합니다. 팝업이 자신의 ping에 응답할 수 없으므로 팝업은 탭 목록에 포함되지 않습니다.

## 메시지 타입

<table class="param-table">
  <thead>
    <tr><th>타입</th><th>발신</th><th>수신</th><th>시점</th></tr>
  </thead>
  <tbody>
    <tr><td><code>TAB_REGISTER</code></td><td>각 탭</td><td>팝업</td><td>페이지 로드 직후 (최초 자기 등록), TAB_PING 수신 시 응답</td></tr>
    <tr><td><code>TAB_UNREGISTER</code></td><td>각 탭</td><td>팝업</td><td>beforeunload 이벤트, closeDebugChannel() 호출</td></tr>
    <tr><td><code>TAB_PING</code></td><td>팝업</td><td>각 탭</td><td>팝업 초기화 직후, 이후 2초마다 (Heartbeat)</td></tr>
    <tr><td><code>DS_UPDATE</code></td><td>각 탭</td><td>팝업</td><td>DomainState._broadcast() 호출 시</td></tr>
    <tr><td><code>DS_ERROR</code></td><td>각 탭</td><td>팝업</td><td>DomainPipeline after() 핸들러 실패 시</td></tr>
  </tbody>
</table>

## Heartbeat & GC 전략

`beforeunload` 이벤트는 모바일 브라우저, SPA 라우팅, 강제 종료 환경에서 신뢰할 수 없습니다. 이 이벤트만 의존하면 팝업의 탭 레지스트리에 죽은 탭이 영구적으로 남을 수 있습니다.

팝업은 2초마다 `TAB_PING` 을 broadcast하고, 탭은 살아있음을 증명하는 `TAB_REGISTER` 로 응답합니다. GC 로직은 2초마다 `lastSeen` 타임스탬프를 확인하여 **5초 이상 응답이 없는 탭을 죽은 탭으로 판단하고 레지스트리에서 제거**합니다.

```javascript
//팝업 내부:
  setInterval(() => channel.postMessage({ type: 'TAB_PING' }), 2000)

  setInterval(() => {
    const now = Date.now()
    for (const [id, tab] of tabs) {
      if (now - tab.lastSeen > 5000) {
        tabs.delete(id)     // 죽은 탭 제거
      }
    }
  }, 2000)
```

## Lazy Initialization

`debug-channel.js` 는 import 시점에 브라우저 전용 사이드 이펙트를 실행하지 않습니다. `broadcastUpdate()` 가 최초 호출될 때, 즉 `debug: true` 인 `DomainState` 가 처음으로 상태를 broadcast하는 순간에 `initDebugChannel()` 이 실행됩니다.

```javascript
export function broadcastUpdate(label, snapshot) {
    initDebugChannel()    // 최초 호출 시만 실행, 이후는 _initialized 플래그로 skip
    _stateRegistry.set(label, snapshot)
    getChannel()?.postMessage({ type: MSG_TYPE.DS_UPDATE, ... })
}
```

이 구조는 Node.js / Vitest 테스트 환경에서 `window`, `location` 등 브라우저 전용 전역에 대한 `ReferenceError` 없이 모듈을 안전하게 import할 수 있게 합니다. `typeof window === 'undefined'` 가드가 `initDebugChannel()` 내부에 단 한 곳에만 존재합니다.

## 메모리 누수 방지

SPA 환경에서 라우트 이동 시 `closeDebugChannel()` 을 호출하지 않으면 `BroadcastChannel` 인스턴스가 GC 대상이 되지 않아 메모리 누수가 발생합니다.

```javascript
import { closeDebugChannel } from '@2davi/rest-domain-state-manager'

// Vue Composition API
onUnmounted(() => closeDebugChannel())

// React Effect
useEffect(() => () => closeDebugChannel(), [])
```

`closeDebugChannel()` 은 `TAB_UNREGISTER` 메시지를 전송한 뒤 `BroadcastChannel.close()` 를 호출하고 내부 참조를 `null` 로 리셋합니다.
