/**
 * Playground용 Mock ApiHandler
 *
 * 실제 네트워크 요청 없이 DomainState의 동작을 시뮬레이션하기 위한
 * 가짜 핸들러 구현체. VitePress Playground 컴포넌트에서 전용으로 사용한다.
 *
 * DomainState가 내부적으로 호출하는 `_fetch(url, options)` 시그니처와
 * `getUrlConfig()`, `isDebug()` 인터페이스를 그대로 구현한다.
 */
export class MockApiHandler {
    /**
     * @param {object} [initialData={}]   - 서버에 저장된 것으로 가정할 초기 데이터
     * @param {object} [options={}]       - 동작 제어 옵션
     * @param {number} [options.latency=400]     - 가짜 네트워크 지연 (ms)
     * @param {boolean} [options.shouldFail=false] - true이면 모든 요청을 실패로 처리
     * @param {number} [options.failStatus=409]    - 실패 시 HTTP 상태 코드
     */
    constructor(initialData = {}, options = {}) {
        this._data       = structuredClone(initialData)
        this._latency    = options.latency    ?? 400
        this._shouldFail = options.shouldFail ?? false
        this._failStatus = options.failStatus ?? 409
        this._lastCall   = null   // 마지막 요청 정보 기록 (Playground 시각화용)
    }

    /**
     * DomainState 내부에서 호출하는 실제 fetch 진입점.
     * 지연 후 성공 또는 실패를 시뮬레이션한다.
     */
    async _fetch(url, options = {}) {
        // 마지막 요청 기록 (Playground에서 어떤 메서드가 선택됐는지 표시용)
        this._lastCall = {
            url,
            method:    options.method ?? 'GET',
            body:      options.body   ?? null,
            timestamp: Date.now(),
        }

        await new Promise(r => setTimeout(r, this._latency))

        if (this._shouldFail) {
            throw {
                status:     this._failStatus,
                statusText: this._failStatus === 409 ? 'Conflict'   :
                            this._failStatus === 404 ? 'Not Found'  :
                            this._failStatus === 500 ? 'Server Error' : 'Error',
                body: JSON.stringify({ message: 'Simulated server error' }),
            }
        }

        // DELETE는 본문 없이 반환
        if (options.method === 'DELETE') return null

        return structuredClone(this._data)
    }

    /** DomainState가 URL 빌드에 사용하는 설정 */
    getUrlConfig() {
        return { protocol: 'http://', host: 'api.example.dev', basePath: '' }
    }

    isDebug() { return false }

    // ── Playground 제어 메서드 ──────────────────────────────

    /** 성공/실패 모드를 런타임에 전환 */
    setFailMode(shouldFail, status = 409) {
        this._shouldFail = shouldFail
        this._failStatus = status
    }

    /** 네트워크 지연 시간 변경 */
    setLatency(ms) {
        this._latency = ms
    }

    /** 서버 데이터 갱신 (POST 성공 시뮬레이션 등에 사용) */
    updateServerData(data) {
        this._data = structuredClone(data)
    }

    /** 마지막 요청 정보 반환 */
    getLastCall() {
        return this._lastCall
    }
}
