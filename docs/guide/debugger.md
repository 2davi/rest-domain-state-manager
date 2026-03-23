# 디버거

<span class="badge badge-stable">Stable</span>

DSM은 `BroadcastChannel` API를 기반으로 한 멀티탭 디버그 팝업을 내장하고 있습니다. 추가 설정 없이 `debug: true` 옵션 하나로 활성화되며, 같은 출처(Origin)의 모든 탭에서 생성된 `DomainState` 인스턴스를 실시간으로 시각화합니다.

## 활성화

`DomainState` 인스턴스 생성 시 `debug: true` 를 전달합니다.

```javascript
// api.get() 옵션으로 전달
const user = await api.get('/users/user_001', { debug: true, label: 'User' })

// fromVO() 옵션으로 전달
const newUser = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'New User' })

// fromJSON() 옵션으로 전달
const user = DomainState.fromJSON(jsonText, api, { debug: true })
```

`debug: true` 인 인스턴스는 상태가 변경될 때마다 디버그 채널로 스냅샷을 broadcast합니다.

## 팝업 열기

```javascript
user.openDebugger()
```

`debug: true` 인 인스턴스에서 `openDebugger()` 를 호출하면 디버그 팝업 창이 열립니다. 이미 열려 있는 경우 포커스만 이동합니다.

팝업은 같은 출처의 모든 탭을 목록으로 표시하고, 각 탭에서 생성된 `DomainState` 인스턴스의 실시간 상태를 보여줍니다.

## 팝업에서 확인할 수 있는 정보

- **현재 데이터 (`data`)** — `_getTarget()` 의 현재 값을 JSON pretty-print로 표시
- **변경 이력 (`changeLog`)** — 누적된 RFC 6902 형식의 변경 이력
- **상태 뱃지** — `isNew` 여부를 NEW / EXIST 뱃지로 표시
- **에러 목록** — `DomainPipeline` 의 `after()` 핸들러에서 발생한 오류

## Heartbeat 메커니즘

팝업은 2초마다 `TAB_PING` 메시지를 broadcast합니다. 각 탭은 `TAB_REGISTER` 로 응답하며, 5초 이상 응답이 없는 탭은 팝업이 자동으로 레지스트리에서 제거합니다. `beforeunload` 이벤트에 의존하지 않으므로 모바일 브라우저나 강제 종료 환경에서도 정확하게 동작합니다.

## SPA 환경에서의 정리

SPA에서 라우트 이동이나 컴포넌트 언마운트 시 채널을 명시적으로 닫아야 메모리 누수를 방지할 수 있습니다.

```javascript
import { closeDebugChannel } from '@2davi/rest-domain-state-manager'

// Vue 컴포넌트 예시
onUnmounted(() => {
    closeDebugChannel()
})

// React 컴포넌트 예시
useEffect(() => {
    return () => closeDebugChannel()
}, [])
```

::: tip 프로덕션에서는 비활성화
`debug: true` 를 프로덕션 빌드에 포함시키지 마세요. `BroadcastChannel` 초기화 비용과 불필요한 직렬화 오버헤드가 발생합니다. 빌드 환경 변수를 통해 조건부로 적용하는 것을 권장합니다.

```javascript
const user = await api.get('/users/1', {
    debug: import.meta.env.DEV,  // Vite 환경
    // debug: process.env.NODE_ENV !== 'production',
})
```

:::

## 디버그 채널 내부 동작

디버그 채널의 상세 프로토콜 설계(Heartbeat GC, 탭 등록/해제 메시지 구조)는 [디버그 채널 프로토콜](/architecture/broadcast-channel) 문서를 참고하세요.
