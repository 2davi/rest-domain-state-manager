# Proxy 엔진 심층 분석

이 문서는 `src/core/api-proxy.js` 의 내부 설계, JS Proxy 트랩의 구현 원리, 그리고 변경 추적 메커니즘을 기술합니다.

## ProxyWrapper — 도개교(Drawbridge) 패턴

`createProxy(domainObject, onMutate)` 함수는 JS Proxy 객체 하나만 반환하지 않습니다. 클로저로 격리된 상태에 접근하는 **10개의 게이트** 를 함께 반환합니다.

```javascript
// createProxy()의 반환값 (ProxyWrapper)
{
    proxy,              // 외부 공개 진입점. 변경 추적 활성화된 Proxy 객체.
    getChangeLog,       // () => [...changeLog]          — 얕은 복사본 반환
    getTarget,          // () => domainObject            — 원본 객체 참조
    clearChangeLog,     // () => void                    — 이력 초기화
    getDirtyFields,     // () => new Set(dirtyFields)    — 복사본 반환
    clearDirtyFields,   // () => void                    — dirtyFields 초기화
    restoreTarget,      // (data) => void                — Proxy 우회 복원
    restoreChangeLog,   // (entries) => void             — changeLog 교체
    restoreDirtyFields, // (fields) => void              — dirtyFields 교체
}
```

외부 개발자는 오직 `proxy` (즉, `domainState.data`) 를 통해서만 데이터에 접근합니다. 나머지 8개의 게이트는 `DomainState` 내부 로직에서만 사용됩니다. 이 철저한 캡슐화가 `changeLog` 무결성을 보장합니다.

### 클로저 구조

```text
createProxy(domainObject, onMutate)
 ├─ changeLog: ChangeLogEntry[]       — 변경 이력
 ├─ dirtyFields: Set<string>          — 변경된 최상위 키
 ├─ proxyCache: WeakMap               — Lazy Proxy 캐시
 ├─ isMuting: boolean                 — 배열 메서드 실행 중 set 트랩 차단 플래그
 ├─ record(op, path, old, new)        — 단일 기록 창구
 ├─ makeHandler(basePath)             — 트랩 핸들러 팩토리
 └─ return ProxyWrapper
```

## set 트랩 — 프로퍼티 변경 추적

```javascript
set(target, prop, value, receiver) {
    // 1. isMuting 중이면 기록하지 않음 (배열 메서드 실행 중)
    if (isMuting) return Reflect.set(target, prop, value, receiver)

    // 2. 심볼 키, 배열 내부 관리 프로퍼티(length 등)는 기록하지 않음
    if (shouldBypassRecord(prop)) return Reflect.set(target, prop, value, receiver)

    const currentVal = Reflect.get(target, prop, receiver)
    const ok = Reflect.set(target, prop, value, receiver)

    if (ok) {
        // 3. 동일값 재할당 — No-op
        if (currentVal === value) return ok

        // 4. op 결정: 기존 키 존재 여부로 replace / add 분기
        const op = Object.prototype.hasOwnProperty.call(target, prop)
            ? OP.REPLACE
            : OP.ADD

        record(op, `${basePath}/${String(prop)}`, currentVal, value)
    }

    return ok
}
```

`Reflect.set()` 을 사용하는 이유는 단순한 `target[prop] = value` 와 달리 Proxy 체인과 프로토타입 상속을 올바르게 처리하여 `this` 바인딩 문제를 방지하기 위함입니다.

## get 트랩 — Lazy Proxying과 배열 하이재킹

```javascript
get(target, prop, receiver) {
    // 1. Symbol, toJSON, then, valueOf — 직렬화·Promise 호환성 유지
    if (shouldBypassDeepProxy(prop)) return Reflect.get(target, prop, receiver)

    // 2. 배열 변이 메서드 하이재킹
    if (Array.isArray(target) && ON_MUTATIONS.includes(prop)) {
        return (...args) => {
            const oldArray = [...target]
            isMuting = true
            const result = Array.prototype[prop].apply(target, args)
            isMuting = false
            // 메서드별 Delta 계산 후 record()
            recordArrayMutation(prop, oldArray, args, result)
            return result
        }
    }

    // 3. plain object 또는 배열: Lazy Proxy & WeakMap 캐싱
    const value = Reflect.get(target, prop, receiver)
    if (isPlainObject(value) || Array.isArray(value)) {
        if (proxyCache.has(value)) return proxyCache.get(value)  // 캐시 히트
        const childProxy = new Proxy(value, makeHandler(`${basePath}/${String(prop)}`))
        proxyCache.set(value, childProxy)
        return childProxy
    }

    return value
}
```

### Lazy Proxying 원리

중첩 객체에 대한 Proxy는 최초 접근 시점에 생성됩니다(Lazy). 생성된 Proxy는 `WeakMap` 에 캐싱되어 동일 객체에 재접근할 때 새 Proxy를 생성하지 않습니다. 원본 객체가 GC로 수거되면 `WeakMap` 의 해당 항목도 자동으로 제거됩니다.

```text
user.data.address.city = 'Seoul'
 │
 └─ get 트랩: 'address' 접근
      ├─ proxyCache.has(address) ?
      │    true  → 캐시된 Proxy 반환 (WeakMap 히트)
      │    false → 새 Proxy 생성, proxyCache.set(address, proxy), 반환
      └─ 반환된 Proxy의 set 트랩: 'city' = 'Seoul' → record('replace', '/address/city', ...)
```

### 배열 변이 메서드 하이재킹

`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse` 는 배열의 인덱스를 통해 set 트랩을 다수 발생시키는 내부 동작을 가집니다. 이 set 트랩을 그대로 기록하면 불필요한 이력이 쌓이고 실제 의도와 다른 Delta가 생성됩니다.

`isMuting` 플래그로 메서드 실행 중 set 트랩을 차단하고, 실행 완료 후 메서드 의미론에 맞는 단일 Delta 로그를 직접 생성합니다.

<table class="param-table">
  <thead>
    <tr><th>메서드</th><th>Delta 전략</th></tr>
  </thead>
  <tbody>
    <tr><td><code>shift</code></td><td>index 0의 REMOVE op 1건</td></tr>
    <tr><td><code>unshift</code></td><td>추가된 각 요소의 ADD op (선두 인덱스부터 순서대로)</td></tr>
    <tr><td><code>splice</code></td><td>삭제 요소: startIdx 기준 REMOVE + 추가 요소: startIdx 기준 ADD</td></tr>
    <tr><td><code>sort</code>, <code>reverse</code></td><td>배열 전체를 단일 REPLACE op (인덱스 추적 불가)</td></tr>
    <tr><td><code>push</code></td><td>set 트랩의 length-1 인덱스 ADD 자연 발생 — 하이재킹 불필요</td></tr>
  </tbody>
</table>

## record() — 단일 기록 창구

`set` 트랩, `deleteProperty` 트랩, 배열 변이 래퍼 세 곳 모두 `record()` 함수로 수렴합니다.

```javascript
function record(op, path, oldValue, newValue) {
    changeLog.push({ op, path, oldValue, newValue })
    // dirtyFields에 최상위 키 등록
    const topLevelKey = path.split('/')[1]
    if (topLevelKey) dirtyFields.add(topLevelKey)
    // 상위 DomainState에 변경 알림
    onMutate()
}
```

`onMutate()` 콜백을 통해 `DomainState._scheduleFlush()` 가 호출되고, Microtask Queue에 `_broadcast()` 가 예약됩니다. 동일한 동기 블록에서 여러 필드가 변경되어도 `_broadcast()` 는 단 한 번만 실행됩니다.
