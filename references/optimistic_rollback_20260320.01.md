# Optimistic Rollback (2026-03-20)

## (a) 코드 구조 현황 진단

### `_fetch()` 에러 전파 메커니즘

> `api-handler.js`의 `_fetch()`가 `response.ok === false`이면 `HttpError`를 throw한다.
> 그러나 현재 `save()` 전체 호출 체인에서 이를 catch하는 로직이 없다.

```text
user.data.name = 'Davi'        ← Proxy가 변경을 target에 반영
await user.save('/api/users/1')
  └─ handler._fetch('PATCH', ...)
      └─ throw HttpError { status: 409, ... }
           ↑
           여기서 save()가 그냥 죽음.
           target 객체는 이미 변경된 상태 그대로.
           changeLog도 그대로.
           _isNew 플래그도 오염 가능.
```

- HTTP 오류 발생 시, _프론트엔드 상태(Proxy target)는 이미 바뀐 채로 남아있고, 서버와는 불일치 상태가 된다. **(데이터 무결성 훼손)**_

### 스냅샷 대상 분석

> Rollback에서 복원해야 할 상태가 정확히 무엇인지 열거한다.
> `this._error`는 HTTP 상태 복원과 무관한 _인스턴스 레벨 검증 에러로,_ 롤백 대상이 아니다.

| 복원 대상              | 위치                        | 이유                                                                 |
| ---------------------- | --------------------------- | -------------------------------------------------------------------- |
| `domainObject` 데이터  | `createProxy()` 클로저 내부 | target이 이미 변경되어 있음. 서버 저장 실패 시 이전 값으로 복원 필요 |
| `changeLog[]`          | `createProxy()` 클로저 내부 | `save()` 재시도시 올바른 PATCH payload 재생성을 위해 복원이 필요     |
| `dirtyFields Set`      | `createProxy()` 클로저 내부 | `save()` 재시도시 올바른 PUT/PATCH 분기 판단을 위해 복원 필요        |
| this._isNew            | `DomainState` 인스턴스      | POST 실패 시 `isNew`가 `false`로 전환되기 전에 복원 필요             |

---

## (b) `restoreTarget()` 구현 원리

### 핵심 원리

> `domainObject`는 `createProxy()` 클로저 안에 갇혀 있다. 외부에서 참조 자체를 교체(`domainObject = newObj`)하는 것은 클로저 원리상 불가능.
> _참조를 바꾸는 것이 아니라, 기존 참조가 가리키는 객체의 내부 프로퍼티를 현재 위치에서 통째로 교체해야 한다._

```javascript
// 클로저 내부 restoreTarget 구현 전략
for (const key of Object.keys(domainObject)) {
    delete domainObject[key];    // Proxy를 거치지 않고 원본 직접 조작
}
Object.assign(domainObject, data);  // 스냅샷 데이터로 직접 채움
```

- `delete domainObject[key]`와 `Object.assign(domainObject, data)`는 **Proxy 객체가 아닌 원본 `domainObject`에 직접 접근**한다.
- Proxy 트랩을 우회하기 때문에 이 복원 작업 자체가 `changeLog`에 기록되지 않으며, 이는 의도된 동작 — 롤백이 새로운 변경 이력을 만들면 안 된다.

### `proxyCache` WeakMap의 정합성 문제

- `restoreTarget()` 실행 후, `proxyCache` WeakMap에는 롤백 이전의 중첩 객체를 가리키는 _오래된 캐시 항목이 남는다. **(이력 데이터)**_
- `structuredClone`으로 만든 스냅샷 데이터는 완전히 새로운 객체 참조를 가진다.
  - 롤백 후 `proxy.address.city`에 처음 접근하면, 새 `address` 객체가 캐시에 없으니까 새 Proxy가 만들어지고 캐시에 신규 등록
  - KEY가 되는 원본 객체 참조가 사라지면, 오래된 캐시 항목은 WeakMap 특성상 자동 GC에 의해 처리 - 메모리 누수 없음

