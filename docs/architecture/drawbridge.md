# 도개교(Drawbridge) 패턴

DSM의 코어 엔진인 `api-proxy.js`는 **도개교(Drawbridge) 패턴**을 사용하여 외부의 무분별한 접근으로부터 상태의 무결성을 보호합니다.

## 4개의 출입문 (Closures)

`createProxy()` 함수는 Proxy 객체 하나만 달랑 반환하지 않고, 4개의 클로저(Closure) 세트를 반환합니다.

```javascript
// createProxy()의 반환값
{
  proxy:          object,     // 변경 추적이 활성화된 Proxy 객체 (외부 공개)
  getChangeLog:   () => [],   // 현재까지의 변경 이력 얕은 복사본 반환 (내부용)
  getTarget:      () => {},   // 변경이 반영된 원본 객체 반환 (내부용)
  clearChangeLog: () => void, // 동기화 성공 후 이력 초기화 (내부용)
}
```

> **💡 핵심 철학:** 외부 개발자는 `domainState.data` (proxy)라는 오직 하나의 진입점만 사용할 수 있습니다. 나머지 3개의 함수는 `DomainState` 내부 로직(`save`, `bindForm` 등)에서만 호출되며, 이 철저한 분리가 변경 추적(changeLog)의 무결성을 100% 보장합니다.