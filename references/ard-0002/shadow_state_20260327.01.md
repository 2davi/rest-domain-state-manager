# Shadow State Architecture (2026-03-27)

> **Milestone:** `v1.3.0`
> **Branch:** `feature/shadow-state`
> **References:** `ard-0002-alignment.md § 3.3`, `§ 2.2`, `§ 2.3`

---

## (a) 현행 구조 진단

### 핵심 문제: In-place Mutation

```text
현재 DomainState 동작 방식

  user.data.name = 'Davi'
    └─ Proxy set 트랩 발화
    └─ changeLog에 { op: 'replace', path: '/name', ... } 기록
    └─ onMutate() → _scheduleFlush() → (microtask) → _broadcast()

  user.data 반환값
    └─ 매 호출마다 동일한 Proxy 인스턴스 반환
    └─ 내부 domainObject는 변이됐지만 Proxy 참조값은 그대로
```

`DomainState.data`는 항상 **동일한 Proxy 인스턴스**를 반환한다. 내부 값이 수십 번 바뀌어도 React의 `Object.is(prev, next)` 비교는 항상 `true`를 반환한다. 리렌더링이 트리거되지 않는다.

### 현재 파이프라인 — Shadow State가 연결될 위치

```text
onMutate 콜백 (createProxy 내부에서 발화)
  └─ state._scheduleFlush()
       └─ if (pendingFlush) return             ← 배칭 게이트
       └─ pendingFlush = true
       └─ queueMicrotask(() => {
              pendingFlush = false
              if (debug) _broadcast()          ← 디버그 채널 전파
          })

Shadow State 연결 목표 위치:
              pendingFlush = false
  NEW →       _buildSnapshot()                ← 불변 스냅샷 재빌드
  NEW →       _notifyListeners()              ← React 구독자 알림
              if (debug) _broadcast()
```

`_scheduleFlush()`의 microtask 콜백이 **단 하나의 배칭 출구**다. 이 지점에 Shadow State 로직을 삽입하면 기존 배칭 최적화를 그대로 활용하면서 불변 스냅샷을 생성할 수 있다.

---

## (b) 목표 아키텍처 설계

### Shadow State 3-계층 구조

```text
[Mutable Layer]     domainObject (원본 JS 객체, Proxy target)
                      ↑ createProxy()로 감싸짐. 직접 변이됨.

[Snapshot Layer]    #shadowCache (불변 스냅샷, Object.freeze 적용)
                      ↑ _buildSnapshot()이 매 배치마다 재생성.
                      ↑ Structural Sharing: 변경된 키만 새 참조 생성.

[Subscription Layer] #listeners (Set<Function>)
                      ↑ subscribe() / getSnapshot() — useSyncExternalStore 규약
```

### Structural Sharing 알고리즘 (depth-1)

`dirtyFields`는 이미 변경된 **최상위 키(top-level key)** 집합을 추적한다. 이를 활용해 Immer의 단순화 버전을 구현한다.

```text
_buildSnapshot() 실행 흐름

  prevSnapshot = #shadowCache
  dirtyFields  = _getDirtyFields()     (최상위 키 Set)
  currentData  = _getTarget()          (원본 객체)

  dirtyFields.size === 0 → prevSnapshot 그대로 유지 (캐시 히트, 참조 불변)

  dirtyFields.size > 0  → 새 snapshot 객체 구성:
    for key in Object.keys(currentData):
      if dirtyFields.has(key):
        val = currentData[key]
        if Array    → snapshot[key] = [...val]        ← 새 배열 참조
        if Object   → snapshot[key] = { ...val }      ← 새 객체 참조 (얕은 복사)
        if Primitive → snapshot[key] = val            ← 값 자체
      else:
        snapshot[key] = prevSnapshot[key]             ← 기존 참조 재사용 (Structural Sharing)

  #shadowCache = maybeDeepFreeze(snapshot)
```

