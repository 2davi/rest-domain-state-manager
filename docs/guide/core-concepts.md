# 핵심 개념과 철학 (Core Concepts)

DSM을 관통하는 4가지 핵심 설계 철학입니다.

## 1. 라이브러리 정체성

이 라이브러리는 **HTTP 클라이언트가 아닙니다**. `fetch()`를 내부적으로 사용하지만, 핵심 가치는 "어떻게 보내는가"가 아니라 **"무엇이 바뀌었는가를 추적하고, 저장 시점에 올바른 방식으로 동기화하는가"**에 있습니다.

## 2. 단일 진실 공급원 (Single Source of Truth)

화면이 떠 있는 동안 하나의 `DomainState` 인스턴스가 해당 리소스의 **유일한 진실**을 담습니다. DOM 요소, form 입력, 코드 내 직접 대입 등 모든 변경은 오직 `domainState.data`(Proxy)를 통해서만 이루어집니다.

```javascript
// ❌ 안티패턴 — DOM에서 직접 읽어 별도 객체 구성
const payload = {
  name: document.getElementById('name').value,
};

// ✅ 올바른 패턴 — Proxy 하나가 모든 변경을 수집
const user = DomainState.fromForm('userForm', api);
await user.save('/api/users/1');
```

## 3. isNew 플래그의 상태 전이

`isNew`는 이 인스턴스가 서버에 아직 존재하지 않는 신규 리소스인지를 나타냅니다. 팩토리 메서드 호출 시점에 결정되며, POST 성공 후 자동으로 `false`로 전환되어 하나의 인스턴스를 계속 재사용할 수 있게 합니다.

## 4. Locality of Behavior (응집된 동작)

DSM은 **Locality of Behavior**를 중요한 설계 원칙으로 삼습니다.
"함수는 한 가지 일만 해야 한다"는 강박보다, **잘 읽히는 한 곳에서 흐름 전체를 파악할 수 있는 구조**를 우선합니다.

```javascript
// 💡 "save() 한 줄 뒤에서 무슨 일이 일어나는지 코드를 보지 않아도 예측할 수 있어야 한다"
await user.save('/api/users/1');

// isNew가 false이고 changeLog가 있으면 → PATCH
// isNew가 false이고 changeLog가 없으면 → PUT
// isNew가 true이면 → POST
// 예측 가능한 한 가지 인터페이스, 세 가지 동작.
```
