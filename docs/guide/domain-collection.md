# DomainCollection

<span class="badge badge-new">v1.3.0</span>

`DomainCollection`은 N개의 `DomainState` 인스턴스를 담는 1:N 배열 상태 컨테이너입니다.  
`DomainState`가 단일 DTO를 다루듯, `DomainCollection`은 DTO 배열 전체를 관리합니다.

---

## 언제 사용하나요?

| 시나리오 | 적합한 클래스 |
|---|---|
| 단일 사용자 정보 수정 | `DomainState` |
| 사용자의 자격증 목록 전체 저장 | `DomainCollection` |
| 주문의 주문상품 목록 일괄 처리 | `DomainCollection` |

---

## 팩토리 메서드

### `DomainCollection.create()` — 빈 컬렉션

신규 배열을 생성할 때 사용합니다. `saveAll()` 시 POST를 전송합니다.

```javascript
import { ApiHandler, DomainCollection } from '@2davi/rest-domain-state-manager';

const api   = new ApiHandler({ host: 'localhost:8080' });
const certs = DomainCollection.create(api);

certs.add({ certName: '정보처리기사', certType: 'IT' });
certs.add({ certName: '한국사',       certType: 'HISTORY' });

await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
// → POST /api/certificates
// → body: [{ certName: '정보처리기사', ... }, { certName: '한국사', ... }]
```

### `DomainCollection.fromJSONArray()` — GET 응답 수신

서버에서 배열을 받아 수정 후 저장할 때 사용합니다. `saveAll()` 시 PUT을 전송합니다.

```javascript
const certs = DomainCollection.fromJSONArray(
    await fetch('/api/certificates').then(r => r.text()),
    api
);

// 항목 추가 후 전체 배열 교체
certs.add({ certName: '신규자격증' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
// → PUT /api/certificates (기존 배열 전체 교체)
```

---

## 핵심 메서드

### `add(initialData?)` — 항목 추가

```javascript
const state = certs.add({ certName: '정보처리기사' });
// 반환된 DomainState로 개별 항목에 접근 가능
state.data.certType = 'IT';

console.log(certs.getCount()); // +1
```

### `remove(indexOrState)` — 항목 제거

인덱스 또는 `DomainState` 인스턴스로 제거합니다.

```javascript
// 인덱스로 제거
certs.remove(0);

// 인스턴스로 제거
const target = certs.getItems()[0];
certs.remove(target);
```

::: warning 복수 항목 제거 시 반드시 내림차순으로
정방향으로 제거하면 인덱스가 밀려 의도와 다른 항목이 삭제됩니다.

```javascript
// ❌ 정방향 — 인덱스 밀림 버그
[0, 2].forEach(i => certs.remove(i));

// ✅ 내림차순 — 올바른 제거
[2, 0].forEach(i => certs.remove(i));
```

`UIComposer`의 `removeChecked()`는 이 순서를 자동으로 보장합니다.
:::

### `toJSON()` — 직렬화

현재 배열의 순수 객체 배열을 반환합니다.

```javascript
const payload = certs.toJSON();
// [{ certId: 1, certName: '정보처리기사', ... }, ...]
```

---

## saveAll() — 배열 전체 저장

### `'batch'` 전략

배열 전체를 단일 HTTP 요청으로 전송합니다.  
SI 레거시 환경에서 DELETE ALL + INSERT 또는 MERGE 방식 백엔드와 호환됩니다.

```javascript
await certs.saveAll({
    strategy: 'batch',
    path:     '/api/certificates',
});
```

| 상태 | HTTP 메서드 |
|---|---|
| `create()`로 생성 | POST |
| `fromJSONArray()`로 생성 | PUT |

### 실패 롤백

`saveAll()` 실패 시 각 `DomainState` 항목이 진입 이전 상태로 자동 복원됩니다.  
사용자가 입력한 값은 유지되며, 내부 추적 상태(`changeLog`, `dirtyFields`)만 복원됩니다.

```javascript
try {
    await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
} catch (err) {
    // 각 항목의 내부 상태가 saveAll() 진입 이전으로 자동 복원됨
    // 사용자 입력값(data)은 그대로 유지됨 → 즉시 재시도 가능
    console.error('저장 실패:', err.status);
}
```

<PlaygroundCollection />

---

## lazy 추적 모드

`fromJSONArray()` 호출 시 `trackingMode: 'lazy'`를 지정하면 `saveAll()` 시점에 초기 스냅샷과 diff 연산으로 변경분을 계산합니다.

```javascript
const certs = DomainCollection.fromJSONArray(jsonText, api, {
    trackingMode: 'lazy',
    itemKey:      'certId',  // LCS diff 기준 필드
});

// 항목 수정, 추가, 삭제 후
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
// saveAll() 시점에 _initialSnapshot과 현재 상태를 비교
```

자세한 내용은 [추적 모드 비교](/guide/tracking-modes)를 참고하세요.

---

## 다음 단계

- [UIComposer & UILayout](/guide/ui-composer) — `DomainCollection`을 그리드 DOM에 바인딩
- [추적 모드 비교](/guide/tracking-modes) — `realtime` vs `lazy` 선택 기준
- [SI 빠른 시작](/guide/si-quickstart) — 전체 JSP 그리드 예제
