# Playground 모음

라이브러리의 핵심 동작을 직접 조작하며 확인할 수 있는 인터랙티브 시연 모음입니다.
각 Playground 아래의 링크를 클릭하면 해당 개념을 설명하는 문서로 이동합니다.

---

## HTTP 메서드 자동 분기

필드를 수정하고 `save()` 를 실행하면 POST / PUT / PATCH 중 무엇이 선택되는지, 그리고 왜 선택되는지 확인합니다.

→ [save() 분기 전략 문서](/guide/save-strategy#http-메서드-자동-분기-알고리즘)

<PlaygroundHttpMethod />

---

## dirtyFields Set 동작 원리

중첩 키를 변경해도 `dirtyFields`에는 최상위 키만 등록됩니다. `address.city` 를 수정하면 `'address.city'` 가 아닌 `'address'` 가 등록되는 것을 확인합니다.

→ [save() 분기 전략 문서](/guide/save-strategy#http-메서드-자동-분기-알고리즘)

<PlaygroundDirtyFields />

---

## Optimistic Update 롤백 & restore()

`save()` 실패 시 인메모리 상태가 자동으로 복원됩니다. `restore()` 로 성공한 요청도 수동으로 되돌릴 수 있습니다. 두 경로의 차이를 직접 확인합니다.

→ [save() 분기 전략 문서 — 롤백 섹션](/guide/save-strategy#save-내-자동-롤백)

<PlaygroundRollback />

---

## CSRF 인터셉터 3-상태 시연

`init()` 호출 여부와 meta 태그 유무에 따라 `X-CSRF-Token` 헤더 주입 동작이 어떻게 달라지는지 확인합니다.

→ [ApiHandler 문서 — init() 섹션](/guide/api-handler#init-csrf-토큰-초기화)

<PlaygroundCsrf />

---

## Microtask 배칭

동기 블록에서 여러 필드를 변경해도 `subscribe()` 콜백은 microtask 완료 후 1회만 호출됩니다. `await` 경계가 생기면 각 경계마다 별도 호출이 발생합니다.

→ [상태 생명주기 문서 — Microtask Batching 섹션](/architecture/state-lifecycle#microtask-batching-디버그-채널-최적화)

<PlaygroundBatching />

---

## Shadow State & Structural Sharing

`subscribe()` + `getSnapshot()` 의 동작 원리를 확인합니다. 변경된 경로만 새 참조를 만들고, 변경되지 않은 노드는 기존 참조를 재사용합니다.

→ [상태 생명주기 문서 — Shadow State 섹션](/architecture/state-lifecycle#shadow-state-불변-스냅샷)

<PlaygroundShadowState />

---

## DomainPipeline — failurePolicy 보상 트랜잭션

`DomainState.all()` 의 병렬 fetch와 `failurePolicy` 에 따른 보상 트랜잭션 동작을 확인합니다. `ignore` / `rollback-all` / `fail-fast` 세 가지 정책의 차이를 직접 비교합니다.

→ [DomainPipeline 문서 — failurePolicy 섹션](/guide/pipeline#failurepolicy-보상-트랜잭션-정책)

<PlaygroundPipeline />

---

## FormBinder 플러그인

`fromForm()` 으로 HTML 폼 현재값을 `DomainState` 로 생성하고, `bindForm()` 으로 서버 데이터를 폼에 역방향 동기화합니다.

→ [FormBinder 플러그인 문서](/guide/form-binder)

<PlaygroundFormBinder />

---

## DomainRenderer 플러그인

배열 형태의 `DomainState` 데이터를 `select` / `radio` / `checkbox` / `button` 요소로 렌더링합니다.

→ [DomainRenderer 플러그인 문서](/guide/domain-renderer)

<PlaygroundRenderer />

---

## DomainCollection — 배열 상태 관리

`fromJSONArray()`로 배열을 로드하고, `add()` / `remove()`로 항목을 조작한 뒤 `saveAll()`로 저장합니다. POST/PUT 자동 분기와 실패 롤백, realtime/lazy trackingMode 전환을 직접 확인합니다.

→ [DomainCollection 가이드](/guide/domain-collection)

<PlaygroundCollection />
