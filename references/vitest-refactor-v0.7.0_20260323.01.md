# Vitest Refactor v0.7.0 (2026-03-23)

## (a) 에러 발생

### `ReferenceError: window is not defined`

```javascript
❯ src/debug/debug-channel.js:225:1
    window.addEventListener('beforeunload', () => {
```

- `window.addEventListener(...)` 호출이 **모듈 최상위 스코프(top-level scope)에서 이루어지고 있었다.
- `DomainState.test.js`, `DomainPipeline.test.js`, `api-handler.test.js` 파일은 `environment: 'node'` 환경에서 돌아가는데,
  - Node.js 런타임에는 `window`가 존재하지 않는다.
  - `DomainState.js`가 `debug-channel.js`를 `import`하는 순간, **모듈 평가(module evaluation) 단계**에서 최상위 코드가 즉시 실행되고 바로 뻗어버린다.

### Design Smell: 01

- `DomainState`, `DomainPipeline`, `api-handler` 기능을 테스트하려는데, `debug-channel`을 `import`하면서 모듈 평가 단계를 넘어가지 못하고 Node 환경이 뻗고 있다.
- 고민해야 할 질문은: _`debug-channel`의 `beforeunload` 등록이 모듈 로드 시점에 일어나야 하나, 아니면 **명시적 초기화 시점**에 일어나야 하느냐._
- **isomorphic 환경 가드** 패턴으로 해당 line을 수정하고 테스트를 다시 진행했다.

```javascript
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { ... });
}
```
  
### `ReferenceError: location is not defined`

- `window`를 막아도, 다른 함수, 필드를 직접 호출하는 코드들에서 문제가 발생하고 있다.

### Design Smell: 02

- Top-Level 코드는 모듈이 `import`되는 순간 단 한 번 실행된다. 이 _실행 시점을 제어할 수 없어서_ 문제가 발생했다.
- `debug-channel.js`의 Top-Level에 있는 **모든 즉시 실행 코드**들을 전부 `initDebugChannel()` 과 같은 단일 진입점 함수로 옮기는 방향을 고민했다.
  - 이럴 경우, 브라우저 환경에서는 `DomainState` 최초 인스턴스 생성 시점에 명시적으로 호출하게 실행 시점(흐름)이 변경된다.
  - `DomainState`가 생성되지 않는 페이지에서는 `debug-channel` 초기화 자체가 발생하지 않아, 불필요한 리소스 점유를 막는 **지연 초기화(lazy initialization) 패턴**을 따를 수 있게 된다.
  - `broadcastUpdate`와 `broadcastError`에 isomorphic 환경 가드 패턴 추가로 리소스 안정성 확보.

## (b) 전체 테스트케이스 목록

### Layer 1 — `src/core/api-proxy.js` (엔진)

파일명: `tests/core/api-proxy.test.js`

