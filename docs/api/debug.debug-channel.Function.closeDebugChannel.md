# Function: closeDebugChannel()

```ts
function closeDebugChannel(): void;
```

`BroadcastChannel`을 명시적으로 닫고 내부 참조를 해제한다.

SPA(Single Page Application) 환경에서 라우트 이동이나 컴포넌트 언마운트 시
이 함수를 호출하여 채널 객체가 GC 대상이 되도록 해야 한다.

채널이 닫히기 전에 `TAB_UNREGISTER` 메시지를 한 번 전송하여
팝업이 즉시 이 탭을 레지스트리에서 제거할 수 있도록 한다.

`_channel`이 이미 `null`이면 아무 동작도 하지 않는다.

## Returns

`void`

## Example

```ts
import { closeDebugChannel } from './rest-domain-state-manager.js';

// Vue 3 / React의 cleanup 훅에서:
onUnmounted(() => closeDebugChannel());
useEffect(() => () => closeDebugChannel(), []);
```
