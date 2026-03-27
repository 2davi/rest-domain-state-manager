// src/adapters/react.js

/**
 * DomainState — React 어댑터
 *
 * `useSyncExternalStore`를 통해 `DomainState`의 Shadow State를
 * React 렌더링 사이클에 연결하는 커스텀 훅을 제공한다.
 *
 * ## 사용 조건
 * React 18 이상이 설치되어 있어야 한다.
 * 이 파일은 코어 번들에 포함되지 않는다.
 * `@2davi/rest-domain-state-manager/adapters/react` 서브패스로 별도 import한다.
 *
 * ## Framework-Agnostic 철학 준수
 * `subscribe()` / `getSnapshot()`은 코어 `DomainState`의 공개 메서드다.
 * React 없이 Vanilla JS / Vue에서도 직접 사용 가능하다.
 * 이 파일은 `useSyncExternalStore` 래핑의 편의를 제공할 뿐이다.
 *
 * @module adapters/react
 * @see {@link https://react.dev/reference/react/useSyncExternalStore useSyncExternalStore}
 */

import { useSyncExternalStore } from 'react';

/**
 * `DomainState`의 불변 스냅샷을 React 컴포넌트에 연결하는 커스텀 훅.
 *
 * 내부적으로 `useSyncExternalStore`를 사용한다.
 * `DomainState.data`의 변이가 감지되면 컴포넌트를 리렌더링한다.
 *
 * ## 동작 원리
 * 1. `state.data.name = 'Davi'` — Proxy set 트랩 발화
 * 2. microtask 배칭 완료 → `_buildSnapshot()` → 새 `#shadowCache` 참조
 * 3. `_notifyListeners()` → React가 `getSnapshot()` 재호출
 * 4. `Object.is(prev, next)` → 다른 참조 → 리렌더링 트리거
 *
 * @param {import('../domain/DomainState.js').DomainState} domainState
 *   구독할 DomainState 인스턴스
 * @returns {Readonly<object>} 현재 상태의 불변 스냅샷. 변경 시 새 참조 반환.
 *
 * @example <caption>기본 사용</caption>
 * import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
 *
 * function UserProfile({ userState }) {
 *     const data = useDomainState(userState);
 *     return <div>{data.name}</div>;
 * }
 *
 * @example <caption>이벤트 핸들러에서 변이 후 자동 리렌더링</caption>
 * function UserForm({ userState }) {
 *     const data = useDomainState(userState);
 *
 *     const handleChange = (e) => {
 *         // Proxy 변이 → microtask 배칭 → 리렌더링 자동 트리거
 *         userState.data[e.target.name] = e.target.value;
 *     };
 *
 *     return <input name="name" value={data.name} onChange={handleChange} />;
 * }
 */
export function useDomainState(domainState) {
    return useSyncExternalStore(
        /** @param {() => void} listener */
        (listener) => domainState.subscribe(listener),
        ()         => domainState.getSnapshot()
    );
}