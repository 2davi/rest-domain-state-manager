import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiHandler } from '../../src/network/api-handler.js';
import { DomainState } from '../../src/domain/DomainState.js';
import { makeUserDto } from '../fixtures/index.js';

// ── global.fetch Mock 유틸 ─────────────────────────────────────────────────────
function mockFetch(status, text) {
    return vi.fn().mockResolvedValue({
        ok:       status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text:     () => Promise.resolve(text),
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
        const result  = await handler._fetch('/api/test', { method: 'GET' });
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
        const result  = await handler._fetch('/api/test', { method: 'DELETE' });
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
        const state   = await handler.get('/api/users/1');
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