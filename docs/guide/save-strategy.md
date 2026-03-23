# save() 분기 전략

<span class="badge badge-stable">Stable</span>

이 라이브러리의 핵심 가치를 가장 직접적으로 보여주는 메서드입니다. 개발자는 "어떤 HTTP 메서드를 써야 하는가"를 고민할 필요 없이 `save()` 하나만 호출하면 됩니다. 내부적으로 수집된 변경 이력과 상태 플래그를 분석하여 RFC 7230 HTTP 메서드 의미론을 완벽하게 준수하는 요청을 자동으로 구성합니다.

## HTTP 메서드 자동 분기 알고리즘

`save()`는 두 개의 내부 상태를 기준으로 HTTP 메서드를 결정합니다.

**`_isNew` 플래그** — 이 인스턴스가 서버에 아직 존재하지 않는 신규 리소스인지 나타냅니다. `fromVO()` 또는 `fromForm()` 으로 생성하면 `true`, `fromJSON()` 또는 `api.get()` 으로 조회하면 `false`로 설정됩니다.

**`_dirtyFields` 집합** — Proxy 트랩이 변경을 감지할 때마다 변경된 최상위 키를 `Set<string>` 에 기록합니다. `name` 과 `address.city` 를 수정하면 `Set { 'name', 'address' }` 가 됩니다.

```text
save() 진입
 │
 ├─ _isNew === true
 │    └─ POST  (전체 객체 직렬화, 신규 리소스 생성)
 │
 └─ _isNew === false
      │
      ├─ dirtyFields.size === 0
      │    └─ PUT  (변경 없는 의도적 재저장 — 멱등성 보장)
      │
      ├─ dirtyRatio = dirtyFields.size / totalFields
      │
      ├─ dirtyRatio >= 0.7 (DIRTY_THRESHOLD)
      │    └─ PUT  (70% 이상 변경 — 전체 교체가 더 효율적)
      │
      └─ dirtyRatio < 0.7
           └─ PATCH  (RFC 6902 JSON Patch 배열로 변경분만 전송)
```

### DIRTY_THRESHOLD = 0.7 의 근거

PATCH 방식은 변경된 필드만 전송하여 페이로드 크기를 줄이는 장점이 있습니다. 그러나 필드의 70% 이상이 변경된 경우에는 JSON Patch 배열 자체의 오버헤드가 커져 전체 객체를 한 번에 보내는 PUT이 더 효율적입니다. 이 임계값은 `src/constants/dirty.const.js` 에 `DIRTY_THRESHOLD = 0.7` 로 선언되어 있으며 필요 시 수정 가능합니다.

## PATCH 페이로드 — RFC 6902 JSON Patch

PATCH 분기를 탈 때 전송되는 페이로드는 [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) 표준을 따릅니다. `changeLog` 배열에 누적된 변경 이력이 그대로 직렬화됩니다.

```javascript
// 사용자가 name과 address.city를 수정한 경우
user.data.name          = 'Davi'
user.data.address.city  = 'Seoul'

// PATCH 전송 시 실제 페이로드
[
    { "op": "replace", "path": "/name",          "value": "Davi"  },
    { "op": "replace", "path": "/address/city",  "value": "Seoul" }
]
```

중첩 객체의 경로는 JSON Pointer(RFC 6901) 표기법을 따르며 `/` 구분자를 사용합니다.

## Optimistic Update와 자동 롤백

`save()` 는 낙관적 업데이트(Optimistic Update) 패턴을 내장하고 있습니다. HTTP 요청이 실패(`4xx` / `5xx` / 네트워크 오류)하면 `domainObject`, `changeLog`, `dirtyFields`, `_isNew` 네 개의 상태를 `save()` 호출 이전 시점으로 자동 복원한 뒤 에러를 re-throw합니다. 이로 인해 서버와 클라이언트 상태의 불일치가 발생하지 않습니다.

```javascript
try {
    await user.save('/api/users/1')
} catch (err) {
    // 이 시점에 user.data는 save() 호출 이전 상태로 이미 복원되어 있습니다.
    // err.status로 HTTP 상태 코드를 확인하고 재시도할 수 있습니다.
    console.error('저장 실패:', err.status, err.statusText)
}
```

재시도도 안전합니다. 롤백 후 `changeLog` 와 `dirtyFields` 가 복원되어 있으므로 `save()` 를 다시 호출하면 동일한 분기로 동일한 페이로드를 전송합니다.

## 성공 후 처리

저장이 성공하면 `changeLog` 와 `dirtyFields` 가 자동으로 초기화됩니다. POST 성공 시에는 `_isNew` 가 `false` 로 전환되어, 이후 같은 인스턴스에서 `save()` 를 호출하면 PUT 또는 PATCH로 분기됩니다.

```javascript
const newUser = DomainState.fromVO(new UserVO(), api)
// isNew: true

await newUser.save('/api/users')
// → POST 전송

// POST 성공 후:
// isNew: false, changeLog: [], dirtyFields: Set {}

newUser.data.name = 'Updated'
await newUser.save('/api/users/user_001')
// → PATCH 전송 (1개 필드 변경, dirtyRatio < 0.7)
```

## 인터랙티브 시연

`address.city`를 수정해도 dirtyFields에 `address`가 등록되는 것을 확인하세요. PUT/PATCH 분기 예측의 변화를 확인할 수 있습니다.

<PlaygroundDirtyFields />

아래 Playground에서 직접 필드를 수정하고 `save()` 를 실행해보세요. 수정된 필드 수에 따라 어떤 HTTP 메서드가 선택되는지, RFC 6902 페이로드가 어떻게 구성되는지 실시간으로 확인할 수 있습니다.

<PlaygroundHttpMethod />

::: tip 테스트 시나리오

- **POST**: '신규 생성' 모드로 전환 후 save()
- **PUT (변경 없음)**: 아무 것도 수정하지 않고 save()
- **PUT (대량 변경)**: 5개 필드 중 4개 이상 수정 후 save()
- **PATCH**: 5개 필드 중 1~2개만 수정 후 save()
:::

## 롤백 시연

`save()` 가 실패했을 때 `domainObject` 가 어떻게 자동 복원되는지 직접 확인해보세요. '실패로 저장'을 클릭하면 HTTP 409를 시뮬레이션하고, '성공으로 저장'을 클릭하면 성공 흐름을 확인할 수 있습니다.

<PlaygroundRollback />