**depth-1 Structural Sharing의 의미:**
`address.city`만 변경되면 `address` 키 전체가 얕은 복사된다. `address` 내의 `zip` 등 다른 중첩 필드는 새 참조 안에서 값은 동일하지만 오브젝트 레벨의 공유는 없다. 이것은 Immer의 전체 트리 depth-N 공유보다 단순하지만 `Object.is()` 기반의 React 리렌더링 조건은 정확히 충족한다.

---

### `useSyncExternalStore` 규약과 스냅샷 캐싱

`useSyncExternalStore`의 `getSnapshot` 콜백에는 두 가지 강제 요건이 있다.

1. **변경이 없으면 반드시 이전과 동일한 참조를 반환해야 한다.** 매번 새 객체를 반환하면 React가 무한 리렌더링 루프에 빠진다.
2. **반환값은 불변(immutable)이어야 한다.** React Compiler가 순수성(purity) 분석을 수행하는 시점에 이 스냅샷이 변이되면 예측 불가능한 렌더링 버그가 발생한다.

`#shadowCache` 설계가 이 두 요건을 모두 만족한다.

```text
getSnapshot() 동작

  changeLog 없음 (변경 이후 _buildSnapshot() 미호출)
    → return #shadowCache  (동일 참조 반환 ← 무한루프 방지)

  변경 발생 → _buildSnapshot() → 새 참조 생성 → #shadowCache 갱신
    → return #shadowCache  (새 참조 반환 ← React 리렌더링 트리거)
```

---

### `deepFreeze` 전략: 개발 환경 조건부 적용

`Object.freeze()`는 shallow freeze다. 중첩 객체까지 동결하려면 재귀 순회가 필요하고 O(n) 비용이 발생한다. **프로덕션에서는 이 비용을 지불할 이유가 없다.**

```text
maybeDeepFreeze(obj) 판단 흐름

  if (process.env.NODE_ENV !== 'production')
    → deepFreeze(obj) 호출 (WeakSet 순환 참조 방어 포함)
  else
    → obj 그대로 반환 (no-op)
```

라이브러리는 `process.env.NODE_ENV`를 교체하지 않고 그대로 번들에 포함한다. 소비자의 번들러(Vite/Webpack/Rollup)가 `define: { 'process.env.NODE_ENV': '"production"' }` 설정으로 빌드 시점에 프로덕션 분기를 정리하고, Tree-shaking으로 `deepFreeze` 코드 블록 자체를 번들에서 제거한다. 이것이 라이브러리에서 환경 분기를 처리하는 업계 표준 방식이다.

---

### React 어댑터: 프레임워크 비의존성 유지 전략

`useDomainState` 훅을 코어 패키지에 직접 포함하면 React가 런타임 의존성이 된다. 프레임워크 비의존성(Framework-Agnostic) 철학이 무너진다.

해결책: `src/adapters/react.js`를 제공하되 코어 번들에는 포함하지 않는다.

```text
소비자의 React 프로젝트에서:

  import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';

  function UserProfile({ domainState }) {
      const data = useDomainState(domainState);  // ← useSyncExternalStore 래핑
      return <div>{data.name}</div>;
  }
```

`package.json`의 `exports` 필드에 `"./adapters/react"` 서브패스를 추가하여 노출한다. React는 소비자 환경에 이미 설치되어 있으므로 `peerDependencies`로만 선언한다.

---

## (c) 변경 파일별 세부 분석

### STEP A — `src/common/freeze.js` 신규 생성

`src/common/js-object-util.js` 패턴과 일관되게 `src/common/` 레이어에 추가한다.

