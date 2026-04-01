# domain/DomainCollection

DomainCollection — 1:N 배열 상태 관리 컨테이너

`DomainState`가 단일 DTO 객체를 다루는 것처럼,
`DomainCollection`은 **N개의 `DomainState` 인스턴스**를 담는 컨테이너다.

## Java 유추
```
DomainState       ≈ Map<K,V>        (단일 DTO 객체)
DomainCollection  ≈ List<DomainState> (DomainState 배열)
```

## 설계 원칙

### UI 독립성
`DomainCollection`은 UI와 완전히 독립된 순수 상태 레이어다.
`UIComposer` 없이도 `saveAll({ strategy: 'batch', path })` 단독 사용이 가능하다.

### 단방향 의존성
`DomainCollection → DomainState` 단방향.
`DomainState`는 `DomainCollection`을 알지 못한다.

### Nested Array 선언 방식 — 런타임 연결
`DomainVO.static fields`에 배열 기본값(`default: []`)만 선언한다.
`UIComposer.bindCollection()` 호출 시점에 런타임으로 해당 필드를 연결한다.
`DomainVO`가 `DomainCollection`을 직접 참조하면 순환 의존성이 재발한다.

## 생성 경로 (팩토리 메서드)

| 팩토리                       | 입력              | `_isNew` | 주 용도                              |
|------------------------------|-------------------|----------|--------------------------------------|
| `DomainCollection.create()`  | 없음              | `true`   | 신규 배열 생성 후 POST               |
| `DomainCollection.fromJSONArray()` | JSON 문자열 | `false`  | GET 응답 배열 수신 후 수정 → PUT     |

## saveAll 전략

| 전략          | 동작                                | 지원 여부         |
|---------------|-------------------------------------|------------------|
| `'batch'`     | 배열 전체를 단일 POST / PUT로 전송  | ✅ v1.3.x MVP    |
| `'sequential'`| 각 DomainState를 순차적으로 save()  | 🔜 v2.x 이후     |
| `'parallel'`  | 각 DomainState를 병렬로 save()      | 🔜 v2.x 이후     |

## See

module:domain/DomainState DomainState

## Examples

```ts
const certs = DomainCollection.create(api);
certs.add({ certName: '정보처리기사', certType: 'IT' });
certs.add({ certName: '한국사', certType: 'HISTORY' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```

```ts
const certs = await DomainCollection.fromJSONArray(
    await fetch('/api/certificates').then(r => r.text()),
    api
);
certs.add({ certName: '신규자격증' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```

## Classes

- [DomainCollection](domain.DomainCollection.Class.DomainCollection.md)

## Interfaces

- [DomainCollectionOptions](domain.DomainCollection.Interface.DomainCollectionOptions.md)
- [SaveAllOptions](domain.DomainCollection.Interface.SaveAllOptions.md)
