# ⚡️ rest-domain-state-manager (DSM)

> REST API 응답 데이터를 Proxy로 감싸 변경을 자동 추적하고,
> 저장 시점에 최적의 HTTP 메서드(POST / PUT / PATCH)로 자동 분기하는
> 순수 ES Module 기반 도메인 상태 관리 라이브러리.

![No Bundler](https://img.shields.io/badge/bundler-not_required-success) 
![No Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-Supported-blue)

---

## 💡 아직도 폼 데이터를 일일이 긁어모으십니까?

SI 프로젝트나 레거시 JSP 환경에서, 폼 요소를 `getElementById`로 일일이 찾아 JSON을 조립하는 코드는 이제 그만 작성하세요. **DSM**은 폼 바인딩과 REST API 동기화를 단 한 줄로 끝냅니다.

### Before: 지옥의 수동 조립
```javascript
const payload = {
  name: document.getElementById('name').value,
  city: document.getElementById('city').value,
  role: document.getElementById('role').value,
  // 필드가 50개면 50줄 작성...
};
await fetch('/api/users/1', { method: 'PUT', body: JSON.stringify(payload) });
```

### After (DSM): 완벽한 자동화
```javascript
// 1. 폼 바인딩 및 변경 추적 시작
const user = DomainState.fromForm('userForm', api);

// 2. 사용자가 폼을 수정하면 Proxy가 알아서 변경분을 수집합니다.
// 3. 저장 시점에 최적의 HTTP 메서드로 자동 전송!
await user.save('/api/users/1'); 

// 🎯 변경된 필드만 있으면 → PATCH (RFC 6902)
// 🎯 변경이 없으면 → PUT (멱등성 보장)
// 🎯 신규 데이터면 → POST
```

## 🌟 주요 특징

1. **단일 진실 공급원 (Single Source of Truth):** Proxy가 모든 변경 이력을 changeLog에 자동 수집합니다.

2. **V8 엔진 최적화:** 무분별한 Proxy 생성을 막는 WeakMap 기반의 Lazy-Proxying과, Reflect API를 도입해 V8의 인라인 캐싱(IC)을 파괴하지 않는 극강의 퍼포먼스를 자랑합니다.

3. **플러그형 아키텍처:** DOM 제어 로직(DomainRenderer, FormBinder)을 코어 엔진에서 완전히 분리하여, Node.js 백엔드에서도 사용할 수 있는 Transport-Agnostic 설계를 구현했습니다.

4. **실시간 디버그 채널:** BroadcastChannel 기반의 무설정 디버그 팝업을 제공하여, 다중 탭 환경에서도 실시간으로 데이터 변경(Delta)과 에러를 추적합니다.

## 📚 공식 문서 (Documentation)
자세한 설치 가이드, V8 메모리 최적화 아키텍처, TypeDoc 기반의 API 레퍼런스는 아래 공식 문서 허브에서 확인하세요.

👉 DSM 공식 문서 (2davi Lab Hub) 가기(https://www.google.com/search?q=https://lab.the2davi.dev/rest-domain-state-manager/)
