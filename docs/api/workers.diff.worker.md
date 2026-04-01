# workers/diff.worker

DSM Diff Worker — lazy tracking mode 전용

`DomainState`의 `lazy` tracking mode에서 `save()` 호출 시,
메인 스레드의 diff 연산을 오프로딩하여 UI 블로킹을 방지한다.

## 책임
`DIFF` 메시지를 수신하여 `deepDiff(initial, current, itemKey?)` 연산을 수행하고
`DIFF_RESULT` 메시지로 changeLog 배열을 응답한다.

## 수신 메시지 구조
```
{
  type:    'DIFF',
  id:      string,    // 요청 식별자 (응답 매칭용)
  payload: string,    // JSON.stringify({ initial, current })
  itemKey: string?    // 배열 항목 동일성 기준 필드명 (없으면 positional)
}
```

## 응답 메시지 구조
```
{
  type:      'DIFF_RESULT',
  id:        string,              // 요청과 동일한 식별자
  changeLog: ChangeLogEntry[],    // RFC 6902 형식 변경 이력
  error?:    string               // 에러 발생 시 메시지
}
```

## postMessage 전송 비용 최소화 전략
메인 스레드에서 `JSON.stringify({ initial, current })`로 문자열화 후 전달한다.
`postMessage`의 structuredClone이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
(`serializer_worker.js`에서 이미 검증된 패턴)
Worker는 수신 후 `JSON.parse()`로 역직렬화하여 deepDiff를 수행한다.

## BroadcastChannel 미사용
이 Worker는 순수 diff 연산만 담당한다.
`serializer_worker.js`(디버그 채널 브로드캐스팅 전용)와 역할이 완전히 분리된다.

## See

 - module:common/lcs-diff deepDiff
 - module:workers/diff-worker-client requestDiff
