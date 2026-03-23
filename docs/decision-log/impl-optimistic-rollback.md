# IMPL-002 — Optimistic Update 롤백 메커니즘

| 항목      | 내용                               |
| --------- | ---------------------------------- |
| 날짜      | 2026-03-20                         |
| 브랜치    | `feature/optimistic-rollback`      |
| 상위 결정 | [ARD-0001](/decision-log/ard-0001) |
| 상태      | 완료                               |

## 1. 문제 정의

### 1.1 HTTP 실패 시 상태 불일치

기존 구현에서 `save()` 가 HTTP 오류로 실패하면 클라이언트 상태가 이미 변경된 채로 서버와 불일치 상태에 놓였다.

```text
user.data.name = 'Davi'  ← Proxy가 target에 변경 반영
await user.save('/api/users/1')
  └─ handler._fetch('PATCH', ...)
      └─ throw HttpError { status: 409 }
           ↑
           save()가 중단됨.
           target: 이미 'Davi'로 변경된 상태.
           changeLog: 변경 이력 그대로.
           _isNew: POST 시도였다면 상태 오염 가능.
```

이 상태에서 재시도를 하면 동일한 PATCH 페이로드가 생성되어 올바른 것처럼 보이지만, 개발자가 직접 `user.data.name = 'originalValue'` 로 되돌리지 않으면 클라이언트와 서버의 실제 상태가 어긋나는 버그가 잠재된다.

### 1.2 롤백 대상 상태 목록

복원해야 할 상태와 복원이 불필요한 상태를 명확히 분리했다.

| 상태                  | 위치                   | 롤백 필요 이유                                              |
| --------------------- | ---------------------- | ----------------------------------------------------------- |
| `domainObject` 데이터 | `createProxy()` 클로저 | target이 이미 변경되어 있음                                 |
| `changeLog[]`         | `createProxy()` 클로저 | 재시도 시 올바른 PATCH 페이로드 재생성에 필요               |
| `dirtyFields Set`     | `createProxy()` 클로저 | 재시도 시 올바른 PUT/PATCH 분기 판단에 필요                 |
| `_isNew`              | `DomainState` 인스턴스 | POST 실패 시 `false` 전환 전 복원 필요                      |
| `_errors`             | `DomainState` 인스턴스 | HTTP 상태와 무관한 인스턴스 레벨 검증 에러. **롤백 불필요** |

## 2. 설계 결정

### 2.1 스냅샷 전략 — `structuredClone()` 채택

`save()` 진입 직전 현재 상태의 깊은 복사 스냅샷을 생성한다.

| 복제 방법                      | 깊은 복사 | 제약                                   |
| ------------------------------ | --------- | -------------------------------------- |
| `JSON.parse(JSON.stringify())` | YES       | `undefined`, `Date`, `Map`, `Set` 소실 |
| `structuredClone()`            | YSE       | 함수, DOM 노드, Symbol 불가            |
| 재귀 수동 복사                 | YES       | 코드 복잡도 증가                       |

REST API JSON 응답 데이터는 순수 JSON-compatible 값(문자열, 숫자, 배열, 플레인 객체)으로만 구성된다. `structuredClone()` 이 지원하지 않는 타입이 DTO에 포함되는 경우는 라이브러리의 사용 전제 조건에 어긋나므로 이를 JSDoc에 명시하고 `structuredClone()` 을 채택한다.

```javascript
// save() 진입 직전 스냅샷
const snapshot = {
    data:        structuredClone(this._getTarget()),  // 깊은 복사
    changeLog:   this._getChangeLog(),                // [...changeLog] 얕은 복사본
    dirtyFields: this._getDirtyFields(),              // new Set(dirtyFields) 복사본
    isNew:       this._isNew,                         // 원시값 복사
}
```

### 2.2 `restoreTarget()` — Proxy 우회 직접 복원