```javascript
/**
 * 불변성 강제 유틸리티
 *
 * Shadow State의 스냅샷 객체를 개발 환경에서 동결(freeze)하여
 * 소비자가 스냅샷을 직접 변이시키려 할 때 즉시 에러를 발생시킨다.
 *
 * ## 프로덕션 전략
 * `process.env.NODE_ENV !== 'production'` 조건 분기로 개발 환경에서만
 * 재귀 순회를 수행한다. 프로덕션에서는 no-op이며, 소비자 번들러의
 * Tree-shaking으로 해당 코드 블록이 번들에서 완전히 제거된다.
 *
 * @module common/freeze
 */

/**
 * 객체와 모든 중첩 객체를 재귀적으로 동결한다.
 *
 * `WeakSet`으로 순환 참조를 방어한다. 이미 방문한 객체는 다시 순회하지 않는다.
 * Primitive 값과 `null`은 즉시 반환한다.
 *
 * @template T
 * @param {T} obj              - 동결할 객체
 * @param {WeakSet<object>} [seen] - 순환 참조 방어용 방문 집합 (재귀 호출 시 전달)
 * @returns {T} 동결된 객체 (원본 참조 반환)
 */
export function deepFreeze(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return obj;   // 순환 참조 방어
    seen.add(obj);

    Object.freeze(obj);

    for (const key of Object.keys(obj)) {
        deepFreeze(/** @type {any} */ (obj)[key], seen);
    }

    return obj;
}

/**
 * 개발 환경에서만 `deepFreeze`를 적용한다. 프로덕션에서는 no-op.
 *
 * Shadow State의 스냅샷 생성 시 사용한다.
 * `process.env.NODE_ENV`는 소비자 번들러가 교체한다.
 *
 * @template T
 * @param {T} obj - 조건부 동결할 객체
 * @returns {T} 개발 환경이면 동결된 객체, 프로덕션이면 원본 그대로
 */
export function maybeDeepFreeze(obj) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        return deepFreeze(obj);
    }
    return obj;
}
```

---

### STEP B — `src/domain/DomainState.js` 수정 (4개 지점)

#### 수정 1. import 추가

```javascript
import { maybeDeepFreeze } from '../common/freeze.js';
```

#### 수정 2. private class fields 추가

`static #installedPlugins` 선언 바로 아래에 두 개 추가한다.

```javascript
    // ── Shadow State ─────────────────────────────────────────────────────────

    /**
     * 가장 최근 생성된 불변 스냅샷. `getSnapshot()`이 반환하는 값.
     *
     * | 상태   | 의미                                                        |
     * |--------|-------------------------------------------------------------|
     * | `null` | 인스턴스 생성 전. constructor에서 즉시 초기화됨.            |
     * | object | `_buildSnapshot()`이 생성한 동결된 스냅샷.                  |
     *
     * `dirtyFields`가 비어있으면 `_buildSnapshot()`이 이 참조를 유지한다.
     * `useSyncExternalStore`의 변경 없음 → 동일 참조 반환 규약이 이로써 보장된다.
     *
     * @type {object | null}
     */
    #shadowCache = null;

    /**
     * `subscribe()`로 등록된 외부 리스너 집합.
     * 각 리스너는 `_buildSnapshot()` 완료 후 `_notifyListeners()`가 호출한다.
     * `useSyncExternalStore`의 `subscribe` 콜백 규약을 만족한다.
     *
     * @type {Set<() => void>}
     */
    #listeners = new Set();
```

#### 수정 3. constructor에 Shadow State 초기화 추가

`this._errors = []` 직후, `if (this._debug) this._broadcast()` **직전**에 삽입한다.

```javascript
        // ── Shadow State 초기화 ───────────────────────────────────────────────
        // getSnapshot()은 항상 유효한 참조를 반환해야 한다.
        // constructor 시점에 초기 스냅샷을 반드시 생성해야 한다.
        // 이후 상태 변경 시 _buildSnapshot()이 재빌드한다.
        this.#shadowCache = maybeDeepFreeze(
            this._buildSnapshot(this._getTarget(), null)
        );
        // ──────────────────────────────────────────────────────────────────────
```

`_buildSnapshot()`을 constructor에서 호출하려면 내부 메서드로 설계해야 한다. constructor보다 메서드 선언이 아래 있어도 클래스 내에서는 참조 가능하므로 문제없다.

