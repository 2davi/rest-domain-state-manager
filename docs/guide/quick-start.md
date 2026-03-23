# 5분 빠른 시작

<span class="badge badge-stable">Stable</span>

이 가이드는 `ApiHandler` 생성부터 데이터 조회, 수정, 저장까지 핵심 흐름 전체를 5분 안에 보여줍니다.

## 전제 조건

- `@2davi/rest-domain-state-manager` 설치 완료 ([설치 가이드](/guide/installation) 참고)
- ES Module을 지원하는 환경 (Vite, Next.js, 또는 `<script type="module">`)

---

## Step 1 — ApiHandler 생성

`ApiHandler` 는 HTTP 전송 레이어를 담당합니다. 애플리케이션 초기화 시점에 한 번 생성하고 재사용합니다.

```javascript
import { ApiHandler, DomainState } from '@2davi/rest-domain-state-manager'

const api = new ApiHandler({
    host:     'localhost:8080',
    basePath: '/api',
})
```

개발 환경에서는 `http://`, 운영 환경에서는 `https://` 를 자동으로 선택합니다.

---

## Step 2 — 데이터 조회

`api.get()` 은 응답 JSON을 Proxy로 래핑한 `DomainState` 인스턴스를 반환합니다.

```javascript
// GET /api/users/user_001 → DomainState 인스턴스 반환
const user = await api.get('/users/user_001')

console.log(user.data.name)          // 'Davi'
console.log(user.data.address.city)  // 'Seoul'
console.log(user._isNew)             // false
```

이 시점부터 `user.data` 를 통한 모든 읽기/쓰기가 내부적으로 추적됩니다.

---

## Step 3 — 데이터 수정

`user.data` Proxy에 값을 할당하면 변경 이력이 자동으로 수집됩니다.

```javascript
user.data.name          = 'Davi Lee'
user.data.address.city  = 'Busan'
user.data.phone         = '010-0000-0000'  // 새 필드 추가도 추적됨

// 변경 이력 확인
console.log(user._getChangeLog())
// [
//   { op: 'replace', path: '/name',         oldValue: 'Davi',  newValue: 'Davi Lee' },
//   { op: 'replace', path: '/address/city', oldValue: 'Seoul', newValue: 'Busan'    },
//   { op: 'add',     path: '/phone',                           newValue: '010-...'  }
// ]
```

::: tip 동일값 재할당은 기록되지 않습니다
현재값과 동일한 값을 할당하면 변경 이력에 기록되지 않습니다. 불필요한 네트워크 요청을 방지하기 위한 설계입니다.
:::

---

## Step 4 — 저장

`save()` 는 변경 이력을 분석하여 POST / PUT / PATCH 를 자동 선택합니다.

```javascript
try {
    await user.save('/users/user_001')
    // 성공 — changeLog와 dirtyFields가 자동 초기화됨
} catch (err) {
    // HTTP 오류 발생 시 모든 상태가 save() 이전으로 자동 복원됨
    console.error('저장 실패:', err.status, err.statusText)
}
```

3개 필드가 변경되었고 전체 필드 비율이 70% 미만이므로 이 예제에서는 **PATCH** 가 선택됩니다.

---

## Step 5 — 삭제

```javascript
await user.remove('/users/user_001')
// DELETE /api/users/user_001
```

---

## 전체 흐름 요약

```javascript
import { ApiHandler } from '@2davi/rest-domain-state-manager'

const api  = new ApiHandler({ host: 'localhost:8080', basePath: '/api' })
const user = await api.get('/users/user_001')

user.data.name         = 'Davi Lee'
user.data.address.city = 'Busan'

await user.save('/users/user_001')    // PATCH — 변경분만 전송
await user.remove('/users/user_001')  // DELETE
```

---

## 다음 단계

- [팩토리 메서드](/guide/factories) — `fromJSON`, `fromVO`, `fromForm` 의 차이
- [save() 분기 전략](/guide/save-strategy) — POST/PUT/PATCH 자동 선택 알고리즘
- [DomainPipeline](/guide/pipeline) — 여러 API 병렬 호출과 체이닝
