---
layout: home
hero:
  name: "DSM"
  text: "REST 도메인 상태 관리자"
  tagline: "레거시 SI/SM 환경을 위한 가장 직관적이고 강력한 상태 관리 솔루션"
  actions:
    - theme: brand
      text: 🚀 30초 만에 시작하기
      link: /guide/getting-started
    - theme: alt
      text: 📚 API 레퍼런스
      link: /api/
features:
  - title: "단 한 줄로 끝내는 폼 바인딩"
    details: "getElementById() 노가다는 이제 그만. Form 요소와 Proxy 객체를 단 한 줄로 연결하고 양방향 변경을 완벽하게 추적합니다."
  - title: "V8 엔진 최적화 (Lazy-Proxying)"
    details: "무분별한 객체 생성을 막는 WeakMap 기반의 지연 프록싱(Lazy-Proxying)으로 극강의 렌더링 퍼포먼스를 제공합니다."
  - title: "스마트한 HTTP 분기"
    details: "저장(save) 시점에 변경된 데이터(Delta)만 추려내어 POST, PUT, PATCH(RFC 6902) 중 최적의 메서드를 자동으로 쏘아줍니다."
---

<br>

## ⚡️ 왜 DSM을 써야 할까요?

MyBatis와 JSP를 쓰는 레거시 환경에서, 폼 데이터를 긁어모으느라 고통받고 계십니까?

### ❌ Before: 지옥의 수동 조립
```javascript
const payload = {
  name: document.getElementById('name').value,
  city: document.getElementById('city').value,
  role: document.getElementById('role').value,
  // 필드가 50개면 50줄 작성...
};
await fetch('/api/users/1', { method: 'PUT', body: JSON.stringify(payload) });
```

### ✅ After (DSM): 완벽한 자동화
```javascript
// 1. 폼 바인딩 및 변경 추적 시작 (점 표기법으로 중첩 데이터도 완벽 지원)
const user = DomainState.fromForm('userForm', api);

// 2. 사용자가 폼을 수정하면 Proxy가 알아서 변경분을 수집합니다.
// 3. 저장 시점에 최적의 HTTP 메서드로 자동 전송!
await user.save('/api/users/1'); 
```