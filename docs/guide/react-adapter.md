# React 어댑터

<span class="badge badge-stable">Stable</span>

`@2davi/rest-domain-state-manager` 는 코어 라이브러리의 프레임워크 비의존성을 유지하면서 React 연동을 위한 별도 어댑터를 제공합니다. React 없이 Vanilla JS나 Vue에서도 `subscribe()` / `getSnapshot()` 을 직접 사용할 수 있습니다.

## 설치 전 조건

- React **18 이상** 설치 필요 (`useSyncExternalStore` 의존)
- `@2davi/rest-domain-state-manager` 설치 완료

## import 경로

코어 번들과 분리된 subpath export 입니다. 반드시 `/adapters/react` 경로로 import하세요.

```javascript
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react'
```

::: tip Tree-shaking
이 어댑터는 코어 번들에 포함되지 않습니다. React를 사용하지 않는 프로젝트는 이 파일이 번들에 포함되지 않습니다.
:::

---

## useDomainState

`DomainState` 의 불변 스냅샷을 React 컴포넌트에 연결하는 커스텀 훅입니다. `data` Proxy 를 통한 변이가 감지되면 컴포넌트를 자동으로 리렌더링합니다.

```javascript
const snapshot = useDomainState(domainState)
```

### 기본 사용

```javascript
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react'

function UserProfile({ userState }) {
    const data = useDomainState(userState)

    return (
        <div>
            <p>{data.name}</p>
            <p>{data.email}</p>
        </div>
    )
}
```

### 이벤트 핸들러에서 변이 후 자동 리렌더링

`userState.data` 에 값을 할당하면 microtask 배칭 완료 후 컴포넌트가 자동으로 리렌더링됩니다.

```javascript
function UserForm({ userState }) {
    const data = useDomainState(userState)

    const handleChange = (e) => {
        // Proxy set 트랩 발화 → microtask 배칭 → 리렌더링 자동 트리거
        userState.data[e.target.name] = e.target.value
    }

    const handleSave = async () => {
        try {
            await userState.save('/api/users/1')
        } catch (err) {
            // 실패 시 userState.data는 save() 이전 상태로 자동 복원됨
            console.error('저장 실패:', err.status)
        }
    }

    return (
        <>
            <input name="name"  value={data.name}  onChange={handleChange} />
            <input name="email" value={data.email} onChange={handleChange} />
            <button onClick={handleSave}>저장</button>
        </>
    )
}
```

---

## 동작 원리

`useDomainState` 는 내부적으로 React 18의 `useSyncExternalStore` 를 사용합니다.

```text
1. userState.data.name = 'Davi'
   → Proxy set 트랩 발화
   → changeLog 기록 + dirtyFields 갱신

2. microtask 배칭 완료
   → _buildSnapshot() 실행
   → 변경된 경로만 얕은 복사(Structural Sharing)
   → 새로운 #shadowCache 참조 생성

3. _notifyListeners() 호출
   → React가 getSnapshot() 재호출

4. Object.is(prevSnapshot, nextSnapshot)
   → 다른 참조 → 리렌더링 트리거
```

변경된 필드의 상위 경로만 새 참조를 만들고, 변경되지 않은 필드는 기존 메모리 참조를 재사용합니다(Structural Sharing). 불필요한 객체 복사 비용을 최소화합니다.

---

## subscribe() / getSnapshot() 직접 사용

`useDomainState` 를 사용하지 않고 두 메서드를 직접 연결할 수도 있습니다.

```javascript
import { useSyncExternalStore } from 'react'

function UserCard({ userState }) {
    const data = useSyncExternalStore(
        (cb) => userState.subscribe(cb),   // 구독 등록, 해제 함수 반환
        ()   => userState.getSnapshot()    // 현재 불변 스냅샷 반환
    )

    return <div>{data.name}</div>
}
```

### subscribe(listener)

상태 변경 시 호출될 리스너를 등록합니다. 반환값은 구독 해제 함수입니다. `useSyncExternalStore` 의 첫 번째 인자 규약을 만족합니다.

```javascript
const unsubscribe = userState.subscribe(() => {
    console.log('상태 변경됨')
})

// 구독 해제
unsubscribe()
```

### getSnapshot()

현재 상태의 불변 스냅샷을 반환합니다. 변경이 없으면 **이전과 동일한 참조를 반환**합니다. 매번 새 객체를 반환하면 `useSyncExternalStore` 가 무한 리렌더링 루프에 빠지기 때문입니다.

```javascript
const snap1 = userState.getSnapshot()
userState.data.name = 'Davi'

// microtask 완료 후
await Promise.resolve()

const snap2 = userState.getSnapshot()
console.log(snap1 === snap2)            // false — 새 참조
console.log(snap1.email === snap2.email) // true  — 미변경 필드는 동일 참조
```

---

## Vue / Vanilla JS 환경

React 없이도 `subscribe()` / `getSnapshot()` 을 직접 활용할 수 있습니다.

```javascript
// Vue 3 — watchEffect 연동
import { ref, watchEffect } from 'vue'

const snapshot = ref(userState.getSnapshot())
const unsubscribe = userState.subscribe(() => {
    snapshot.value = userState.getSnapshot()
})

// 컴포넌트 언마운트 시
onUnmounted(() => unsubscribe())
```

```javascript
// Vanilla JS — DOM 업데이트
const unsubscribe = userState.subscribe(() => {
    const data = userState.getSnapshot()
    document.getElementById('name').textContent = data.name
})
```

---

## 주의사항

::: warning Proxy 직접 변이
`useDomainState` 가 반환하는 `data` 는 불변 스냅샷입니다. 이 값을 직접 변경하지 마세요. 상태 변경은 반드시 `userState.data.field = value` 형태로 원본 Proxy 를 통해야 합니다.

```javascript
// ❌ 잘못된 방법 — 스냅샷 직접 변경 (개발 환경에서 freeze 에러 발생)
data.name = 'Davi'

// ✅ 올바른 방법 — Proxy를 통한 변경
userState.data.name = 'Davi'
```

:::