#### 수정 4. 공개 메서드 3개 + 내부 메서드 3개 추가

**공개 메서드** — `// ════ 외부 인터페이스 ════` 구분선 아래, `get data()` 앞에 추가한다.

```javascript
    // ── Shadow State 공개 API ─────────────────────────────────────────────────

    /**
     * 상태 변경 시 호출될 리스너를 등록한다. (`useSyncExternalStore` 규약)
     *
     * 등록된 리스너는 Proxy 변경 → microtask 배치 완료 → `_buildSnapshot()` 직후
     * `_notifyListeners()`에 의해 호출된다.
     *
     * @param {() => void} listener - 상태 변경 시 호출될 콜백. 인자를 받지 않는다.
     * @returns {() => void} 구독 해제 함수. `useSyncExternalStore`에 전달하는 cleanup.
     *
     * @example <caption>useSyncExternalStore와 직접 연결</caption>
     * const data = useSyncExternalStore(
     *     (listener) => state.subscribe(listener),
     *     () => state.getSnapshot()
     * );
     *
     * @example <caption>useDomainState 어댑터 사용 (권장)</caption>
     * import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
     * const data = useDomainState(state);
     */
    subscribe(listener) {
        this.#listeners.add(listener);
        // useSyncExternalStore는 subscribe 반환값으로 cleanup 함수를 기대한다.
        return () => this.#listeners.delete(listener);
    }

    /**
     * 가장 최근에 생성된 불변 스냅샷을 반환한다. (`useSyncExternalStore` 규약)
     *
     * ## useSyncExternalStore 규약 준수
     * - **변경이 없으면 반드시 이전과 동일한 참조를 반환한다.**
     *   매번 새 객체를 반환하면 React가 무한 리렌더링 루프에 빠진다.
     * - **반환값은 동결(freeze)된 불변 객체다.**
     *   개발 환경에서 `deepFreeze` 적용, 프로덕션에서는 no-op.
     *
     * ## Vanilla JS / Vue 환경
     * React 없이 순수 JS나 Vue 프로젝트에서도 사용할 수 있다.
     * Proxy가 아닌 순수 불변 객체가 필요한 상황이면 이 메서드를 직접 호출한다.
     *
     * @returns {Readonly<object>} 현재 상태의 불변 스냅샷. 상태 변경 시 새 참조 반환.
     *
     * @example <caption>Vanilla JS 상태 비교</caption>
     * const snap1 = state.getSnapshot();
     * state.data.name = 'Davi';
     * await Promise.resolve(); // microtask flush 대기
     * const snap2 = state.getSnapshot();
     * console.log(snap1 === snap2); // false (새 참조)
     * console.log(snap1.email === snap2.email); // true (변경 없는 키 — Structural Sharing)
     */
    getSnapshot() {
        // #shadowCache는 constructor에서 반드시 초기화되므로 null이 될 수 없다.
        return /** @type {object} */ (this.#shadowCache);
    }
```

**내부 메서드** — `// ════ 내부 유틸 메서드 ════` 구분선 안, `_assertHandler` 앞에 추가한다.