### `structuredClone` 선택 근거

> 스냅샷은 **깊은 복사(Deep Clone)**여야 함. `target` 안의 중첩 객체가 나중에 바뀌어도 스냅샷은 오염되어선 안 된다.

| 방법                           | 깊은 복사 | 오버헤드        | 비고                                   |
| ------------------------------ | --------- | --------------- | -------------------------------------- |
| `JSON.parse(JSON.stringify())` |     ✓     | 직렬화 2회      | `undefined`, `Date`, `Map`, `Set` 소실 |
| `structuredClone()`            |     ✓     | 구조화 복제 1회 | 브라우저/Node 17+ 네이티브 지원        |
| 재귀 수동 복사                 |     ✓     | 코드 복잡도 ↑   | 유지보수 부담                          |

- REST API JSON 응답 데이터는 순수 JSON-compatible 값(문자열, 숫자, 배열, 플레인 객체)
- `structuredClone`은 _함수, DOM 노드, Symbol 타입을 지원하지 않는다._

---

## (c) - Edge Case 검토

1. **배열을 루트로 갖는 domainObject:**
REST API 응답이 배열 최상위인 경우. `Object.keys([])`는 인덱스 문자열을 반환하고 `Object.assign([], arr)`도 동작은 하지만 `length` 복원이 보장되지 않는다. `restoreTarget` 내부에서 `Array.isArray(domainObject)` 분기로 `splice`를 사용한다.

2. **snapshot 크기:**
`structuredClone`은 동기 함수; 200KB짜리 거대 DTO를 매번 `save()` 호출 시 복제하면 메인 스레드를 잠시 차단할 수 있다. 이것은 라이브러리 사용 시 자연스럽게 발생하는 트레이드오프고, JSDoc에 명시해서 개발자가 알게 해야 한다.
대안(WeakRef, lazy snapshot)은 복잡도를 불필요하게 높이니까 다음 리팩토링으로 패스.

3. **네트워크 타임아웃 에러:**
`_fetch()`가 `HttpError`가 아닌 일반 `Error`(네트워크 단절 등)를 throw 할 수 있다. `catch (err)` 블록은 모든 에러를 동일하게 잡으므로 타임아웃에서도 롤백이 실행, 이건 올바른 동작이다._어떤 이유로 서버 동기화가 실패했든 클라이언트 상태는 pre-save로 복원되어야 맞다._

---

## (d) 예상 시나리오

- _성공 경로(기존과 동일)_

```text
① save() 진입
   snapshot = {
       data:        structuredClone(getTarget()),    ← 깊은 복사
       changeLog:   getChangeLog(),                  ← 얕은 복사본 (이미 [...changeLog])
       dirtyFields: getDirtyFields(),                ← new Set 복사본
       isNew:       this._isNew,                     ← 원시값 복사
   }

② try 블록 — _fetch() 호출
   HTTP 200/201/204 응답 → 정상 반환

③ 성공 후 처리
   this._clearChangeLog()
   this._clearDirtyFields()
   if (this._debug) this._broadcast()

④ snapshot은 try 블록 종료 후 GC 대상
```

- _실패 경로(새로 추가)_

```text
① save() 진입 — 동일하게 snapshot 생성

② try 블록 — _fetch() 호출
   HTTP 409 Conflict → throw HttpError { status: 409, ... }

③ catch 블록 진입
   this._rollback(snapshot)
     ├─ this._restoreTarget(snapshot.data)
     │    ├─ delete domainObject['name']    ← Proxy 우회, changeLog 기록 없음
     │    ├─ delete domainObject['email']
     │    └─ Object.assign(domainObject, snapshot.data)
     ├─ this._restoreChangeLog(snapshot.changeLog)
     │    └─ changeLog.length = 0; changeLog.push(...snapshot.changeLog)
     ├─ this._restoreDirtyFields(snapshot.dirtyFields)
     │    └─ dirtyFields.clear(); snapshot.dirtyFields.forEach(k => dirtyFields.add(k))
     ├─ this._isNew = snapshot.isNew
     └─ if (this._debug) this._broadcast()   ← 디버그 패널에 롤백 상태 전파

④ throw err   ← 반드시 re-throw
   호출자의 catch가 HttpError를 받아 처리
```

