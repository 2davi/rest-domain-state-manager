/**
 * `BroadcastChannel`을 명시적으로 닫고 내부 참조를 해제한다.
 *
 * SPA(Single Page Application) 환경에서 라우트 이동이나 컴포넌트 언마운트 시
 * 이 함수를 호출하여 채널 객체가 GC 대상이 되도록 해야 한다.
 *
 * 채널이 닫히기 전에 `TAB_UNREGISTER` 메시지를 한 번 전송하여
 * 팝업이 즉시 이 탭을 레지스트리에서 제거할 수 있도록 한다.
 *
 * `_channel`이 이미 `null`이면 아무 동작도 하지 않는다.
 *
 * @returns {void}
 *
 * @example <caption>SPA 라우트 언마운트 시 호출</caption>
 * import { closeDebugChannel } from './rest-domain-state-manager.js';
 *
 * // Vue 3 / React의 cleanup 훅에서:
 * onUnmounted(() => closeDebugChannel());
 * useEffect(() => () => closeDebugChannel(), []);
 */
export function closeDebugChannel(): void;
/**
 * `DomainState`의 상태 변경을 채널에 broadcast하고 `_stateRegistry`를 갱신한다.
 *
 * `DomainState._broadcast()` 내부에서 호출된다.
 * `debug: true`인 인스턴스가 생성될 때, 필드가 변경될 때, `save()` 성공 후 호출된다.
 *
 * 채널이 `null`이면 (BroadcastChannel 미지원 환경) 메시지 전송을 건너뛰지만
 * `_stateRegistry` 갱신은 수행한다.
 *
 * @param {string}            label    - `DomainState`의 식별 레이블
 * @param {BroadcastSnapshot} snapshot - 현재 상태 스냅샷 (`data`, `changeLog`, `isNew`, `errors`)
 * @returns {void}
 *
 * @example <caption>DomainState._broadcast() 내부에서의 호출</caption>
 * // DomainState 내부:
 * _broadcast() {
 *     broadcastUpdate(this._label, {
 *         data:      this._getTarget(),
 *         changeLog: this._getChangeLog(),
 *         isNew:     this._isNew,
 *         errors:    this._errors,
 *     });
 * }
 */
export function broadcastUpdate(label: string, snapshot: BroadcastSnapshot): void;
/**
 * `DomainPipeline`의 `after()` 핸들러 실패를 채널에 broadcast한다.
 *
 * `DomainPipeline.run()` 내부에서 `after()` 핸들러가 throw할 때 호출된다.
 * 팝업은 이 메시지를 수신하여 해당 탭의 에러 목록에 추가하고 UI를 갱신한다.
 *
 * 채널이 `null`이면 아무 동작도 하지 않는다.
 *
 * @param {string} key   - 실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)
 * @param {*}      error - throw된 에러 값 (모든 타입 허용, `String()`으로 직렬화됨)
 * @returns {void}
 *
 * @example <caption>DomainPipeline.run() 내부에서의 호출</caption>
 * try {
 *     await handler(state);
 * } catch (err) {
 *     broadcastError(key, err); // 팝업에 에러 전파
 *     if (this._strict) throw err;
 * }
 */
export function broadcastError(key: string, error: any): void;
/**
 * 디버그 팝업 창을 열거나, 이미 열려있으면 포커스한다.
 *
 * `DomainState.openDebugger()` 호출 시 실행된다. (`debug: true` 시만 호출)
 *
 * ## 동작 흐름
 * 1. `window.open()`으로 팝업을 열거나 기존 창에 포커스한다.
 * 2. 팝업 내 `#dsm-root` 요소 존재 여부로 초기화 여부를 판단한다.
 * 3. 초기화되지 않은 경우: `_buildPopupHTML()`로 생성한 HTML을 주입한다.
 * 4. 팝업 `load` 이벤트 후 `_initPopupChannel()`로 채널을 연결한다.
 *    (현재 팝업 내부 스크립트가 자체적으로 채널을 처리하므로 실질적으로는 No-op)
 *
 * 팝업 차단으로 `window.open()`이 `null`을 반환하면 콘솔 경고 후 조기 반환한다.
 *
 * @returns {void}
 *
 * @example <caption>DomainState에서 호출</caption>
 * const user = DomainState.fromVO(new UserVO(), api, { debug: true, label: 'User' });
 * user.openDebugger(); // → openDebugPopup() 내부 호출
 */
