---
layout: home
hero:
  name: "DSM"
  text: "REST 도메인 상태 관리자"
  tagline: "백엔드 DTO를 Proxy로 래핑하여 변경을 추적하고, save() 하나로 올바른 HTTP 메서드를 자동 결정합니다. MyBatis · JSP · 레거시 환경을 위한 데이터 계층 솔루션."
  actions:
    - theme: brand
      text: 빠른 시작 →
      link: /guide/installation
    - theme: alt
      text: API 레퍼런스
      link: /api/domain.DomainState.Class.DomainState
    - theme: alt
      text: 철학 읽기
      link: /philosophy

features:
  - icon: 🔍
    title: 자동 변경 추적
    details: JS Proxy가 모든 필드 변경을 감지합니다. 중첩 객체와 배열 변이(push, splice, sort)까지 RFC 6902 형식으로 자동 기록됩니다.

  - icon: ⚡
    title: 스마트 HTTP 분기
    details: save() 호출 시 isNew 플래그와 dirtyFields 비율을 분석하여 POST / PUT / PATCH 를 자동 선택합니다. HTTP 메서드 결정 로직을 다시는 직접 작성하지 않아도 됩니다.

  - icon: 🛡️
    title: Optimistic Update 롤백
    details: HTTP 요청이 실패하면 domainObject, changeLog, dirtyFields, isNew 네 개의 상태를 save() 호출 이전으로 자동 복원합니다.

  - icon: 🧩
    title: Framework-Agnostic
    details: React, Vue, 또는 순수 Vanilla JavaScript 어디서든 동작합니다. DOM 의존성은 선택적 플러그인으로 분리되어 있어 Node.js 환경에서도 코어 기능이 완전히 동작합니다.

  - icon: 🔬
    title: V8 최적화
    details: WeakMap 기반 Lazy-Proxying, Reflect API 전면 도입, 배열 Delta 계산 알고리즘으로 Hidden Class 오염 없이 V8 JIT 최적화를 유지합니다.

  - icon: 📡
    title: 내장 디버거
    details: BroadcastChannel API를 이용한 멀티탭 디버그 팝업을 제공합니다. Heartbeat GC로 탭 생명주기를 추적하고 실시간으로 상태 변화를 시각화합니다.
---

<br>

## 문제

```javascript
// ❌ 레거시 환경에서 반복되는 보일러플레이트
const name    = document.getElementById('name').value
const city    = document.getElementById('city').value
// ... 필드 수만큼 반복

const method = isNew ? 'POST' : hasChanges ? 'PATCH' : 'PUT'
const body   = method === 'PATCH' ? buildPatchPayload() : JSON.stringify(allFields)
await fetch('/api/users/1', { method, body })
// 이 계산이 매번 정확하다고 보장할 수 있습니까?
```

## 해결

```javascript
// ✅ DSM: 변경 추적과 HTTP 분기를 한 번에 위임
import { ApiHandler, DomainState } from '@2davi/rest-domain-state-manager'

const api  = new ApiHandler({ host: 'localhost:8080' })
const user = await api.get('/api/users/1')  // isNew: false

// 폼 수정 → Proxy가 자동으로 변경 이력 수집
user.data.name         = formEl.name.value
user.data.address.city = formEl.city.value

// save() 하나로 끝. POST / PUT / PATCH는 자동 결정됩니다.
await user.save('/api/users/1')
```