```javascript
    // ── Shadow State 내부 메서드 ──────────────────────────────────────────────

    /**
     * Structural Sharing 기반 불변 스냅샷을 빌드한다.
     *
     * ## 알고리즘 (depth-1 Structural Sharing)
     * `dirtyFields`(최상위 변경 키 집합)를 기준으로 스냅샷을 구성한다.
     * - 변경된 키: 현재 값으로 **얕은 복사**하여 새 참조 생성
     * - 변경 없는 키: 이전 스냅샷의 참조를 그대로 재사용 (메모리 공유)
     *
     * `dirtyFields`가 비어있으면 `prevSnapshot`을 그대로 반환한다.
     * 이것이 `getSnapshot()`의 "변경 없음 → 동일 참조" 규약을 보장하는 핵심이다.
     *
     * ## 타입 분기
     * - `Array`: `[...val]` — 새 배열 참조, 요소는 얕은 복사
     * - plain `Object`: `{ ...val }` — 새 객체 참조, 중첩 객체는 얕은 복사
     * - Primitive / `Date` / `Map` / `Set` 등: 값 그대로 할당
     *   (Date/Map/Set는 참조 타입이지만 복사 없이 공유. 현 VO 레이어에서 사용 빈도 낮음)
     *
     * @param {object}        currentData  - `_getTarget()`으로 얻은 원본 객체
     * @param {object | null} prevSnapshot - 이전 스냅샷. 최초 호출 시 `null`.
     * @returns {object} 새로 생성된 스냅샷 객체 (freeze 전 단계)
     */
    _buildSnapshot(currentData, prevSnapshot) {
        const dirtyFields = this._getDirtyFields();

        // 변경 없음 → 이전 스냅샷 재사용 (참조 동일성 유지)
        if (prevSnapshot !== null && dirtyFields.size === 0) {
            return prevSnapshot;
        }

        const snapshot = /** @type {Record<string, unknown>} */ ({});
        const keys = Object.keys(currentData);

        for (const key of keys) {
            if (prevSnapshot === null || dirtyFields.has(key)) {
                // 변경된 키 또는 최초 스냅샷: 현재 값으로 새 참조 생성
                const val = /** @type {any} */ (currentData)[key];

                if (Array.isArray(val)) {
                    snapshot[key] = [...val];
                } else if (val !== null && typeof val === 'object') {
                    snapshot[key] = { ...val };
                } else {
                    snapshot[key] = val;
                }
            } else {
                // 변경 없는 키: 이전 스냅샷 참조 재사용 (Structural Sharing)
                snapshot[key] = /** @type {Record<string, unknown>} */ (prevSnapshot)[key];
            }
        }

        return snapshot;
    }

    /**
     * `#listeners` 집합에 등록된 모든 리스너를 동기적으로 호출한다.
     *
     * `_scheduleFlush()`의 microtask 콜백에서 `_buildSnapshot()` 직후 호출된다.
     * 리스너 호출 중 발생하는 에러는 개별 리스너로 격리하여 나머지 리스너 실행에 영향을 주지 않는다.
     *
     * @returns {void}
     */
    _notifyListeners() {
        for (const listener of this.#listeners) {
            try {
                listener();
            } catch (err) {
                // 리스너 에러를 격리한다. 나머지 리스너 실행 및 디버그 채널 전파에 영향 없음.
                console.error('[DSM] subscribe 리스너 실행 중 에러 발생:', err);
            }
        }
    }
