# 추적 모드 — realtime vs lazy

<span class="badge badge-new">v1.2.0</span>

`DomainState`와 `DomainCollection`은 두 가지 변경 추적 모드를 지원합니다.  
화면의 특성에 따라 적합한 모드를 선택하면 불필요한 changeLog 기록을 줄일 수 있습니다.

---

## 두 모드 비교

| 항목 | `realtime` (기본) | `lazy` |
|---|---|---|
| changeLog 기록 시점 | `data.field = value` 즉시 | `save()` / `saveAll()` 호출 시 |
| 중간 편집 이력 | 모두 기록 | 없음 |
| diff 연산 | 없음 | `save()` 시점에 `_initialSnapshot`과 비교 |
| 메모리 사용 | changeLog 누적 | changeLog 없음 (스냅샷 1개) |
| 적합한 화면 | 실시간 유효성 검사, 단계별 저장 | 대규모 그리드, 최종 제출 중심 화면 |

---

## realtime 모드 (기본)

`data` Proxy를 통한 모든 변경이 즉시 `changeLog`에 기록됩니다.  
`trackingMode`를 지정하지 않으면 이 모드가 적용됩니다.

```javascript
const user = await api.get('/api/users/1');
// 기본값: trackingMode: 'realtime'

user.data.name = 'A';   // changeLog: [{ op: 'replace', path: '/name', value: 'A' }]
user.data.name = 'B';   // changeLog: [{ op: 'replace', path: '/name', value: 'B' }]
user.data.name = 'Davi'; // changeLog: [{ op: 'replace', path: '/name', value: 'Davi' }]

await user.save('/api/users/1');
// PATCH body: 최종 상태 기반으로 toPatch() 직렬화
```

### 언제 적합한가

- 입력 중 실시간 유효성 표시가 필요한 폼
- 단계별 중간 저장이 있는 화면
- changeLog를 직접 참조하는 로직이 있는 경우

---

## lazy 모드

`save()` / `saveAll()` 호출 시점에 `_initialSnapshot`과 현재 상태를 비교하여 변경분을 한 번에 계산합니다.  
중간 편집 이력이 기록되지 않으므로 메모리 사용이 적고 최종 변경분만 서버에 전송됩니다.

```javascript
const user = await api.get('/api/users/1', { trackingMode: 'lazy' });

user.data.name = 'A';    // changeLog: [] (기록 없음)
user.data.name = 'B';    // changeLog: [] (기록 없음)
user.data.name = 'Davi'; // changeLog: [] (기록 없음)

await user.save('/api/users/1');
// save() 시점에 { name: 'Davi' } vs _initialSnapshot 비교
// PATCH body: [{ op: 'replace', path: '/name', value: 'Davi' }]
// 중간에 'A', 'B'로 변경된 이력 없음
```

### DomainCollection에서 lazy 모드

```javascript
const certs = DomainCollection.fromJSONArray(jsonText, api, {
    trackingMode: 'lazy',
    itemKey:      'certId',  // LCS diff 기준 필드 — 항목 이동/추가/삭제 정확도 향상
});

// 행 추가, 데이터 수정, 행 삭제 후
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
// saveAll() 시점에 _initialSnapshot 배열과 현재 배열 전체 비교
```

::: tip itemKey 없이도 동작합니다
`itemKey`를 지정하지 않으면 위치(positional) 기반으로 비교합니다.  
배열 항목의 고유 식별자 필드가 있다면 `itemKey`를 지정하는 것이 더 정확한 diff를 생성합니다.
:::

### 언제 적합한가

- 대규모 그리드에서 행이 많고 편집 횟수가 많은 경우
- 최종 제출 중심 화면 (중간 저장 없음)
- 동일 필드를 여러 번 수정하는 패턴이 많은 경우

---

## 롤백 시 동작

두 모드 모두 `save()` 실패 시 롤백 동작은 동일합니다.

- 내부 추적 상태(`changeLog`, `dirtyFields`, `isNew`)가 `save()` 진입 직전으로 복원됩니다.
- **사용자가 입력한 도메인 데이터(`data`)는 복원되지 않습니다.** 사용자 입력값을 유지하여 즉시 재시도할 수 있도록 설계되었습니다.
- `lazy` 모드에서는 `_initialSnapshot`이 복원되지 않습니다. 다음 `save()` 시도에서 동일한 diff 기준점으로 재계산됩니다.

---

## 선택 가이드

```
화면에 실시간 유효성 표시가 필요한가?
    → YES: realtime (기본)
    → NO: ↓

중간 저장이 있는가?
    → YES: realtime
    → NO: ↓

대규모 그리드 또는 동일 필드 반복 수정이 많은가?
    → YES: lazy
    → NO: realtime (기본 유지)
```

---

## 다음 단계

- [DomainCollection 가이드](/guide/domain-collection) — `fromJSONArray` lazy 모드 상세
- [save() 분기 전략](/guide/save-strategy) — POST/PUT/PATCH 자동 선택 알고리즘
