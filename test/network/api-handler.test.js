import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiHandler } from '../../src/network/api-handler.js';
import { DomainState } from '../../src/domain/DomainState.js';
import { makeUserDto } from '../fixtures/index.js';

// ── global.fetch Mock 유틸 ─────────────────────────────────────────────────────
function mockFetch(status, text) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text: () => Promise.resolve(text),
    });
}

beforeEach(() => {
    global.fetch = mockFetch(200, JSON.stringify(makeUserDto()));
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-N-001 ~ TC-N-004
// ══════════════════════════════════════════════════════════════════════════════

describe('ApiHandler._fetch()', () => {
    it('TC-N-001: response.ok=true → 응답 텍스트 반환', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        const result = await handler._fetch('/api/test', { method: 'GET' });
        expect(typeof result).toBe('string');
    });

    it('TC-N-002: response.ok=false → HttpError { status, statusText, body } throw', async () => {
        global.fetch = mockFetch(409, '{"message":"conflict"}');
        const handler = new ApiHandler({ host: 'localhost:8080' });
        let caught;
        try {
            await handler._fetch('/api/test', { method: 'PUT' });
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeDefined();
        expect(caught.status).toBe(409);
        expect(caught.body).toBeDefined();
    });

    it('TC-N-003: 204 No Content → null 반환', async () => {
        global.fetch = mockFetch(204, '');
        const handler = new ApiHandler({ host: 'localhost:8080' });
        const result = await handler._fetch('/api/test', { method: 'DELETE' });
        expect(result).toBeNull();
    });

    it('options.headers가 _headers보다 우선 적용 (오버라이드)', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        await handler._fetch('/api/test', {
            method: 'GET',
            headers: { 'Content-Type': 'text/plain' },
        });
        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['Content-Type']).toBe('text/plain');
    });
});

describe('ApiHandler.get()', () => {
    it('TC-N-004: GET 성공 → DomainState(isNew:false) 반환', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080', debug: false });
        const state = await handler.get('/api/users/1');
        expect(state).toBeInstanceOf(DomainState);
        expect(state._isNew).toBe(false);
    });

    it('응답 본문이 비어있으면 Error throw', async () => {
        global.fetch = mockFetch(200, '');
        // 빈 응답은 text()가 빈 문자열 → _fetch가 null 반환 → get()이 Error throw
        const handler = new ApiHandler({ host: 'localhost:8080' });
        await expect(handler.get('/api/users/1')).rejects.toThrow();
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-N-005 ~ TC-N-011  CSRF 토큰 인터셉터
// ══════════════════════════════════════════════════════════════════════════════

describe('ApiHandler.init() + _fetch() — CSRF 인터셉터', () => {
    // ── TC-N-005: init() 미호출 → 뮤테이션 요청도 그냥 통과 (CSRF 비활성) ──
    it('TC-N-005: init() 미호출 시 POST 요청에 X-CSRF-Token 헤더 없음', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        // init() 호출 없음 → #csrfToken === undefined

        await handler._fetch('/api/test', { method: 'POST', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBeUndefined();
    });

    // ── TC-N-006: init({ csrfToken }) 직접 주입 → 뮤테이션 요청 헤더 포함 ──
    it('TC-N-006: init({ csrfToken }) 후 POST에 X-CSRF-Token 헤더 삽입', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'abc123' });

        await handler._fetch('/api/test', { method: 'POST', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('abc123');
    });

    it('TC-N-007: init({ csrfToken }) 후 PUT에 X-CSRF-Token 헤더 삽입', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'tok-put' });

        await handler._fetch('/api/test', { method: 'PUT', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('tok-put');
    });

    it('TC-N-008: init({ csrfToken }) 후 PATCH에 X-CSRF-Token 헤더 삽입', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'tok-patch' });

        await handler._fetch('/api/test', { method: 'PATCH', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('tok-patch');
    });

    it('TC-N-009: init({ csrfToken }) 후 DELETE에 X-CSRF-Token 헤더 삽입', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'tok-del' });

        await handler._fetch('/api/test', { method: 'DELETE' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('tok-del');
    });

    // ── TC-N-010: GET은 init() 이후에도 X-CSRF-Token 헤더 없음 ──────────────
    it('TC-N-010: GET 요청은 init() 후에도 X-CSRF-Token 헤더 미삽입', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'abc123' });

        await handler._fetch('/api/test', { method: 'GET' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBeUndefined();
    });

    // ── TC-N-011: init() 호출했으나 토큰 없음 → 뮤테이션 요청 시 throw ───────
    it('TC-N-011: init() 후 토큰 미발견 상태에서 POST 시 Error throw', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        // Node.js 환경: document 없음 → DOM 탐색 실패 → #csrfToken = null
        // csrfToken 직접 주입도 없음
        handler.init({});

        await expect(handler._fetch('/api/test', { method: 'POST', body: '{}' })).rejects.toThrow(
            'CSRF 토큰이 필요하지만'
        );
    });
});