```

#### 수정 5. `_scheduleFlush()` 내부 microtask 콜백 수정

```javascript
    _scheduleFlush() {
        if (this._pendingFlush) return;
        this._pendingFlush = true;

        queueMicrotask(() => {
            this._pendingFlush = false;

            // ── Shadow State 갱신 ──────────────────────────────────────────
            // 배칭이 완료된 시점(동기 블록 종료 후)에 한 번만 스냅샷을 재빌드한다.
            // 이 순서가 중요하다: 스냅샷 빌드 → 리스너 알림 → 디버그 채널
            const newSnapshot = this._buildSnapshot(this._getTarget(), this.#shadowCache);
            if (newSnapshot !== this.#shadowCache) {
                // 실제로 새 스냅샷이 생성된 경우에만 캐시를 업데이트한다.
                // (dirtyFields가 비어있으면 _buildSnapshot이 prevSnapshot을 그대로 반환)
                this.#shadowCache = maybeDeepFreeze(newSnapshot);
            }
            this._notifyListeners();
            // ──────────────────────────────────────────────────────────────

            if (this._debug) this._broadcast();
        });
    }
```

---

### STEP C — `src/adapters/react.js` 신규 생성

```javascript
/**
 * DomainState — React 어댑터
 *
 * `useSyncExternalStore`를 통해 `DomainState`의 Shadow State를 React 렌더링 사이클에
 * 연결하는 커스텀 훅을 제공한다.
 *
 * ## 사용 조건
 * - React 18 이상이 `peerDependencies`로 설치되어 있어야 한다.
 * - 이 파일은 코어 라이브러리 번들에 포함되지 않는다.
 *   `@2davi/rest-domain-state-manager/adapters/react` 서브패스로 별도 import한다.
 *
 * ## Framework-Agnostic 철학 준수
 * `subscribe()`와 `getSnapshot()`은 코어 `DomainState`의 공개 메서드다.
 * React가 없는 환경에서도 Vanilla JS / Vue에서 직접 사용 가능하다.
 * 이 파일은 단지 `useSyncExternalStore` 래핑의 편의를 제공할 뿐이다.
 *
 * @module adapters/react
 * @see {@link https://react.dev/reference/react/useSyncExternalStore React 공식 — useSyncExternalStore}
 * @see {@link https://valtio.dev/docs/api/basic/useSnapshot Valtio useSnapshot 참조 구현}
 */

import { useSyncExternalStore } from 'react';

/**
 * `DomainState`의 Shadow State 스냅샷을 React 컴포넌트에 연결하는 커스텀 훅.
 *
 * 내부적으로 `useSyncExternalStore`를 사용한다.
 * `DomainState.data`의 변이를 감지하여 컴포넌트를 리렌더링한다.
 *
 * ## 동작 원리
 * 1. `DomainState.data.name = 'Davi'` — Proxy set 트랩 발화
 * 2. microtask 배칭 완료 → `_buildSnapshot()` → 새 참조 `#shadowCache` 생성
 * 3. `_notifyListeners()` → React가 `getSnapshot()`을 호출
 * 4. 이전 스냅샷과 `Object.is()` 비교 → 다른 참조 → 리렌더링 트리거
 *
 * @param {import('../domain/DomainState.js').DomainState} domainState - 구독할 DomainState 인스턴스
 * @returns {Readonly<object>} 현재 상태의 불변 스냅샷. 변경 시 새 참조.
 *
 * @example <caption>기본 사용</caption>
 * import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
 *
 * function UserProfile({ userState }) {
 *     const data = useDomainState(userState);
 *     return <div>{data.name}</div>;
 * }
 *
 * @example <caption>이벤트 핸들러에서 data 변이</caption>
 * function UserForm({ userState }) {
 *     const data = useDomainState(userState);
 *
 *     const handleChange = (e) => {
 *         userState.data[e.target.name] = e.target.value;
 *         // microtask 배칭 완료 후 자동 리렌더링
 *     };
 *
 *     return <input name="name" value={data.name} onChange={handleChange} />;
 * }
 */
export function useDomainState(domainState) {
    return useSyncExternalStore(
        // subscribe: 리스너 등록, 반환값은 cleanup 함수
        (listener) => domainState.subscribe(listener),
        // getSnapshot: 현재 불변 스냅샷 반환
        () => domainState.getSnapshot()
    );
}
```

---

### STEP D — `package.json` `exports` 필드 서브패스 추가

`"./adapters/react"` 서브패스를 `exports`에 추가한다. React는 소비자 환경에 설치된 것을 사용하므로 `peerDependencies`로만 선언한다.

```json
"exports": {
    ".": {
        "types":   "./dist/index.d.ts",
        "import":  "./dist/index.mjs",
        "require": "./dist/cjs/index.cjs"
    },
    "./adapters/react": {
        "types":   "./dist/src/adapters/react.d.ts",
        "import":  "./dist/src/adapters/react.mjs",
        "require": "./dist/cjs/src/adapters/react.cjs"
    }
},
"peerDependencies": {
    "react": ">=18.0.0"
},
"peerDependenciesMeta": {
    "react": {
        "optional": true
    }
}
```

`react`를 `optional: true`로 선언하는 이유 — 이 라이브러리는 프레임워크 비의존성이 핵심이다. React 없이도 사용 가능해야 하므로 peer dependency를 선택적으로 선언한다.

---

## (d) 예상 시나리오

### 시나리오 1. React 컴포넌트 리렌더링 흐름

```text
[컴포넌트 마운트]
  useDomainState(userState) 호출
    └─ useSyncExternalStore 내부:
         subscribe(listener) → #listeners에 React의 forceUpdate 등록
         getSnapshot() → #shadowCache 반환 (초기 스냅샷)
         React가 data = { userId: 'u1', name: 'Davi', ... } 렌더링

[사용자 이벤트]
  userState.data.name = 'Lee'
    └─ Proxy set 트랩: changeLog에 replace 기록, dirtyFields.add('name')
    └─ onMutate() → _scheduleFlush() → pendingFlush = true

  userState.data.email = 'lee@ex.com'
    └─ Proxy set 트랩: 기록
    └─ onMutate() → _scheduleFlush() → pendingFlush이므로 건너뜀 (배칭)

[microtask 실행]
  pendingFlush = false
  _buildSnapshot() 실행:
    dirtyFields = Set { 'name', 'email' }
    snapshot.userId  = prevSnapshot.userId  (재사용 — Structural Sharing)
    snapshot.name    = 'Lee'                (새 값)
    snapshot.email   = 'lee@ex.com'         (새 값)
    snapshot.role    = prevSnapshot.role    (재사용)
    snapshot.address = { ...currentAddress } (address가 dirty하면 새 참조)
  #shadowCache = maybeDeepFreeze(snapshot)  ← 새 참조!
  _notifyListeners() → React의 forceUpdate 호출

[React 리렌더링]
  getSnapshot() → 새 #shadowCache 반환
  Object.is(prevSnap, newSnap) → false → 리렌더링 트리거
  컴포넌트 data.name = 'Lee', data.email = 'lee@ex.com' 반영
```

### 시나리오 2. Structural Sharing으로 불필요한 자식 리렌더링 방지

```text
React 컴포넌트 트리:

  <UserCard data={data} />
    ├─ <NameField   name={data.name} />     ← name 변경 시 리렌더링
    ├─ <EmailField  email={data.email} />   ← email 변경 시 리렌더링
    └─ <AddressBox  addr={data.address} />  ← address 미변경 시 스킵

data.name = 'Lee' 후 스냅샷:
  data.address === prevData.address  (동일 참조!)
  → React.memo / useMemo → AddressBox 리렌더링 건너뜀
```

### 시나리오 3. 변경 없는 `getSnapshot()` 호출 — 무한루프 방지

```text
React Concurrent Mode에서는 getSnapshot()을 여러 번 호출할 수 있다.
변경이 없으면 반드시 동일 참조를 반환해야 한다.

dirtyFields.size === 0 상태에서 getSnapshot() 연속 호출:
  1회: return #shadowCache  (참조 A)
  2회: return #shadowCache  (참조 A) ← 동일
  3회: return #shadowCache  (참조 A) ← 동일
  Object.is(A, A) → true → 리렌더링 없음 → 무한루프 방지
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일 | 변경 종류 | 변경 내용 |
|---|---|---|
| `src/common/freeze.js` | **신규 생성** | `deepFreeze(obj, seen)`, `maybeDeepFreeze(obj)` |
| `src/adapters/react.js` | **신규 생성** | `useDomainState(domainState)` React 커스텀 훅 |
| `src/domain/DomainState.js` | **수정** | `import freeze`, `#shadowCache` + `#listeners` 추가, constructor 초기화, `subscribe()` + `getSnapshot()` 공개 메서드, `_buildSnapshot()` + `_notifyListeners()` 내부 메서드, `_scheduleFlush()` 수정 |
| `package.json` | **수정** | `exports["./adapters/react"]` 서브패스 추가, `peerDependencies.react` 추가 |
| `index.js` | **수정** | `useDomainState` 모듈 JSDoc 주석에 어댑터 서브패스 안내 추가 |
| `test/domain/DomainState.test.js` | **수정** | Shadow State 관련 테스트 케이스 추가 |

### Feature 브랜치명

```text
feature/shadow-state
```

`subscribe()` / `getSnapshot()` 두 공개 API가 신규 추가되므로 `feature/`. semantic-release 기준 minor 버전 +1.

### Commit Sequence

```markdown
# STEP A — freeze 유틸리티 모듈 신규 생성
feat(common): add deepFreeze and maybeDeepFreeze utility for immutable snapshots

  - src/common/freeze.js 신규 생성
  - deepFreeze(): WeakSet 순환 참조 방어 포함한 재귀 동결
  - maybeDeepFreeze(): process.env.NODE_ENV !== 'production' 조건부 적용
  - 소비자 번들러의 Tree-shaking으로 프로덕션 빌드에서 코드 블록 제거


# STEP B — DomainState Shadow State 핵심 구현
feat(domain): implement Shadow State with structural sharing and subscriber API

  - #shadowCache private class field 추가: 불변 스냅샷 캐시
  - #listeners private class field 추가: 외부 리스너 Set
  - constructor: 인스턴스 생성 시 초기 스냅샷 빌드
  - subscribe(listener): 리스너 등록, cleanup 함수 반환 (useSyncExternalStore 규약)
  - getSnapshot(): #shadowCache 반환, 변경 없으면 동일 참조 보장
  - _buildSnapshot(): depth-1 Structural Sharing 알고리즘 구현
  - _notifyListeners(): 리스너 격리 실행 (에러 전파 차단)
  - _scheduleFlush(): _buildSnapshot → _notifyListeners → _broadcast 순서 확정
  - import maybeDeepFreeze from common/freeze.js


# STEP C — React 어댑터 및 패키지 서브패스 노출
feat(adapters): add useDomainState React hook via subpath export

  - src/adapters/react.js 신규 생성: useSyncExternalStore 래핑 훅
  - package.json: exports["./adapters/react"] 서브패스 추가
  - package.json: peerDependencies.react >= 18.0.0 (optional) 추가
  - index.js: 모듈 JSDoc에 어댑터 서브패스 import 안내 추가


# STEP D — Vitest 단위 테스트 추가
test(domain): add Shadow State subscribe/getSnapshot/structural-sharing test cases

  - subscribe(): 리스너 등록 후 data 변경 시 호출 확인
  - subscribe() 반환 함수: 호출 후 리스너 해제 확인
  - getSnapshot(): 변경 없으면 동일 참조 반환 확인
  - getSnapshot(): 변경 후 새 참조 반환 확인
  - Structural Sharing: 변경된 키만 새 참조, 미변경 키는 동일 참조 확인
  - maybeDeepFreeze: 개발 환경에서 스냅샷이 동결(frozen)되는지 확인
  - 리스너 에러 격리: 하나의 리스너 에러가 다른 리스너 실행을 막지 않음 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목 | 기준 |
|---|---|
| `npm run lint` | error 0건 |
| `npm test` | 전체 테스트 통과 (기존 회귀 없음) |
| `subscribe()` | 리스너 등록 후 data 변경 시 microtask 후 호출됨 확인 |
| `subscribe()` cleanup | 반환 함수 호출 후 리스너 미발화 확인 |
| `getSnapshot()` 캐시 히트 | 변경 없을 때 동일 참조 반환 (`===`) |
| `getSnapshot()` 새 참조 | data 변경 → microtask flush → 새 참조 반환 |
| Structural Sharing | 변경된 최상위 키만 새 참조, 미변경 키는 이전 스냅샷 참조 공유 |
| `deepFreeze` | 개발 환경에서 스냅샷 모든 중첩 객체가 `Object.isFrozen() === true` |
| 리스너 에러 격리 | 리스너 1개 에러 시 나머지 리스너 정상 실행 |
| `exports["./adapters/react"]` | `import { useDomainState } from '.../adapters/react'` 정상 import |
