// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiHandler } from '../../src/network/api-handler.js';

function mockFetch(status = 200, text = '{}') {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text: () => Promise.resolve(text),
    });
}

beforeEach(() => {
    global.fetch = mockFetch();
});

afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = ''; // meta 태그 정리
    document.cookie = '';
});

// ══════════════════════════════════════════════════════════════════════════════
// TC-N-012 ~ TC-N-015  CSRF — jsdom 환경 (DOM 파싱)
// ══════════════════════════════════════════════════════════════════════════════

describe('ApiHandler.init() — DOM meta 태그 파싱 (jsdom)', () => {
    it('TC-N-012: meta[name="_csrf"] 기본 선택자 자동 탐색 성공', async () => {
        document.head.innerHTML = `<meta name="_csrf" content="spring-token-001">`;

        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({}); // csrfSelector 미지정 → 기본값으로 탐색

        await handler._fetch('/api/test', { method: 'POST', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('spring-token-001');
    });

    it('TC-N-013: 커스텀 csrfSelector로 meta 태그 파싱 성공', async () => {
        document.head.innerHTML = `<meta name="csrf-token" content="laravel-token-999">`;

        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfSelector: 'meta[name="csrf-token"]' });

        await handler._fetch('/api/test', { method: 'PUT', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('laravel-token-999');
    });

    it('TC-N-014: meta 태그 없음 → #csrfToken = null → POST 시 throw', async () => {
        // document.head는 비어있음

        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({});

        await expect(handler._fetch('/api/test', { method: 'POST', body: '{}' })).rejects.toThrow(
            'CSRF 토큰이 필요하지만'
        );
    });

    it('TC-N-015: csrfToken 직접 주입은 jsdom 환경에서도 DOM 탐색 건너뜀', async () => {
        // meta 태그를 심어도 직접 주입이 우선
        document.head.innerHTML = `<meta name="_csrf" content="should-not-use-this">`;

        const handler = new ApiHandler({ host: 'localhost:8080' });
        handler.init({ csrfToken: 'direct-injection-wins' });

        await handler._fetch('/api/test', { method: 'POST', body: '{}' });

        const sentHeaders = global.fetch.mock.calls[0][1].headers;
        expect(sentHeaders['X-CSRF-Token']).toBe('direct-injection-wins');
    });
});
