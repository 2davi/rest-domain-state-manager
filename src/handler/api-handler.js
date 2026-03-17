/**
 * @fileoverview ApiHandler — HTTP 전송 레이어
 *
 * fetch() 위의 얇은 래퍼로, 다음을 담당한다.
 *   - URL 설정(normalizeUrlConfig) 중앙 관리
 *   - 공통 헤더 (Content-Type: application/json)
 *   - response.ok 검사 → 구조화된 에러 throw
 *   - GET 응답을 DomainState로 직접 반환
 *
 * 외부 개발자 접근 메서드: get()
 * 내부 전용 메서드:        _fetch() (DomainState.save/remove에서 호출)
 *
 * 하단에서 싱글톤 인스턴스를 export하므로 외부는 클래스를 알 필요 없다.
 *
 * @module handler/api-handler
 */

import { DomainState }                       from '../../model/DomainState.js';
import { normalizeUrlConfig, buildURL }      from '../core/url-resolver.js';
import { ERR }                               from '../constants/error.messages.js';


class ApiHandler {

    /**
     * @param {import('../core/url-resolver.js').UrlConfig} urlConfig
     *   URL 설정 객체 (protocol, host, basePath, baseURL, env, debug)
     */
    constructor(urlConfig = {}) {
        /** @type {{ protocol: string, host: string, basePath: string }} */
        this._urlConfig = normalizeUrlConfig(urlConfig);
        this._debug     = urlConfig.debug ?? false;

        /** @type {Record<string, string>} */
        this._headers = { 'Content-Type': 'application/json' };
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 외부 인터페이스
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * GET 요청을 보내고 응답을 DomainState로 반환한다.
     *
     * 내부 흐름: fetch() → response.text() → DomainState.fromJSON() → DomainState
     *
     * @example
     * const user = await api.get('/api/users/user_001');
     * user.data.name = 'Davi';
     * await user.save('/api/users/user_001');
     *
     * @param {string} requestPath - 엔드포인트 경로 (예: '/api/users/1')
     * @param {object} [options]
     * @param {import('../core/url-resolver.js').UrlConfig} [options.urlConfig]
     *   이 요청에만 적용할 URL 설정 오버라이드
     * @returns {Promise<DomainState>}
     * @throws {{ status: number, statusText: string, body: string }}
     */
    async get(requestPath, { urlConfig } = {}) {
        const resolved = urlConfig ? normalizeUrlConfig(urlConfig) : this._urlConfig;
        const url      = buildURL(resolved, requestPath);
        const text     = await this._fetch(url, { method: 'GET' });

        return DomainState.fromJSON(text, this, {
            urlConfig: resolved,
            debug:     this._debug,
        });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // 내부 전용 (DomainState가 호출)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * fetch() 공통 처리 메서드.
     *
     * - 공통 헤더 병합
     * - response.ok 검사 → 실패 시 구조화된 에러 객체 throw
     * - 204 No Content 등 빈 응답은 null 반환
     *
     * 에러 구조: { status: number, statusText: string, body: string }
     * 호출부는 catch(err)에서 err.status로 HTTP 상태코드 기반 분기 가능.
     *
     * @param {string} url
     * @param {RequestInit} [options]
     * @returns {Promise<string | null>}
     * @throws {{ status: number, statusText: string, body: string }}
     */
    async _fetch(url, options = {}) {
        const res  = await fetch(url, {
            ...options,
            headers: {
                ...this._headers,
                ...(options.headers ?? {}),
            },
        });
        const text = await res.text();

        if (!res.ok) {
            throw {
                status:     res.status,
                statusText: res.statusText,
                body:       text,
            };
        }

        return text || null;
    }

    /**
     * 핸들러의 현재 urlConfig를 반환한다.
     * DomainState가 baseURL 조합 시 참조한다.
     *
     * @returns {{ protocol: string, host: string, basePath: string }}
     */
    getUrlConfig() {
        return this._urlConfig;
    }

    /** @returns {boolean} */
    isDebug() {
        return this._debug;
    }
}


// ── 싱글톤 export ─────────────────────────────────────────────────────────────
// 외부 개발자는 ApiHandler 클래스를 알 필요 없다.
// 서버 주소와 환경 설정만 변경하면 된다.
//
// @example
// // 개발 환경
// export const api = new ApiHandler({ host: 'localhost:8080', debug: true, env: 'development' });
//
// // 프로덕션
// export const api = new ApiHandler({ host: 'api.example.com', env: 'production' });
//
// @example (통합 문자열형)
// export const api = new ApiHandler({ baseURL: 'localhost:8080/app/api', debug: true });

export const api = new ApiHandler({
    host:  'localhost:8080',
    debug: true,
    env:   'development',
});
