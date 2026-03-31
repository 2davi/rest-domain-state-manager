# 철학과 가치관

이 라이브러리를 관통하는 설계 철학을 기록합니다.

---

## 왜 이것을 만들었는가

MyBatis 기반의 레거시 SI/SM 환경에서 반복적으로 목격되는 패턴이 있습니다.

```javascript
// 어디서나 볼 수 있는 코드
const name    = document.getElementById('name').value
const email   = document.getElementById('email').value
const city    = document.getElementById('city').value
const zipCode = document.getElementById('zipCode').value
// ... 20줄 더

const method = isNew ? 'POST' : 'PUT'
await fetch('/api/users/1', {
    method,
    body: JSON.stringify({ name, email, city, zipCode, /* ... */ }),
})
```

이 코드의 문제는 단순히 길다는 것이 아닙니다. 문제는 **어디서 무슨 일이 일어나는지 코드를 읽지 않으면 알 수 없다**는 것입니다. `POST`인지 `PUT`인지, 페이로드가 완전한지, 어떤 필드가 실제로 변경됐는지 — 모두 개발자가 매번 직접 계산해야 합니다. 그리고 이 계산은 반드시 실수를 동반합니다.

이 라이브러리는 그 반복적인 실수와 고민을 **한 번에 해결하자**는 목표로 만들어졌습니다.

---

## Locality of Behavior

이 라이브러리의 핵심 설계 원칙입니다.

"함수는 한 가지 일만 해야 한다"는 원칙은 중요합니다. 그러나 그것이 항상 **잘 읽히는 코드**를 의미하지는 않습니다. 5줄짜리 함수 10개보다 잘 읽히는 50줄짜리 함수 하나가 더 나을 때가 있습니다. 동작이 한 곳에 응집되어 있으면, 코드를 읽는 사람이 흐름을 추적하기 위해 파일을 넘나들 필요가 없습니다.

`save()` 메서드가 그 예입니다.

```javascript
await user.save('/api/users/1')
```

이 한 줄 뒤에서 무슨 일이 일어나는지 **코드를 보지 않아도 예측할 수 있어야 합니다.** 변경이 있으면 PATCH, 변경이 많으면 PUT, 신규이면 POST. 실패하면 롤백. 이 동작이 직관적으로 예측 가능한 한 곳에 응집되어 있어야 한다 — 이것이 Locality of Behavior입니다.

---

## 단일 진실 공급원 (Single Source of Truth)

화면이 떠 있는 동안 하나의 `DomainState` 인스턴스가 해당 리소스의 **유일한 진실**을 담습니다.

DOM 요소에서 값을 직접 읽는 행위, form에서 별도로 데이터를 수집하는 행위, 로컬 변수에 복사본을 만드는 행위 — 이 모든 것이 상태 분열을 만들고 불일치 버그의 원인이 됩니다. DSM은 모든 변경이 오직 `domainState.data` Proxy를 통해서만 이루어지도록 강제하고, 그 Proxy가 유일한 진실로서 기능하도록 설계되었습니다.

---

## 라이브러리의 정체성

이 라이브러리는 **HTTP 클라이언트가 아닙니다.** `fetch()` 를 내부적으로 사용하지만, 핵심 가치는 "어떻게 보내는가"가 아니라 **"무엇이 바뀌었는가를 추적하고, 저장 시점에 올바른 방식으로 동기화하는가"** 에 있습니다.

이것은 프런트엔드 UI 프레임워크(React, Vue)를 대체하려는 것도 아닙니다. DSM은 **백엔드와 통신하는 데이터 계층(Data Layer)** 에서 동작하며, UI 프레임워크와 독립적으로 기능합니다. Framework-Agnostic 설계이므로 React, Vue, 또는 순수 Vanilla JavaScript 환경 어디서든 사용할 수 있습니다.

---

## 무거움을 피하다

좋은 라이브러리는 사용자의 코드에 조용히 녹아들어야 합니다. 그래서 이 라이브러리는:

- **의존성이 없습니다.** `package.json` 의 `dependencies` 가 비어 있습니다. 사용자의 번들에 제3자 코드가 딸려 들어오지 않습니다.
- **Tree-shaking을 허용합니다.** `"sideEffects": false` 를 선언했습니다. 사용하지 않는 코드는 번들러가 제거합니다.
- **Core와 Plugin이 분리됩니다.** `FormBinder`, `DomainRenderer` 는 선택적 플러그인입니다. DOM이 없는 Node.js 환경에서도 코어 기능은 완전히 동작합니다.
- **글로벌 상태를 오염시키지 않습니다.** 인스턴스 간 공유 상태가 없으며, 같은 페이지에서 여러 인스턴스를 독립적으로 운용할 수 있습니다.

---

## Edge Case를 틀어막는다

라이브러리의 신뢰도는 **평범한 경우**가 아니라 **극단적인 경우**에서 결정됩니다.

이 라이브러리는 다음 엣지 케이스를 명시적으로 처리합니다:

- 배열 루트 객체 (`domainObject` 자체가 배열인 경우)
- 중첩 객체의 깊은 변경 추적
- `sort()`, `reverse()` 등 배열 전체를 변경하는 메서드
- HTTP 요청 실패 시 4개 상태의 일관된 롤백
- `BroadcastChannel` 미지원 환경에서의 graceful degradation
- Node.js / Vitest 테스트 환경에서 `window` 참조 없이 안전한 import

완벽한 동작이 보장되지 않는다면 개발자가 그것을 믿고 사용할 수 없습니다.