export function openDebugPopup(): void;
/**
 * 채널을 통해 전송되는 메시지 타입 식별자.
 * `channel.const.js`의 `MSG_TYPE` 상수값과 일치한다.
 */
export type DebugMessageType = "TAB_REGISTER" | "TAB_UNREGISTER" | "TAB_PING" | "DS_UPDATE" | "DS_ERROR";
/**
 * `TAB_REGISTER` 메시지 구조.
 * 각 탭이 팝업의 `TAB_PING`에 응답하거나 로드 직후 자기 등록 시 전송한다.
 */
export type TabRegisterMessage = {
    /**
     * - 메시지 타입
     */
    type: "TAB_REGISTER";
    /**
     * - 이 탭의 고유 ID (`dsm_{timestamp}_{random}` 형식)
     */
    tabId: string;
    /**
     * - 이 탭의 현재 URL (`location.href`)
     */
    tabUrl: string;
    /**
     * - 이 탭의 모든 DomainState 스냅샷 맵
     */
    states: Record<string, DomainStateSnapshot>;
};
/**
 * `TAB_UNREGISTER` 메시지 구조.
 * 탭이 닫히거나 `closeDebugChannel()` 호출 시 전송한다.
 */
export type TabUnregisterMessage = {
    /**
     * - 메시지 타입
     */
    type: "TAB_UNREGISTER";
    /**
     * - 해제할 탭의 고유 ID
     */
    tabId: string;
};
/**
 * `DS_UPDATE` 메시지 구조.
 * `DomainState._broadcast()` 호출 시 전송된다.
 */
export type DsUpdateMessage = {
    /**
     * - 메시지 타입
     */
    type: "DS_UPDATE";
    /**
     * - 전송 탭의 고유 ID
     */
    tabId: string;
    /**
     * - 전송 탭의 현재 URL
     */
    tabUrl: string;
    /**
     * - 변경된 `DomainState`의 식별 레이블
     */
    label: string;
    /**
     * - 변경 직후 스냅샷
     */
    snapshot: DomainStateSnapshot;
};
/**
 * `DS_ERROR` 메시지 구조.
 * `DomainPipeline` 내 `after()` 핸들러 실패 시 전송된다.
 */
export type DsErrorMessage = {
    /**
     * - 메시지 타입
     */
    type: "DS_ERROR";
    /**
     * - 전송 탭의 고유 ID
     */
    tabId: string;
    /**
     * - 전송 탭의 현재 URL
     */
    tabUrl: string;
    /**
     * - 실패한 리소스 키 (`DomainPipeline` `resourceMap`의 키)
     */
    key: string;
    /**
     * - `String(error)` 직렬화된 에러 메시지
     */
    error: string;
};
/**
 * `_stateRegistry`에 저장되는 `DomainState` 스냅샷.
 * `broadcastUpdate()` 호출 시 생성된다.
 */
export type DomainStateSnapshot = {
    /**
     * - `DomainState`의 식별 레이블
     */
    label: string;
    /**
     * - `DomainState._getTarget()` 결과 (원본 객체)
     */
    data: object;
    /**
     * - 현재 변경 이력
     */
    changeLog: import("../core/api-proxy.js").ChangeLogEntry[];
    /**
     * - 신규 리소스 여부
     */
    isNew: boolean;
    /**
     * - 인스턴스 수준 에러 목록
     */
    errors: Array<any>;
};
/**
 * `broadcastUpdate()` 의 `snapshot` 파라미터 타입.
 * `DomainState._broadcast()` 에서 구성하여 전달한다.
 */
export type BroadcastSnapshot = {
    /**
     * - `DomainState._getTarget()` 결과
     */
    data: object;
    /**
     * - 현재 변경 이력
     */
    changeLog: import("../core/api-proxy.js").ChangeLogEntry[];
    /**
     * - 신규 리소스 여부
     */
    isNew: boolean;
    /**
     * - 인스턴스 수준 에러 목록
     */
    errors: Array<any>;
};
