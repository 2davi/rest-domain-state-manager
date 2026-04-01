# Interface: FromFormOptions

## Properties

### debug?

```ts
optional debug?: boolean;
```

디버그 모드 활성화. `true`이면 Proxy 변경 시마다 디버그 채널에 broadcast.

***

### label?

```ts
optional label?: string;
```

디버그 팝업 표시 이름. 미입력 시 `formEl.id` → 없으면 `'form_state'`.

***

### urlConfig?

```ts
optional urlConfig?: 
  | NormalizedUrlConfig
  | null;
```

URL 설정 오버라이드. 미입력 시 `handler.getUrlConfig()` 폴백.
