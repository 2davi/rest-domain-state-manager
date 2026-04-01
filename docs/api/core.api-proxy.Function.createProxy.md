# Function: createProxy()

```ts
function createProxy(
   domainObject, 
   onMutate?, 
   trackingMode?): ProxyWrapper;
```

순수 JS 객체를 Proxy로 감싸 변경 추적 엔진을 생성하고 "도개교" 세트를 반환한다.

## 동작 흐름

```
createProxy(obj)
  ├─ changeLog[]      클로저 — 변경 이력 저장소
  ├─ proxyCache       WeakMap — 중첩 Proxy 캐시 (Lazy Proxying)
  ├─ isMuting         boolean — 배열 변이 중 set 트랩 무시 플래그
  ├─ record()         변경 이력 기록 내부 함수
  ├─ makeHandler()    트랩 핸들러 팩토리 (basePath 누적)
  └─ return ProxyWrapper
       ├─ proxy         new Proxy(obj, makeHandler(''))
       ├─ getChangeLog  () => [...changeLog]
       ├─ getTarget     () => obj
       └─ clearChangeLog () => void (changeLog.length = 0)
```

## WeakMap 캐싱 전략
`get` 트랩에서 중첩 객체/배열을 반환할 때, 이미 Proxy로 감싼 적 있으면
`proxyCache`에서 즉시 반환한다. 원본 객체가 사라지면 `WeakMap` 특성상
연관된 Proxy도 GC 대상이 되어 메모리 누수가 발생하지 않는다.

## 배열 변이 추적 전략
`ON_MUTATIONS`(`shift`, `unshift`, `splice`, `sort`, `reverse`) 메서드는
래퍼 함수로 가로채어 `isMuting = true`로 set 트랩을 일시 비활성화한 뒤
원본 메서드를 실행하고, 이후 변경된 범위만 정밀하게 `record()`한다.
`push`/`pop`은 set 트랩의 자연스러운 동작으로 충분하므로 래핑하지 않는다.

## Parameters

### domainObject

`object`

Proxy로 감쌀 순수 JS 객체 또는 배열

### onMutate?

  \| [`OnMutateCallback`](core.api-mapper.TypeAlias.OnMutateCallback.md)
  \| `null`

변경 기록 직후 호출되는 콜백. 기본값 `null`.

### trackingMode?

`"realtime"` \| `"lazy"`

변경 추적 모드.
  - `'realtime'` (기본): `set` 트랩 발화마다 `changeLog`와 `dirtyFields`에 즉시 기록.
  - `'lazy'`: `changeLog`와 `dirtyFields` 기록을 건너뜀.
    `onMutate` 콜백은 여전히 호출되어 Shadow State 갱신(`_scheduleFlush`)은 정상 동작.
    `DomainState.save()` 시점에 `diff-worker-client.requestDiff()`로 diff를 계산한다.

## Returns

[`ProxyWrapper`](core.api-mapper.Interface.ProxyWrapper.md)

도개교 세트 — proxy, getChangeLog, getTarget, clearChangeLog

## Examples

```ts
const { proxy, getChangeLog, clearChangeLog } = createProxy({ name: 'Davi', age: 0 });
proxy.name = 'Lee';        // op: 'replace', path: '/name'
proxy.phone = '010-0000';  // op: 'add',     path: '/phone'
delete proxy.age;          // op: 'remove',  path: '/age'
console.log(getChangeLog()); // [{ op, path, ... }, ...]
```

```ts
let state = null;
const wrapper = createProxy(skeleton, () => {
    if (state?._debug) state._broadcast();
});
state = new DomainState(wrapper, { ... });
```

```ts
const { proxy } = createProxy({ address: { city: 'Seoul', zip: '' } });
proxy.address.city = 'Busan'; // op: 'replace', path: '/address/city'
```

```ts
const { proxy, getChangeLog } = createProxy({ items: ['A', 'B', 'C'] });
proxy.items.splice(1, 1, 'X', 'Y');
// changeLog: [REMOVE /items/1, ADD /items/1, ADD /items/2]
```
