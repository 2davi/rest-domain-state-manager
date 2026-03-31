/**
 * Playground용 Mock ApiHandler
 *
 * 실제 네트워크 없이 DomainState 동작을 시뮬레이션하는 가짜 핸들러.
 * VitePress Playground 컴포넌트 전용.
 *
 * DomainState가 내부적으로 호출하는 인터페이스를 그대로 구현한다:
 * - `_fetch(url, options)`  — save() / remove() 내부에서 위임 호출
 * - `getUrlConfig()`        — URL 빌드에 사용
 * - `isDebug()`             — 디버그 플래그 노출
 */
export class MockApiHandler {
    /**
     * @param {object} [initialData={}]          - 서버에 저장된 초기 데이터
     * @param {object} [options={}]
     * @param {number}  [options.latency=400]    - 가짜 네트워크 지연 (ms)
     * @param {boolean} [options.shouldFail=false]
     * @param {number}  [options.failStatus=409]
     */
    constructor(initialData = {}, options = {}) {
        this._data       = structuredClone(initialData)
        this._latency    = options.latency    ?? 400
        this._shouldFail = options.shouldFail ?? false
        this._failStatus = options.failStatus ?? 409
        /** @type {{ url: string, method: string, body: string|null, headers: object, timestamp: number }|null} */
        this._lastCall   = null
    }

    /**
     * DomainState 내부에서 호출하는 fetch 진입점.
     * 지연 후 성공 또는 실패를 시뮬레이션한다.
     *
     * GET 응답: JSON 문자열 반환 (ApiHandler.get()이 DomainState.fromJSON(text)에 넘기는 형식)
     * DELETE 응답: null 반환 (204 No Content 시뮬레이션)
     * POST/PUT/PATCH 응답: null 반환 (save()는 반환값을 사용하지 않음)
     *
     * @param {string}      url
     * @param {RequestInit} [options={}]
     * @returns {Promise<string|null>}
     */
    async _fetch(url, options = {}) {
        this._lastCall = {
            url,
            method:    (options.method ?? 'GET').toUpperCase(),
            body:      options.body ?? null,
            headers:   options.headers ?? {},
            timestamp: Date.now(),
        }

        await new Promise(r => setTimeout(r, this._latency))

        if (this._shouldFail) {
            const statusText =
                this._failStatus === 409 ? 'Conflict'    :
                this._failStatus === 404 ? 'Not Found'   :
                this._failStatus === 500 ? 'Server Error' : 'Error'
            throw { status: this._failStatus, statusText, body: '{"message":"Simulated error"}' }
        }

        if (this._lastCall.method === 'DELETE') return null
        if (this._lastCall.method === 'GET')    return JSON.stringify(this._data)

        // POST / PUT / PATCH — save()는 반환값을 사용하지 않는다
        return null
    }

    getUrlConfig() {
        return { protocol: 'http://', host: 'api.example.dev', basePath: '' }
    }

    isDebug() { return false }

    // ── Playground 제어 메서드 ──────────────────────────────────

    setFailMode(shouldFail, status = 409) {
        this._shouldFail = shouldFail
        this._failStatus = status
    }

    setLatency(ms) { this._latency = ms }

    updateServerData(data) { this._data = structuredClone(data) }

    /** 마지막 요청 정보 반환. monkey-patching 없이 메서드/헤더/payload를 확인한다. */
    getLastCall() { return this._lastCall }
}
