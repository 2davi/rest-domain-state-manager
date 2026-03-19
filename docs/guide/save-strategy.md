# save() 분기 전략 ⭐️

이 라이브러리의 핵심 철학 중 하나인 **Locality of Behavior**를 가장 잘 보여주는 부분입니다. 개발자는 "어떻게 보낼지" 고민할 필요 없이 `save()`만 호출하면 됩니다.

## 스마트 HTTP 메서드 라우팅

`save()`는 내부적으로 `isNew` 플래그와 누적된 `changeLog`의 길이를 평가하여 최적의 HTTP 메서드를 쏘아줍니다.

```text
1. 신규 데이터 (isNew === true)
   👉 무조건 POST 전송 (전체 데이터 직렬화)

2. 기존 데이터 (isNew === false)
   ├─ 변경 이력이 있음 (changeLog.length > 0)
   │   👉 PATCH 전송 (RFC 6902 JSON Patch 포맷으로 변경된 필드만 전송)
   │
   └─ 변경 이력이 없음 (changeLog.length === 0)
       👉 PUT 전송 (전체 데이터 직렬화로 멱등성 보장)
```

## 변경 로그(changeLog)의 구조

내부적으로 수집되는 `changeLog`는 RFC 6902 표준과 호환되는 형태를 가집니다. `api-mapper` 레이어에서 이를 서버 규격에 맞게 변환하여 전송합니다.

```javascript
// 내부 changeLog 배열 구조 예시
[
  { "op": "replace", "path": "/address/city", "value": "Seoul" },
  { "op": "add",     "path": "/phone",        "value": "010-0000-0000" }
]
```

전송이 성공(Response 2xx)하면 내부 `changeLog`는 자동으로 초기화되어 다음 변경을 추적할 준비를 마칩니다.