`domainObject` 는 `createProxy()` 클로저 안에 격리되어 있다. 외부에서 참조 자체를 교체하는 것은 클로저 원리상 불가능하므로, **기존 참조가 가리키는 객체의 내부 프로퍼티를 직접 교체**해야 한다.

```javascript
// createProxy() 클로저 내부 — Proxy를 거치지 않고 원본에 직접 접근
restoreTarget: (data) => {
    if (Array.isArray(domainObject)) {
        domainObject.splice(0)         // 배열 루트 객체 처리
        domainObject.push(...data)
    } else {
        for (const key of Object.keys(domainObject)) {
            Reflect.deleteProperty(domainObject, key)
        }
        Object.assign(domainObject, data)
    }
}
```

이 복원 작업은 Proxy 트랩을 우회하기 때문에 `changeLog` 에 기록되지 않는다. 롤백이 새로운 변경 이력을 만들면 안 된다.

**`proxyCache` WeakMap의 정합성:** `restoreTarget()` 실행 후 WeakMap에는 이전 중첩 객체를 가리키는 오래된 캐시 항목이 남는다. 그러나 `structuredClone()` 으로 만든 스냅샷은 완전히 새로운 객체 참조를 가지므로, 롤백 후 `proxy.address.city` 에 처음 접근하면 캐시 미스가 발생하여 새 Proxy가 생성된다. 기존 항목은 키가 되는 원본 객체 참조가 사라지면 WeakMap 특성상 자동 GC 대상이 된다.

### 2.3 `_isNew` 플래그 롤백 포함 이유

POST 실패 시 `_fetch()` 가 throw되면 `this._isNew = false` 라인은 실행되지 않으므로 `_isNew` 는 `true` 를 유지한다. 롤백 시 `_isNew` 를 복원할 필요가 없어 보이지만, 스냅샷에 포함하여 항상 일관되게 복원한다. 향후 코드가 변경되어 `_fetch()` 이전에 `_isNew` 를 조작하는 로직이 추가되더라도 이 보장이 깨지지 않는다.

### 2.4 네트워크 타임아웃 처리

`_fetch()` 는 `HttpError` 뿐 아니라 일반 `Error`(네트워크 단절, 타임아웃)도 throw할 수 있다. `catch (err)` 블록은 모든 에러를 동일하게 잡아 롤백을 실행한다. **어떤 이유로 서버 동기화가 실패했든 클라이언트 상태는 pre-save 시점으로 복원되어야 한다.**

## 3. 변경 파일 및 커밋 시퀀스

| 파일                              | 변경 종류 | 주요 내용                                                                       |
| --------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `src/core/api-proxy.js`           | 수정      | `ProxyWrapper`에 `restoreTarget`, `restoreChangeLog`, `restoreDirtyFields` 추가 |
| `src/constants/error.messages.js` | 수정      | `ERR.SAVE_ROLLBACK` 메시지 추가                                                 |
| `src/domain/DomainState.js`       | 수정      | `_rollback()` 내부 메서드 추가, `save()` try/catch 재작성                       |

```text
feat(core): add restore methods to ProxyWrapper for optimistic update rollback
feat(constants): add SAVE_ROLLBACK error message for rollback event logging
feat(domain): implement optimistic update rollback in save()
```

## 4. 결과 및 검증

**성공 경로:** 스냅샷이 생성되고 HTTP 요청이 성공하면 `changeLog`, `dirtyFields` 가 초기화된다. 스냅샷은 try 블록 종료 후 GC 대상이 된다.

**실패 경로:** HTTP 오류 발생 시 `_rollback(snapshot)` 이 4개 상태를 복원하고 에러를 re-throw한다. 호출자는 catch 블록에서 동일한 `save()` 를 다시 호출할 수 있으며, 이때 `changeLog` 와 `dirtyFields` 가 복원되어 있으므로 동일한 HTTP 메서드와 페이로드로 올바르게 재시도된다.

Vitest 테스트 케이스 TC-DS-006~009 통과 확인.