```javascript
describe('createProxy — 기본 변경 추적')
  it: 존재하는 키를 수정하면 changeLog에 replace op가 기록된다
  it: 존재하지 않는 키를 추가하면 changeLog에 add op가 기록된다
  it: delete 연산자 사용 시 changeLog에 remove op가 기록된다
  it: 동일한 값 재할당은 changeLog에 기록되지 않는다 (No-op)

describe('createProxy — 중첩 객체 추적')
  it: 중첩 객체의 프로퍼티 수정 시 path가 /부모/자식 형태로 기록된다
  it: 동일한 중첩 객체에 두 번 접근해도 Proxy를 새로 만들지 않는다 (WeakMap 캐싱)

describe('createProxy — 배열 변이 추적')
  it: push는 set 트랩으로 add op가 기록된다
  it: pop은 set 트랩으로 remove op가 기록된다
  it: splice는 삭제/추가 각각 정확한 인덱스 path로 기록된다
  it: sort는 배열 전체를 단일 replace op로 기록된다
  it: reverse는 배열 전체를 단일 replace op로 기록된다
  it: shift는 index 0 remove op로 기록된다
  it: unshift는 index 0 add op로 기록된다

describe('createProxy — dirtyFields 추적 (1-A)')
  it: 최상위 키 변경 시 dirtyFields에 해당 키가 등록된다
  it: 중첩 키 변경 시 최상위 키만 dirtyFields에 등록된다 (/address/city → 'address')
  it: 동일 키를 여러 번 변경해도 dirtyFields.size는 1이다 (Set 중복 무시)
  it: clearDirtyFields 호출 후 dirtyFields가 비워진다

describe('createProxy — 복원 메서드 (1-D)')
  it: restoreTarget은 domainObject를 스냅샷 데이터로 복원한다
  it: restoreTarget 복원 시 changeLog에 기록되지 않는다 (Proxy 우회)
  it: restoreChangeLog는 changeLog를 스냅샷 항목으로 교체한다
  it: restoreDirtyFields는 dirtyFields를 스냅샷 키 집합으로 교체한다
  it: Array 루트 객체 복원 시 splice/push로 처리한다

describe('createProxy — ProxyWrapper 인터페이스')
  it: getChangeLog는 changeLog의 얕은 복사본을 반환한다 (외부 변조 불가)
  it: getDirtyFields는 new Set 복사본을 반환한다 (외부 변조 불가)
  it: clearChangeLog 호출 후 getChangeLog 길이가 0이다
```

### Layer 2 — `src/domain/DomainVO.js`

파일명: `tests/domain/DomainVO.test.js`

```javascript
describe('DomainVO — toSkeleton()')
  it: static fields의 default 값으로 골격 객체를 생성한다
  it: default가 없는 필드는 빈 문자열로 초기화된다
  it: default가 객체인 필드는 deep copy된다 (인스턴스 간 참조 분리)
  it: static fields 미선언 시 인스턴스 own property를 반환한다

describe('DomainVO — getValidators()')
  it: validate 함수가 있는 필드만 맵에 포함된다
  it: static fields 미선언 시 빈 객체를 반환한다

describe('DomainVO — getTransformers()')
  it: transform 함수가 있는 필드만 맵에 포함된다

describe('DomainVO — getBaseURL()')
  it: static baseURL 선언 시 해당 값을 반환한다
  it: static baseURL 미선언 시 null을 반환한다

describe('DomainVO — checkSchema()')
  it: 스키마와 완전 일치 시 valid: true, 두 배열 모두 빈 배열을 반환한다
  it: 응답 데이터에 VO 키가 없으면 missingKeys에 포함되고 valid: false이다
  it: 응답 데이터에 VO에 없는 키가 있으면 extraKeys에 포함되고 valid: true이다
  it: static fields 미선언 시 항상 valid: true를 반환한다
```

### Layer 3 — `src/domain/DomainState.js`

파일명: `tests/domain/DomainState.test.js`

- `_fetch`를 Mock으로 대체해서 실제 HTTP 없이 테스트 설계.

```javascript
describe('DomainState.fromJSON()')
  it: isNew가 false로 생성된다
  it: data getter가 Proxy 객체를 반환한다
  it: vo 옵션 제공 시 validators/transformers가 주입된다

describe('DomainState.fromVO()')
  it: isNew가 true로 생성된다
  it: vo.getBaseURL()이 있으면 urlConfig가 자동 설정된다

describe('DomainState.save() — HTTP 메서드 분기 (1-A, 1-B)')
  it: isNew === true이면 POST로 전송한다
  it: POST 성공 후 isNew가 false로 전환된다
  it: dirtyFields.size === 0이면 PUT으로 전송한다
  it: dirtyRatio >= 0.7이면 PUT으로 전송한다
  it: dirtyRatio < 0.7이면 PATCH로 전송한다
  it: PATCH payload가 RFC 6902 JSON Patch 배열 형식이다
  it: 성공 후 changeLog가 비워진다
  it: 성공 후 dirtyFields가 비워진다

describe('DomainState.save() — Optimistic Update 롤백 (1-D)')
  it: HTTP 4xx 오류 시 domainObject가 save() 이전 상태로 복원된다
  it: HTTP 오류 시 changeLog가 save() 이전 상태로 복원된다
  it: HTTP 오류 시 dirtyFields가 save() 이전 상태로 복원된다
  it: HTTP 오류 시 isNew가 save() 이전 상태로 복원된다
  it: 롤백 후 에러가 re-throw된다 (호출자가 catch 가능)
  it: 롤백 후 save()를 재시도하면 올바른 메서드로 전송된다

describe('DomainState — Batching Scheduler (1-C)')
  it: 동일 동기 블록에서 다중 변경 시 onMutate 콜백은 queueMicrotask로 지연된다
  it: 동기 블록 안에서 필드 3개를 바꿔도 _broadcast는 단 1번만 실행된다

describe('DomainState.remove()')
  it: DELETE 메서드로 요청이 전송된다
```

