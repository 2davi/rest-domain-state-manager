# GET → 변경 → 저장

DSM의 가장 기본적인 데이터 흐름입니다. 화면에 떠 있는 동안 단 하나의 `DomainState` 인스턴스가 해당 리소스의 **단일 진실 공급원(Single Source of Truth)**이 됩니다.

## 1. 데이터 조회 및 변경

`api.get()`으로 데이터를 가져오면, 응답 JSON이 내부적으로 `Proxy` 객체로 래핑됩니다. 외부에서는 오직 `.data` 프로퍼티를 통해서만 이 Proxy에 접근할 수 있습니다.

```javascript
const user = await api.get('/api/users/user_001');

// 💡 값 읽기
console.log(user.data.name);

// ✍️ 값 쓰기 (Proxy가 변경 이력을 자동 수집)
user.data.name = 'Davi';
user.data.address.city = 'Seoul'; // 중첩 객체도 완벽 추적
```

## 2. 데이터 저장 및 삭제

모든 변경이 끝난 후, `save()` 메서드 하나만 호출하면 됩니다.

```javascript
// 변경된 데이터만 서버로 전송 (자동 PATCH 분기)
await user.save('/api/users/user_001');

// 데이터 삭제 시
await user.remove('/api/users/user_001');
```

> **Note:** 여러 API를 한 번에 조회하고 처리해야 한다면 `DomainState.all()`을 이용한 [파이프라인 구축](/guide/plugins)을 참고하세요.