- `_isNew` 플래그 롤백의 이유

> `_fetch()`가 throw하면 `this._isNew = false` 줄은 실행되지 않는다. 그래서 POST 실패 시 `isNew`는 원래의 `true`를 유지하며, 롤백이 필요 없는 것처럼 보이지만 _snapshot에 `isNew`를 포함해서 항상 일관되게 복원하는 게 맞다._ 나중에 코드가 바뀌어도 이 보장이 유지되어야 하므로.

```javascript
if (this._isNew) {
    await handler._fetch(url, { method: 'POST', ... });
    this._isNew = false;   // ← _fetch() 성공 후 전환
}
```

---

## (e) 계획 수립

### 수정 파일 목록 및 변경 범위

| 파일                             | 변경 종류 | 변경 내용                                                                                                                                                                              |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/api-proxy.js`          | **수정**  | ProxyWrapper 반환 객체에 `restoreTarget`, `restoreChangeLog`, `restoreDirtyFields` 3개 추가, `ProxyWrapper` typedef JSDoc 업데이트                                                     |
| `src/constants/error.message.js` | **수정**  | `ERR.SAVE_ROLLBACK` 메시지 추가                                                                                                                                                        |
| `model/DomainState.js`           | **수정**  | constructor에 `_restoreTarget`, `_restoreChangeLog`, `_restoreDirtyFields` 바인딩 추가, `_rollback()` 내부 메서드 신규 추가, `save()` try/catch 구조로 재작성, `save()` JSDoc 업데이트 |

### Feature 브랜치명 및 커밋 메시지

- **브랜치명:** `feature/optimistic-rollback`

- **Commit Sequence:**

```markdown
# 커밋 1 — api-proxy.js: ProxyWrapper 복구 메서드 3종 추가
feat(core): add restore methods to ProxyWrapper for optimistic update rollback

  - restoreTarget(data)       : domainObject 프로퍼티를 Proxy 우회 직접 복원
  - restoreChangeLog(entries) : changeLog 배열을 스냅샷 항목으로 교체
  - restoreDirtyFields(fields): dirtyFields Set을 스냅샷 키 집합으로 교체
  - 세 메서드 모두 Proxy 트랩을 우회하여 changeLog에 기록되지 않음
  - Array 루트 객체 분기(splice) 처리 포함
  - ProxyWrapper typedef JSDoc에 세 메서드 항목 추가

# 커밋 2 — error.messages.js: SAVE_ROLLBACK 메시지 추가
feat(constants): add SAVE_ROLLBACK error message for rollback event logging

  - ERR.SAVE_ROLLBACK(status) 추가
  - save() try/catch에서 롤백 발생 시 console.warn 용도

# 커밋 3 — DomainState.js: _rollback() + save() try/catch
feat(domain): implement optimistic update rollback in save()

  - constructor에 _restoreTarget, _restoreChangeLog, _restoreDirtyFields 바인딩 추가
  - _rollback(snapshot) 내부 메서드 신규 추가
    - 4개 상태(_isNew, target, changeLog, dirtyFields) 일관 복원
    - debug: true이면 _broadcast()로 디버그 패널에 롤백 상태 전파
  - save() 전체를 try/catch로 재작성
    - try 진입 직전 structuredClone 기반 snapshot 생성
    - catch 블록에서 _rollback(snapshot) 후 err re-throw 보장
  - save() JSDoc에 롤백 동작, structuredClone 전제, 재시도 패턴 예제 추가
```
