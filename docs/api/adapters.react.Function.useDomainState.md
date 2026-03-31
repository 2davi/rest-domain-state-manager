# Function: useDomainState()

> **useDomainState**(`domainState`): `object`

`DomainState`의 불변 스냅샷을 React 컴포넌트에 연결하는 커스텀 훅.

내부적으로 `useSyncExternalStore`를 사용한다.
`DomainState.data`의 변이가 감지되면 컴포넌트를 리렌더링한다.

## 동작 원리
1. `state.data.name = 'Davi'` — Proxy set 트랩 발화
2. microtask 배칭 완료 → `_buildSnapshot()` → 새 `#shadowCache` 참조
3. `_notifyListeners()` → React가 `getSnapshot()` 재호출
4. `Object.is(prev, next)` → 다른 참조 → 리렌더링 트리거

## Parameters

### domainState

[`DomainState`](domain.DomainState.Class.DomainState.md)

구독할 DomainState 인스턴스

## Returns

`object`

현재 상태의 불변 스냅샷. 변경 시 새 참조 반환.

## Examples

```ts
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

function UserProfile({ userState }) {
    const data = useDomainState(userState);
    return <div>{data.name}</div>;
}
```

```ts
function UserForm({ userState }) {
    const data = useDomainState(userState);

    const handleChange = (e) => {
        // Proxy 변이 → microtask 배칭 → 리렌더링 자동 트리거
        userState.data[e.target.name] = e.target.value;
    };

    return <input name="name" value={data.name} onChange={handleChange} />;
}
```
