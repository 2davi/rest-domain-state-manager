# workers/serializer.worker

DSM Serialize Worker

메인 스레드의 `_stateRegistry` 직렬화 및 BroadcastChannel 발화를 오프로딩 처리한다.

## 책임
`REGISTER_TAB` 메시지를 수신하여 JSON.parse 후 BroadcastChannel에 `TAB_REGISTER`를 발화한다.

## 수신 메시지 구조
```
{
  type:    'REGISTER_TAB',
  tabId:   string,
  tabUrl:  string,
  payload: string   // JSON.stringify(Object.fromEntries(_stateRegistry))
}
```

## postMessage 전송 비용 최소화 전략
메인 스레드에서 `JSON.stringify()` 후 문자열로 전달한다.
`postMessage`의 `structuredClone`이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
Worker는 수신 후 `JSON.parse()`로 역직렬화하여 채널에 발화한다.

## BroadcastChannel 호환성
BroadcastChannel API는 Web Worker 컨텍스트에서 직접 인스턴스화 가능하다.
MDN 공식 명세에서 확인됨.

## See

 - [MDN — BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
 - [MDN — Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker)
