# Enumeration: MSG\_TYPE

MSG_TYPE : 디버그 채널 메시지 타입 상수

TAB_REGISTER   : 탭 열림 또는 팝업 ping에 대한 응답으로 재등록
TAB_UNREGISTER : 탭 닫힘 (beforeunload에서 전송)
TAB_PING       : 팝업이 열릴 때 전체 탭에 재등록 요청
DS_UPDATE      : DomainState 변경 시 스냅샷 전송
DS_ERROR       : after() 핸들러 실패 알림

## Enumeration Members

### DS\_ERROR

```ts
DS_ERROR: "DS_ERROR";
```

***

### DS\_UPDATE

```ts
DS_UPDATE: "DS_UPDATE";
```

***

### TAB\_PING

```ts
TAB_PING: "TAB_PING";
```

***

### TAB\_REGISTER

```ts
TAB_REGISTER: "TAB_REGISTER";
```

***

### TAB\_UNREGISTER

```ts
TAB_UNREGISTER: "TAB_UNREGISTER";
```
