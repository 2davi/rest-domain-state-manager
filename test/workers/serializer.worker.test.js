// @vitest-environment happy-dom

/**
 * serializer.worker.js 단위 테스트
 *
 * new Worker() 인스턴스화 없이 Worker 파일을 직접 import하여
 * onmessage 핸들러 로직을 단위 테스트한다.
 * self.onmessage를 직접 호출하는 방식으로 브라우저 Worker 환경을 시뮬레이션한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('serializer.worker — REGISTER_TAB 메시지 처리', () => {
    /** @type {ReturnType<typeof vi.fn>} */
    let mockChannelPostMessage;

    beforeEach(async () => {
        // BroadcastChannel mock 설정
        // Worker 내부에서 new BroadcastChannel()이 호출될 때 이 mock을 반환한다.
        mockChannelPostMessage = vi.fn();
        globalThis.BroadcastChannel = vi.fn().mockImplementation(() => ({
            postMessage: mockChannelPostMessage,
            close: vi.fn(),
        }));

        // Worker 파일을 직접 import — self.onmessage 핸들러가 등록된다.
        // vi.resetModules()로 모듈 캐시를 비운 뒤 import해야 테스트 간 독립성이 보장된다.
        vi.resetModules();
        await import('../../src/workers/serializer.worker.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── SW-001: 정상 케이스 ────────────────────────────────────────────────────

    it('SW-001: REGISTER_TAB 수신 시 BroadcastChannel에 TAB_REGISTER를 발화한다', () => {
        const statesObj = {
            user_001: {
                label: 'user',
                data: { name: 'Davi', email: 'davi@example.com' },
                changeLog: [],
                isNew: false,
                errors: [],
            },
        };

        // self.onmessage 직접 호출로 Worker 메시지 수신 시뮬레이션
        self.onmessage(
            new MessageEvent('message', {
                data: {
                    type: 'REGISTER_TAB',
                    tabId: 'dsm_123_abc',
                    tabUrl: 'http://localhost:5173',
                    payload: JSON.stringify(statesObj),
                },
            })
        );

        expect(mockChannelPostMessage).toHaveBeenCalledOnce();

        const call = mockChannelPostMessage.mock.calls[0][0];
        expect(call.type).toBe('TAB_REGISTER');
        expect(call.tabId).toBe('dsm_123_abc');
        expect(call.tabUrl).toBe('http://localhost:5173');
        expect(call.states).toMatchObject(statesObj);
    });

    // ── SW-002: 잘못된 JSON 폴백 ──────────────────────────────────────────────

    it('SW-002: payload가 유효하지 않은 JSON이면 빈 states로 폴백하여 발화한다', () => {
        self.onmessage(
            new MessageEvent('message', {
                data: {
                    type: 'REGISTER_TAB',
                    tabId: 'dsm_err_tab',
                    tabUrl: 'http://localhost',
                    payload: '{ this is not valid json }',
                },
            })
        );

        // 에러에도 불구하고 BroadcastChannel 발화가 이루어져야 한다
        expect(mockChannelPostMessage).toHaveBeenCalledOnce();

        const call = mockChannelPostMessage.mock.calls[0][0];
        expect(call.type).toBe('TAB_REGISTER');
        expect(call.tabId).toBe('dsm_err_tab');
        // 폴백: 파싱 실패 시 빈 객체
        expect(call.states).toEqual({});
    });

    // ── SW-003: 알 수 없는 타입 무시 ──────────────────────────────────────────

    it('SW-003: 알 수 없는 메시지 타입은 무시한다 (BroadcastChannel 미발화)', () => {
        self.onmessage(
            new MessageEvent('message', {
                data: {
                    type: 'UNKNOWN_MESSAGE_TYPE',
                    payload: '{}',
                },
            })
        );

        expect(mockChannelPostMessage).not.toHaveBeenCalled();
    });

    // ── SW-004: null / undefined data 방어 ────────────────────────────────────

    it('SW-004: event.data가 null이면 아무것도 하지 않는다', () => {
        self.onmessage(new MessageEvent('message', { data: null }));

        expect(mockChannelPostMessage).not.toHaveBeenCalled();
    });
});
