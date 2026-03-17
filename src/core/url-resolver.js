/**
 * @fileoverview URL 조합 및 프로토콜 결정 모듈
 *
 * 두 가지 입력 방식을 모두 지원하고, 충돌 시 자동 해소한다.
 *
 *   방식 (1) 구조 분해형: { protocol, host, basePath }
 *   방식 (2) 통합 문자열형: { protocol, baseURL }
 *
 * 프로토콜 결정 우선순위:
 *   1. 명시적 protocol 인자
 *   2. env 플래그 → DEFAULT_PROTOCOL[env]
 *   3. env 없음 + debug: true  → HTTP
 *   4. env 없음 + debug: false → HTTPS
 *
 * 최종 URL = protocol + host + basePath + requestPath
 *
 * @module core/url-resolver
 */

import { PROTOCOL, ENV, DEFAULT_PROTOCOL, VALID_PROTOCOL_KEYS } from '../constants/protocol.const.js';
import { ERR, WARN }                                             from '../constants/error.messages.js';
import { LOG, formatMessage }                                    from '../constants/log.messages.js';


/**
 * @typedef {object} UrlConfig
 * @property {string}  [protocol] - 'HTTP' | 'HTTPS' | 'FILE' | 'SSH'
 * @property {string}  [host]     - 프로토콜을 제외한 호스트 (예: 'api.example.com')
 * @property {string}  [basePath] - contextPath + alpha (예: '/app/api')
 * @property {string}  [baseURL]  - host + basePath 통합 문자열 (프로토콜 제외)
 * @property {string}  [env]      - 'development' | 'production'
 * @property {boolean} [debug]    - true이면 개발 환경으로 간주
 */

/**
 * normalizeUrlConfig() : URL 설정 객체를 받아 정규화된 내부 형태로 변환한다.
 * host + baseURL 충돌을 탐지하고 자동으로 해소한다.
 *
 * @param {UrlConfig} config
 * @returns {{ protocol: string, host: string, basePath: string }}
 * @throws {Error} 충돌을 자동 해소할 수 없을 때
 */
export function normalizeUrlConfig(config = {}) {
    let { protocol, host, basePath = '', baseURL, env, debug = false } = config;

    // ── 1. host + baseURL 동시 입력 충돌 해소 ─────────────────────────────
    if (host && baseURL) {
        if (baseURL.startsWith(host)) {
            // 케이스 A: baseURL = host + basePath → basePath로 해석
            const extracted = baseURL.slice(host.length) || '/';
            console.warn(WARN.URL_BASE_PATH_FIXED(baseURL, extracted));
            basePath = extracted;
            baseURL  = undefined;

        } else if (baseURL.includes(host)) {
            // 케이스 B: baseURL 안에 host가 포함 (프로토콜 포함 full URL 등) → host 무시
            console.warn(WARN.URL_HOST_IGNORED(host, baseURL));
            host = undefined;

        } else {
            // 케이스 C: 무관 → 판단 불가, Error
            throw new Error(ERR.URL_CONFLICT(host, baseURL));
        }
    }

    // ── 2. baseURL → host + basePath 분해 ────────────────────────────────
    if (baseURL && !host) {
        // 프로토콜 접두사가 포함된 경우 제거
        const withoutProto = baseURL.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, '');
        const slashIdx     = withoutProto.indexOf('/');

        if (slashIdx === -1) {
            host     = withoutProto;
            basePath = '';
        } else {
            host     = withoutProto.slice(0, slashIdx);
            basePath = withoutProto.slice(slashIdx);
        }
    }

    // ── 3. 프로토콜 결정 ──────────────────────────────────────────────────
    const resolvedProtocol = resolveProtocol({ protocol, env, debug });

    return {
        protocol: resolvedProtocol,
        host:     host     ?? '',
        basePath: normalizePath(basePath),
    };
}

/**
 * resolveProtocol() : 프로토콜을 우선순위에 따라 결정한다.
 *
 * @param {{ protocol?: string, env?: string, debug?: boolean }} opts
 * @returns {string} 확정된 프로토콜 문자열 (예: 'https://')
 * @throws {Error} protocol 인자가 유효하지 않은 키일 때
 */
export function resolveProtocol({ protocol, env, debug = false } = {}) {
    // 1순위: 명시적 protocol 인자
    if (protocol) {
        const key = protocol.toUpperCase();
        if (!VALID_PROTOCOL_KEYS.includes(key)) throw new Error(ERR.PROTOCOL_INVALID(protocol));
        return PROTOCOL[key];
    }

    // 2순위: env 플래그
    if (env) {
        return DEFAULT_PROTOCOL[env] ?? DEFAULT_PROTOCOL[ENV.DEVELOPMENT];
    }

    // 3/4순위: debug 플래그로 환경 추론
    return debug ? PROTOCOL.HTTP : PROTOCOL.HTTPS;
}

/**
 * buildURL() : 정규화된 URL 설정과 requestPath를 조합해 최종 URL을 반환한다.
 *
 * @param {{ protocol: string, host: string, basePath: string }} normalized
 * @param {string} requestPath - '/users/1' 형태
 * @returns {string}
 * @throws {Error} host가 비어있고 requestPath도 없을 때
 */
export function buildURL(normalized, requestPath = '') {
    const { protocol, host, basePath } = normalized;

    if (!host && !requestPath) throw new Error(ERR.URL_MISSING);

    // requestPath가 full URL이면 그대로 사용
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(requestPath)) {
        console.debug(formatMessage(LOG.url.resolved, { url: requestPath }));
        return requestPath;
    }

    const parts = [
        protocol,
        host,
        normalizePath(basePath),
        normalizePath(requestPath),
    ].filter(Boolean);

    // 슬래시 중복 제거: 각 파트의 끝/시작 슬래시를 정규화
    const url = parts
        .map((p, i) => {
            if (i === 0) return p.replace(/\/$/, '');    // protocol: 끝 슬래시 제거
            return p.replace(/^\//, '').replace(/\/$/, ''); // 나머지: 양끝 슬래시 제거
        })
        .filter(Boolean)
        .join('/');

    console.debug(formatMessage(LOG.url.resolved, { url }));
    return url;
}

/**
 * normalizePath() : 경로 문자열의 앞/뒤 슬래시를 정규화한다.
 * 빈 문자열이면 그대로 반환한다.
 *
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path = '') {
    if (!path) return '';
    // 앞에 슬래시가 없으면 추가, 뒤 슬래시는 제거
    const withLeading    = path.startsWith('/') ? path : `/${path}`;
    const withoutTrailing = withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
    return withoutTrailing;
}
