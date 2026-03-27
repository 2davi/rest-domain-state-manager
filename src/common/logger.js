/* global process */

/**
 * 라이브러리 전역 로그 제어 모듈
 *
 * `DomainState.configure({ silent: true })`를 통해 모든 내부 로그를 억제할 수 있다.
 * 모듈 레벨 클로저 변수로 상태를 관리하여 외부에서 직접 접근을 차단한다.
 *
 * ## 로그 레벨 분류 체계
 *
 * | 함수         | 발화 조건                              | 용도                         |
 * |--------------|----------------------------------------|------------------------------|
 * | `devWarn`    | 개발 환경 + silent 아님                | Extra Keys 등 정보성 경고    |
 * | `logError`   | silent 아님 (환경 무관)                | Missing Keys 등 기능 이상    |
 *
 * `silent: true` 설정 시 두 함수 모두 억제된다.
 *
 * @module common/logger
 */

/**
 * 모든 내부 로그를 억제하는 silent 플래그.
 * `setSilent()`를 통해서만 변경된다.
 *
 * @type {boolean}
 */
let _silent = false;

/**
 * silent 플래그를 설정한다.
 * `DomainState.configure({ silent })` 내부에서만 호출되어야 한다.
 *
 * @param {boolean} value - `true`이면 모든 내부 로그 억제
 * @returns {void}
 */
export function setSilent(value) {
    _silent = !!value;
}

/**
 * 현재 silent 플래그를 반환한다.
 * 테스트 환경에서 상태 확인용으로 사용할 수 있다.
 *
 * @returns {boolean}
 */
export function isSilent() {
    return _silent;
}

/**
 * 개발 환경에서만 `console.warn`을 발화한다. `silent: true`이면 억제된다.
 *
 * Extra Keys 감지처럼 기능에 영향이 없는 정보성 경고에 사용한다.
 *
 * ## 프로덕션 Tree-shaking 전략
 * `process.env.NODE_ENV`를 소비자 번들러(Rollup/Vite/Webpack)가
 * `'production'`으로 치환하면 이 함수 내부의 `if` 블록이 `if (false)` 형태가 되어
 * Dead Code Elimination으로 번들에서 완전히 제거된다.
 *
 * `typeof process !== 'undefined'` 가드는 브라우저 순수 ESM 환경에서
 * 번들러 define이 적용되기 전 `process` 미존재로 인한 ReferenceError를 방어한다.
 *
 * @param {string} message - 출력할 경고 메시지
 * @returns {void}
 */
export function devWarn(message) {
    if (_silent) return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
    console.warn(message);
}

/**
 * 환경 무관하게 `console.error`를 발화한다. `silent: true`이면 억제된다.
 *
 * Missing Keys 감지처럼 기능 이상을 의미하는 오류에 사용한다.
 * 소비자가 명시적으로 `silent: true`를 설정한 경우에만 억제되며,
 * 그 외에는 NODE_ENV와 무관하게 항상 출력된다.
 *
 * @param {string} message - 출력할 에러 메시지
 * @returns {void}
 */
export function logError(message) {
    if (_silent) return;
    console.error(message);
}