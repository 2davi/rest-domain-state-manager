# Alignment One (2026-03-18)

## 목표 1. V8 엔진 멱살 잡기 (Target: api-proxy.js)

### STEP 1. Proxy 내부 기초 공사 및 GC(가비지 컬렉터) 달래기 (순서 무관, 동시 진행 가능)

> 이 두 개는 트랩(Trap) 내부 로직만 살짝 바꾸는 거라 의존성이 없어. 당장 오늘 안에 다 끝낼 수 있는 것들이다.

**1-1. Lazy Proxing & WeakMap Caching 도입:** 매번 중첩 객체 접근할 때마다 임시 Proxy 객체 새로 찍어내서 메모리 터뜨리는 짓 좀 그만해.

클로저(Closure) 내부에 const proxyCache = new WeakMap() 하나 선언해.

타겟 객체가 이미 캐시에 있으면 무조건 그거 반환하게 만들어서 메모리 누수 잡고 V8 엔진 GC 부하 확 낮춰라.

**1-2. Reflect API 전면 적용:** 트랩 안에서 target[prop] 같은 원시적인 방식 쓰지 마.

무조건 Reflect.get(target, prop, receiver), Reflect.set(...) API로 교체해.

이거 안 해두면 나중에 상속 구조 복잡한 객체 들어왔을 때 this 바인딩 날아가는 치명적인 컨텍스트 소실(Context Loss) 터지니까 무조건 예외 없이 싹 다 바꿔.

만약 `domainObject`가 Getter를 가지고 있고, 그 안에서 `this`를 호출한다고 할 때, `target[prop]`으로 원시 접근하는 순간 `this`바인딩이 원본 객체로 엇나가버린다.

### STEP 2. 마의 구간: 배열(Array) 하이재킹 알고리즘 전면 수정

> 이건 1번 스텝 다 끝내고, 머리 맑을 때 커피 한 잔 원샷하고 시작해라. 기존의 멍청한 로직을 완전히 갈아엎는 거다.

**2-1. 브랜치 격리 및 TDD 환경 세팅:** 당장 feature/array-patch-optimization 브랜치 새로 파. 이 작업은 main이나 코어 리팩토링 브랜치에 섞이면 무조건 꼬인다.

로직 짜기 전에 실패하는 테스트 코드(TDD)부터 무조건 작성해.

**2-2. Iterator 기반 Delta 계산 로직 구현:** isMuting 플래그 써서 배열 전체 덮어씌우는 그 무식한 꼼수 버려라. V8 환경 루프 내에서 객체 함부로 동적 생성하는 거 아니다.

원본 배열 메서드 동작 방식에 맞춰서, 정확히 어디서부터 어디까지 인덱스가 바뀌었는지(Delta) 수학적으로 계산해 내는 커스텀 반복자(Iterator) 기반 알고리즘을 짜.

그래서 변경된 부분만 딱 잘라서 REPLACE 로그로 도출하게 만들어.