### Layer 4 — `src/network/api-handler.js`

파일명: `tests/network/api-handler.test.js`

```javascript
describe('ApiHandler — constructor')
  it: urlConfig가 normalizeUrlConfig로 정규화되어 _urlConfig에 저장된다
  it: debug 플래그가 _debug에 저장된다

describe('ApiHandler.get()')
  it: GET 응답으로 DomainState(isNew: false)를 반환한다
  it: 응답 본문이 비어있으면 Error를 throw한다

describe('ApiHandler._fetch()')
  it: response.ok === true이면 응답 텍스트를 반환한다
  it: response.ok === false이면 HttpError { status, statusText, body }를 throw한다
  it: 204 No Content 응답 시 null을 반환한다
  it: options.headers가 _headers보다 우선 적용된다 (오버라이드)
```

### Layer 5 — `src/domain/DomainPipeline.js`

파일명: `tests/domain/DomainPipeline.test.js`

```javascript
describe('DomainPipeline.after()')
  it: 존재하지 않는 key 전달 시 즉시 Error를 throw한다
  it: handler가 함수가 아닐 때 TypeError를 throw한다
  it: 체이닝이 가능하다 (this 반환)

describe('DomainPipeline.run() — strict: false (기본)')
  it: 모든 fetch가 성공하면 resolved 맵을 반환한다
  it: fetch 실패 항목이 _errors에 기록되고 나머지는 계속 진행된다
  it: after() 핸들러가 등록 순서대로 실행된다
  it: fetch 실패한 키의 after() 핸들러는 건너뛴다

describe('DomainPipeline.run() — strict: true')
  it: fetch 실패 시 즉시 reject된다
  it: after() 핸들러 실패 시 즉시 reject된다
```

### Layer 6 — 플러그인 (jsdom 환경 필요)

파일명: `tests/plugins/FormBinder.test.js`, `tests/plugins/DomainRenderer.test.js`

- FormBinder와 DomainRenderer는 DOM API를 사용하므로 vitest 설정에 `environment: 'jsdom'` 필요.

```javascript
describe('FormBinder — fromForm()')
  it: 폼 요소 현재 값으로 DomainState를 생성한다 (isNew: true)
  it: 유효하지 않은 formOrId 전달 시 Error를 throw한다
  it: input[type=text] 변경 시 blur 이벤트에서 data가 갱신된다
  it: select 변경 시 change 이벤트에서 data가 즉시 갱신된다

describe('FormBinder — bindForm()')
  it: DomainState.data를 폼 필드에 역방향 동기화한다

describe('DomainRenderer — renderTo()')
  it: type: select 이면 HTMLSelectElement를 컨테이너에 추가한다
  it: type: radio 이면 HTMLInputElement[] 를 컨테이너에 추가한다
  it: type: checkbox 이면 HTMLInputElement[] 를 컨테이너에 추가한다
  it: type: button 이면 HTMLButtonElement[] 를 컨테이너에 추가한다
  it: 존재하지 않는 컨테이너 id 전달 시 Error를 throw한다
  it: DomainState 데이터가 배열이 아닐 때 Error를 throw한다
  it: 같은 컨테이너에 두 번 호출하면 기존 자식 요소를 지우고 새로 렌더링한다
  ```
