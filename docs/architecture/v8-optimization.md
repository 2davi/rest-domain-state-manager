# V8 최적화 전략

이 문서는 `rest-domain-state-manager` 가 V8 엔진의 JIT 컴파일러 최적화를 유지하면서 JS Proxy 기반 상태 추적을 구현하기 위해 적용한 기술적 결정들을 기술합니다.

## Hidden Class와 Inline Caching

V8은 동적 타입 언어인 JavaScript의 성능 한계를 극복하기 위해 **Hidden Class**(내부적으로 Maps라고도 함)를 사용합니다. 객체가 생성될 때 프로퍼티 구조를 기반으로 Hidden Class를 만들고, 동일한 구조를 가진 객체들에 대해 프로퍼티 접근 시의 메모리 오프셋을 캐싱합니다(**Inline Caching**).

객체에 새로운 프로퍼티가 동적으로 추가되거나 프로퍼티 구조가 변경되면, V8은 새로운 Hidden Class로 전이(Transition)하고 이전에 캐싱된 오프셋이 무효화됩니다. 이 과정이 반복되면 JIT 컴파일러(TurboFan)는 해당 객체를 예측 불가능한 것으로 판단하고 최적화를 포기합니다(**De-optimization**).

### 위협 요소와 대응

>**위협 1: 동적 프로퍼티 추가**

서버 응답을 직접 파싱하여 빈 객체에 할당하면 각 응답마다 프로퍼티 구조가 달라질 수 있습니다.

**대응:** `DomainVO.fields` 로 모든 프로퍼티를 사전에 선언하면, `fromVO()` 가 생성하는 Skeleton 객체는 항상 동일한 프로퍼티 구조를 가집니다. 모든 인스턴스가 동일한 Hidden Class를 공유하여 Inline Caching 효과를 극대화합니다.

>**위협 2: Proxy 트랩 내부의 무거운 연산**

Proxy 트랩은 모든 프로퍼티 접근에 개입하는 핫 패스입니다. 트랩 내부에서 정규식 검사, 루프 순회, 객체 동적 생성 등 무거운 연산을 수행하면 V8의 최적화 경로를 이탈합니다.

**대응:** `set` 트랩은 `isMuting` 플래그 확인, 동일값 체크, `record()` 호출만 수행합니다. 유효성 검사는 `save()` 시점으로 지연됩니다.

## Lazy Proxying & WeakMap 캐싱

중첩 객체에 접근할 때마다 새로운 Proxy를 생성하면 GC 압력이 급증합니다. 특히 렌더링 루프 내에서 중첩 객체를 반복적으로 접근하는 경우, 매번 새로운 임시 객체가 생성되고 수거됩니다.

`proxyCache: WeakMap` 이 이 문제를 해결합니다.

```javascript
if (proxyCache.has(value)) {
    return proxyCache.get(value)  // 캐시 히트: 새 Proxy 생성 없음
}
const childProxy = new Proxy(value, makeHandler(childPath))
proxyCache.set(value, childProxy)   // 미스: 생성 후 캐싱
return childProxy
```

`WeakMap` 을 사용하는 이유는 두 가지입니다.

1. **자동 메모리 관리** — 원본 객체가 GC로 수거되면 해당 캐시 항목도 자동으로 제거됩니다. 명시적인 cleanup이 불필요합니다.
2. **키 타입 제약** — WeakMap은 객체만 키로 허용합니다. 원시값이 실수로 캐시 키가 되는 것을 타입 수준에서 차단합니다.

## Reflect API 전면 도입

트랩 내부의 모든 원본 객체 접근을 `target[prop]` 방식 대신 `Reflect` API로 처리합니다.

```javascript
// ❌ 원시 접근: 상속 구조와 this 바인딩 문제 가능성
const value = target[prop]
target[prop] = newValue

// ✅ Reflect API: 프로토타입 체인과 receiver 올바르게 처리
const value = Reflect.get(target, prop, receiver)
Reflect.set(target, prop, newValue, receiver)
```

`receiver` 파라미터는 Proxy 자신 또는 상속 체인의 올바른 `this` 를 전달합니다. `domainObject` 가 Getter를 가진 경우, `Reflect.get` 없이 `target[prop]` 으로 접근하면 Getter의 `this` 가 Proxy가 아닌 원본 객체로 바인딩되어 예상치 못한 동작이 발생할 수 있습니다.

## 배열 Delta 계산 알고리즘

`sort()`, `reverse()` 가 실행되면 배열의 모든 인덱스에 대한 set 트랩이 발생합니다. 이 트랩을 그대로 기록하면 O(N) 개의 이력 항목이 생성됩니다.

`isMuting` 플래그로 배열 메서드 실행 중 set 트랩을 차단하고, 메서드 실행 전후의 배열 스냅샷을 비교하여 단일 REPLACE 이력을 생성합니다.

```text
[sort/reverse 실행]
  isMuting = true    ← set 트랩 차단
  Array.prototype.sort.apply(target, args)
  isMuting = false

  record(OP.REPLACE, basePath, oldArray, [...target])
  → changeLog에 단 1건의 REPLACE 기록
  → dirtyFields에 최상위 키 1회 등록
```

`splice` 는 삭제 요소와 추가 요소를 정확히 계산하여 각각 REMOVE와 ADD 이력을 생성합니다. 음수 인덱스(`splice(-1, 1)`) 처리를 위해 `startIdx = args[0] < 0 ? Math.max(length + args[0], 0) : Math.min(args[0], length)` 계산을 수행합니다.