// ── url-resolver.js 미커버 브랜치 보강 ──────────────────────────────────────

describe('normalizeUrlConfig — host + baseURL 충돌 해소', () => {
    it('baseURL이 host로 시작하면 basePath로 해석해야 한다 (케이스 A)', () => {
        // host + baseURL 동시 입력, baseURL.startsWith(host) → basePath 추출
        const handler = new ApiHandler({
            host:    'localhost:8080',
            baseURL: 'localhost:8080/api/v1',
        });
        const config = handler.getUrlConfig();
        expect(config.host).toBe('localhost:8080');
        expect(config.basePath).toBe('/api/v1');
    });

    it('baseURL에 슬래시가 없으면 전체가 host로 파싱되어야 한다', () => {
        // baseURL 전용, 슬래시 없음 → host = baseURL 전체
        const handler = new ApiHandler({ baseURL: 'api.example.com' });
        const config = handler.getUrlConfig();
        expect(config.host).toBe('api.example.com');
        expect(config.basePath).toBe('');
    });

    // 179번째 줄: baseURL.includes(host) → host 무시 (케이스 B)
    it('baseURL 안에 host가 포함된 full URL 형태면 host를 무시해야 한다 (케이스 B)', () => {
        const handler = new ApiHandler({
            host:    'api.example.com',
            baseURL: 'https://api.example.com/v1',
        });
        const config = handler.getUrlConfig();
        expect(config.host).toBe('api.example.com');
        expect(config.basePath).toBe('/v1');
    });

    it('host/baseURL 완전 무관 입력 시 ERR.URL_CONFLICT를 throw해야 한다 (케이스 C)', () => {
        expect(() => new ApiHandler({
            host:    'api.example.com',
            baseURL: 'other-server.com/api',
        })).toThrow(/충돌/);
    });

    it('유효하지 않은 protocol 값 전달 시 PROTOCOL_INVALID 에러를 throw해야 한다', () => {
        expect(() => new ApiHandler({
            host:     'api.example.com',
            protocol: 'FTP',
        })).toThrow(/유효하지 않은/);
    });

    it('env 값이 전달되면 DEFAULT_PROTOCOL[env]로 프로토콜이 결정되어야 한다', () => {
        const handler = new ApiHandler({
            host: 'api.example.com',
            env:  'production',
        });
        expect(handler.getUrlConfig().protocol).toBe('https://');
    });

    it('requestPath가 완전한 URL이면 buildURL이 그대로 반환해야 한다', async () => {
        const { buildURL, normalizeUrlConfig } = await import('../../src/core/url-resolver.js');
        const config = normalizeUrlConfig({ host: 'api.example.com' });
        const result = buildURL(config, 'https://other.com/api/test');
        expect(result).toBe('https://other.com/api/test');
    });
});
