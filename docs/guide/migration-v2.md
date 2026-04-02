# v2.0.0으로 이전하기

`FormBinder`와 `DomainRenderer`는 v1.4.0에서 deprecated 되었습니다.  
v2.x에서 제거될 예정입니다. 이 가이드는 `UIComposer`로 전환하는 방법을 설명합니다.

---

## 변경 요약

| v1.3.x 이전 | v1.4.x 이후 | 상태 |
|---|---|---|
| `FormBinder` | `UIComposer` + `UILayout` | deprecated |
| `DomainRenderer` | `UIComposer` + `UILayout` | deprecated |

두 플러그인은 v2.x 전까지 정상 동작합니다. 서두르지 않아도 되지만, 콘솔에서 deprecated 경고를 확인했다면 전환을 시작하세요.

---

## FormBinder → UIComposer

### Before — FormBinder

```javascript
import { DomainState, FormBinder } from '@2davi/rest-domain-state-manager';

DomainState.use(FormBinder);

// DOM-first 방향: 폼 DOM을 기준으로 DomainState 생성
const user = DomainState.fromForm('userForm', api);
// 폼 필드명이 곧 DomainState 데이터 키

user.data.name = 'Davi'; // 폼 요소에도 반영되지 않음 (단방향)
await user.save('/api/users/1');
```

### After — UIComposer

```javascript
import { DomainState, UIComposer, UILayout } from '@2davi/rest-domain-state-manager';

DomainState.use(UIComposer);

// 화면별 UI 계약 선언
class UserFormLayout extends UILayout {
    static columns = {
        name:  { selector: '[name="name"]' },
        email: { selector: '[name="email"]' },
        role:  { selector: '[name="role"]' },
    };
}

// State-first 방향: DomainState를 먼저 생성하고 폼에 바인딩
const user = await api.get('/api/users/1');
const { unbind } = user.bindSingle('#userForm', { layout: UserFormLayout });

// 폼 입력 → state.data 즉시 반영 (양방향)
// state.data 변경 → 폼 요소 즉시 반영 (양방향)
await user.save('/api/users/1');

// 컴포넌트 언마운트 시
unbind();
```

### 주요 차이점

| 항목 | FormBinder | UIComposer |
|---|---|---|
| 방향 | DOM → State (단방향) | 양방향 |
| 선언 위치 | 폼 `name` 속성 | `UILayout.columns` |
| 초기값 채우기 | 폼 값 → State | State 값 → 폼 (자동) |
| `<template>` 지원 | 없음 | 있음 (그리드 행 복제) |

---

## DomainRenderer → UIComposer

### Before — DomainRenderer

```javascript
import { DomainState, DomainRenderer } from '@2davi/rest-domain-state-manager';

DomainState.use(DomainRenderer);

// State-first 단방향: 배열 데이터로 DOM 생성
const roles = await api.get('/api/roles');
roles.renderTo('#roleSelect', {
    type:        'select',
    valueField:  'roleId',
    labelField:  'roleName',
    placeholder: '역할 선택',
    class:       'form-select',
});
// DOM이 생성되지만 이후 변경은 DomainState에 반영되지 않음 (단방향)
```

### After — UIComposer (sourceKey 방식)

```javascript
import {
    DomainState, DomainCollection, UIComposer, UILayout
} from '@2davi/rest-domain-state-manager';

DomainState.use(UIComposer);

// 역할 목록을 DomainCollection으로 수신
const roleCollection = DomainCollection.fromJSONArray(
    await fetch('/api/roles').then(r => r.text()), api
);

// UILayout columns에 sourceKey로 선언
class UserFormLayout extends UILayout {
    static columns = {
        name: { selector: '[name="name"]' },
        role: {
            selector:         '[name="role"]',    // <select> 요소
            sourceKey:        'roles',             // bind() 시 주입
            sourceValueField: 'roleId',
            sourceLabelField: 'roleName',
        },
    };
}

// bind() 시 sources로 주입 → <select> 옵션 자동 채움 + 양방향 바인딩
const user = await api.get('/api/users/1');
user.bindSingle('#userForm', {
    layout:  UserFormLayout,
    sources: { roles: roleCollection },
});
```

### 주요 차이점

| 항목 | DomainRenderer | UIComposer (sourceKey) |
|---|---|---|
| 방향 | State → DOM (단방향) | 양방향 |
| 선택 이벤트 반영 | 없음 | `<select>` 변경 즉시 `state.data` 갱신 |
| 사용 방식 | `renderTo()` 직접 호출 | `UILayout.columns.sourceKey` 선언 |

---

## 전환 체크리스트

- [ ] `DomainState.use(FormBinder)` → `DomainState.use(UIComposer)`로 교체
- [ ] 폼별 `UILayout` 서브클래스 선언 (`columns` 매핑)
- [ ] `DomainState.fromForm()` → `state.bindSingle()` 또는 `collection.bind()`로 교체
- [ ] `roles.renderTo()` → `UILayout.columns.sourceKey` + `bind({ sources })` 방식으로 교체
- [ ] `bindSingle()` 반환값 `{ unbind }` — 컴포넌트 언마운트 시 호출 등록
- [ ] deprecated 경고 콘솔에서 사라지는지 확인

---

## 문의

전환 중 막히는 부분이 있으면 [GitHub Issues](https://github.com/2davi/rest-domain-state-manager/issues)에 남겨주세요.
