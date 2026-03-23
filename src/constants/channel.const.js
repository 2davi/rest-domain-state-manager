/**
 * 디버그 BroadcastChannel 통신 상수
 *
 * 라이브러리 내 모든 탭이 동일한 채널명으로 구독/발행하여
 * 디버그 팝업과 실시간 상태를 공유한다.
 *
 * @module constants/channel.const
 * @see https://developer.mozilla.org/ko/docs/Web/API/BroadcastChannel
 */

/**
 * DEBUG_CHANNEL_NAME : 디버그 BroadcastChannel 채널명
 * 같은 출처(Origin)의 모든 탭/팝업이 이 이름으로 연결된다.
 * @type {string}
 */
export const DEBUG_CHANNEL_NAME = 'dsm_debug';

/**
 * MSG_TYPE : 디버그 채널 메시지 타입 상수
 *
 * TAB_REGISTER   : 탭 열림 또는 팝업 ping에 대한 응답으로 재등록
 * TAB_UNREGISTER : 탭 닫힘 (beforeunload에서 전송)
 * TAB_PING       : 팝업이 열릴 때 전체 탭에 재등록 요청
 * DS_UPDATE      : DomainState 변경 시 스냅샷 전송
 * DS_ERROR       : after() 핸들러 실패 알림
 *
 * @readonly
 * @enum {string}
 */
export const MSG_TYPE = Object.freeze({
    TAB_REGISTER: 'TAB_REGISTER',
    TAB_UNREGISTER: 'TAB_UNREGISTER',
    TAB_PING: 'TAB_PING',
    DS_UPDATE: 'DS_UPDATE',
    DS_ERROR: 'DS_ERROR',
});

/**
 * DEBUG_POPUP_NAME : 팝업 창 이름 (window.open 시 중복 방지용)
 * @type {string}
 */
export const DEBUG_POPUP_NAME = 'dsm_debugger';

/**
 * DEBUG_POPUP_FEATURES : 팝업 창 크기 및 위치 옵션
 * @type {string}
 */
export const DEBUG_POPUP_FEATURES = 'width=520,height=700,resizable=yes,scrollbars=yes';
