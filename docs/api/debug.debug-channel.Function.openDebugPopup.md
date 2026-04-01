# Function: openDebugPopup()

```ts
function openDebugPopup(): void;
```

디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.

`DomainState.openDebugger()` 호출 시 실행된다. (`debug: true` 시만 호출)

## 동작 흐름
1. `window.open()`으로 팝업을 열거나 기존 창에 포커스한다.
2. 팝업 내 `#dsm-root` 요소 존재 여부로 초기화 여부를 판단한다.
3. `_serializeWorker.terminate()`로 Worker 스레드를 종료하고 참조를 해제한다.
4. 초기화되지 않은 경우: `_buildPopupHTML()`로 생성한 HTML을 주입한다.
5. 팝업 `load` 이벤트 후 `_initPopupChannel()`로 채널을 연결한다.
   (현재 팝업 내부 스크립트가 자체적으로 채널을 처리하므로 실질적으로는 No-op)

팝업 차단으로 `window.open()`이 `null`을 반환하면 콘솔 경고 후 조기 반환한다.

## Returns

`void`

## Example

```ts
const user = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'User' });
user.openDebugger(); // → openDebugPopup() 내부 호출
```
