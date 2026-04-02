# React / Vue 빠른 시작

<span class="badge badge-stable">Stable</span>

React 환경에서 GET → 수정 → PATCH 사이클을 자동화하는 예제입니다.  
`fetch`, `useState`, `useEffect`, 롤백 로직 없이 핵심만 남깁니다.

---

## 전제 조건

- `@2davi/rest-domain-state-manager` 설치 완료 ([설치 가이드](/guide/installation) 참고)
- React 18+ (`useSyncExternalStore` 지원)

```bash
npm install @2davi/rest-domain-state-manager
```

---

## Step 1 — ApiHandler 생성

애플리케이션 초기화 시 한 번 생성하고 재사용합니다.

```javascript
// api.js
import { ApiHandler } from '@2davi/rest-domain-state-manager';

export const api = new ApiHandler({
    host:  'localhost:8080',
    basePath: '/app/api',
    // debug: true  ← 개발 환경에서 BroadcastChannel 디버거 활성화
});
```

---

## Step 2 — useDomainState 훅으로 연결

```javascript
import { useState, useEffect } from 'react';
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
import { api } from './api';

function UserProfile({ userId }) {
    const [state, setState] = useState(null);

    useEffect(() => {
        api.get(`/users/${userId}`).then(setState);
    }, [userId]);

    // useDomainState: DomainState 변경 시 자동 리렌더링
    // state가 null이면 null 반환
    const data = useDomainState(state);

    if (!data) return <div>로딩 중...</div>;

    return (
        <form>
            <input
                value={data.name ?? ''}
                onChange={e => { state.data.name = e.target.value; }}
            />
            <input
                value={data.email ?? ''}
                onChange={e => { state.data.email = e.target.value; }}
            />
            <button
                type="button"
                onClick={() => state.save(`/users/${userId}`)}
            >
                저장
            </button>
        </form>
    );
}
```

`state.data.name = e.target.value` — 이 한 줄이 Proxy를 통해 변경을 기록하고, `useDomainState`가 리렌더링을 트리거합니다.

---

## Step 3 — 저장과 에러 처리

```javascript
async function handleSave() {
    try {
        await state.save(`/users/${userId}`);
        // PATCH 자동 선택 (일부 필드만 변경된 경우)
        // 성공 후 changeLog 자동 초기화
    } catch (err) {
        // 실패 시 state.data가 save() 이전으로 자동 복원
        // 별도의 useState 에러 상태 관리 불필요
        console.error('저장 실패:', err.status);
    }
}
```

::: tip 자동으로 처리되는 것들
- `name`만 변경 → PATCH (변경 필드 2개 / 전체 필드 5개 = 40% < 70% 기준)
- 모든 필드 변경 → PUT
- 저장 실패 → 모든 내부 상태 자동 복원, 즉시 재시도 가능
:::

---

## Step 4 — 신규 생성 (POST)

`DomainState.fromVO()`로 기본값 골격 상태를 만들면 `isNew: true`가 설정됩니다. `save()` 시 자동으로 POST를 선택합니다.

```javascript
import { DomainState, DomainVO } from '@2davi/rest-domain-state-manager';

class UserVO extends DomainVO {
    static fields = {
        name:  { default: '', validate: v => v.trim().length > 0 },
        email: { default: '' },
        role:  { default: 'USER' },
    };
}

function NewUserForm() {
    const [state] = useState(() => DomainState.fromVO(new UserVO(), api));
    const data = useDomainState(state);

    return (
        <form>
            <input
                value={data.name}
                onChange={e => { state.data.name = e.target.value; }}
            />
            <button
                type="button"
                onClick={() => state.save('/users')}  // → POST
            >
                생성
            </button>
        </form>
    );
}
```

::: info DomainVO는 선택 사항입니다
기본값과 유효성 검사가 필요할 때만 `DomainVO`를 사용하세요.  
`fromJSON()`은 VO 없이 완전히 동작합니다.
:::

---

## 전체 흐름 요약

```javascript
import { useState, useEffect } from 'react';
import { ApiHandler, DomainState } from '@2davi/rest-domain-state-manager';
import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

const api = new ApiHandler({ host: 'localhost:8080' });

function UserProfile({ userId }) {
    const [state, setState] = useState(null);

    useEffect(() => {
        api.get(`/api/users/${userId}`).then(setState);
    }, [userId]);

    const data = useDomainState(state);
    if (!data) return null;

    return (
        <>
            <input value={data.name} onChange={e => { state.data.name = e.target.value; }} />
            <button onClick={() => state.save(`/api/users/${userId}`)}>저장</button>
        </>
    );
}
```

`useState`, `useEffect` 이외의 보일러플레이트가 없습니다.

---

## lazy 모드로 성능 최적화

중간 편집 이력 없이 최종 변경분만 서버에 전송하고 싶다면 `trackingMode: 'lazy'`를 사용하세요.

```javascript
const user = await api.get('/api/users/1', { trackingMode: 'lazy' });

// 같은 필드를 10번 수정해도 최종 값만 PATCH에 포함됨
user.data.name = 'A';
user.data.name = 'B';
user.data.name = 'Final';

await user.save('/api/users/1');
// PATCH body: [{ op: 'replace', path: '/name', value: 'Final' }]
// 중간 변경 이력 없음
```

자세한 내용은 [추적 모드 비교](/guide/tracking-modes) 가이드를 참고하세요.

---

## 다음 단계

- [팩토리 메서드](/guide/factories) — `fromJSON`, `fromVO`, `fromForm` 차이
- [save() 분기 전략](/guide/save-strategy) — POST/PUT/PATCH 자동 선택 알고리즘 상세
- [추적 모드 비교](/guide/tracking-modes) — `realtime` vs `lazy` 선택 기준
- [React 어댑터](/guide/react-adapter) — `useDomainState` 내부 구조
