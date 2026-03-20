# core/api-proxy

Proxy 기반 도메인 객체 변경 추적 엔진

`createProxy()`는 순수 JS 객체를 ES6 `Proxy`로 감싸
`set` / `get` / `deleteProperty` 트랩으로 모든 필드 변경을 자동으로 기록한다.

## 주요 설계 원칙

### 1. Lazy Proxying & WeakMap 캐싱 (refactor/core-engine, 2026-03-18)
중첩 객체에 접근할 때마다 새 `Proxy`를 생성하면 V8 GC에 막대한 부하를 준다.
`proxyCache(WeakMap)`을 사용해 동일한 원본 객체에 대한 `Proxy`를 캐싱하고,
원본 객체가 GC 대상이 될 때 `Proxy`도 함께 수거된다.

### 2. Reflect API 전면 적용 (refactor/core-engine, 2026-03-18)
트랩 내부의 모든 속성 접근을 `target[prop]` 직접 접근 대신
`Reflect.get / Reflect.set / Reflect.deleteProperty`로 처리하여
프로토타입 체인과 `this` 바인딩이 복잡한 객체에서의 컨텍스트 소실을 방지한다.

### 3. 배열 변이 메서드 Delta 최적화 (refactor/array-patch-optimization, 2026-03-18)
`ON_MUTATIONS`(`shift`, `unshift`, `splice`, `sort`, `reverse`) 호출 시
set 트랩을 뮤트(mute)하고 변경된 인덱스 범위만 수학적으로 계산하여
정확한 RFC 6902 JSON Patch 연산(`ADD` / `REMOVE` / `REPLACE`)으로 기록한다.

## 반환값 — "도개교(Drawbridge)" 세트
`{ proxy, getChangeLog, getTarget, clearChangeLog }` 네 클로저를
`DomainState`가 보관하며, 외부에는 `proxy`만 공개된다.

## changeLog 항목 구조 (RFC 6902 기반)
```
{ op: 'add'|'replace'|'remove', path: '/field/0', oldValue?, newValue? }
```

## See

 - [RFC 6902 — JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
 - [MDN — Proxy](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

## Type Aliases

- [ArrayMutationResult](core.api-proxy.TypeAlias.ArrayMutationResult.md)

## Functions

- [createProxy](core.api-proxy.Function.createProxy.md)

## References

### ChangeLogEntry

Re-exports [ChangeLogEntry](core.api-mapper.Interface.ChangeLogEntry.md)

***

### OnMutateCallback

Re-exports [OnMutateCallback](core.api-mapper.TypeAlias.OnMutateCallback.md)

***

### ProxyWrapper

Re-exports [ProxyWrapper](core.api-mapper.Interface.ProxyWrapper.md)
