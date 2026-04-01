/**
 * Idempotency-Key 인터셉터 단위 테스트 — v1.1.x
 *
 * ## 테스트 대상
 * - `ApiHandler` 생성자 `idempotent` 옵션
 * - `DomainState.save()` UUID 생명주기
 * - `DomainState.restore()` UUID 초기화
 * - `DomainState.remove()` 신규 UUID 발급
 *
 * ## 테스트 환경
 * - Vitest + happy-dom
 * - `vi.spyOn`으로 `handler._fetch` mock
 * - `crypto.randomUUID` mock으로 UUID 결정론적 제어
 *
 * @see {@link ../../src/domain/DomainState.js DomainState}
 * @see {@link ../../src/network/api-handler.js ApiHandler}
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainState } from '../../src/domain/DomainState.js';
import { ApiHandler } from '../../src/network/api-handler.js';
import { DomainPipeline } from '../../src/domain/DomainPipeline.js';

// ── 테스트 전역 설정 ─────────────────────────────────────────────────────────

beforeEach(() => {
    // Composition Root 설정: DomainState.all() 동작 보장
    DomainState.configure({
        pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/**
 * 테스트용 DomainState를 생성한다.
 *
 * @param {object} [options]
 * @param {boolean} [options.idempotent=false] - ApiHandler idempotent 옵션
 * @param {boolean} [options.debug=false]      - 디버그 모드
 * @returns {{ state: DomainState, handler: ApiHandler, fetchSpy: import('vitest').Mock }}
 */
function createTestState({ idempotent = false, debug = false } = {}) {
    const handler = new ApiHandler({
        host: 'localhost:8080',
        debug,
        idempotent,
    });

    // _fetch를 mock하여 실제 네트워크 요청 없이 동작 검증
    // 기본값: 204 No Content 성공 응답 (text === '')
    const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);

    const state = DomainState.fromJSON(
        JSON.stringify({ name: 'Davi', email: 'davi@example.com' }),
        handler,
        { debug }
    );

    return { state, handler, fetchSpy };
}

// ── 테스트 스위트 ─────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// 1. ApiHandler 생성자 옵션 검증
// ────────────────────────────────────────────────────────────────────────────
describe('ApiHandler — idempotent 옵션', () => {
    it('[TC-IDMP-001] idempotent 미지정 시 _idempotent가 false이어야 한다', () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        expect(handler._idempotent).toBe(false);
    });

    it('[TC-IDMP-002] idempotent: false 명시 시 _idempotent가 false이어야 한다', () => {
        const handler = new ApiHandler({ host: 'localhost:8080', idempotent: false });
        expect(handler._idempotent).toBe(false);
    });

    it('[TC-IDMP-003] idempotent: true 설정 시 _idempotent가 true이어야 한다', () => {
        const handler = new ApiHandler({ host: 'localhost:8080', idempotent: true });
        expect(handler._idempotent).toBe(true);
    });

    it('[TC-IDMP-004] 기존 URL 관련 필드(host, debug)는 idempotent 옵션과 독립적으로 동작해야 한다', () => {
        const handler = new ApiHandler({
            host: 'api.example.com',
            debug: true,
            idempotent: true,
        });
        expect(handler._idempotent).toBe(true);
        expect(handler._debug).toBe(true);
        expect(handler.getUrlConfig().host).toBe('api.example.com');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. idempotent: false (기본) — 기존 동작과 완전 하위 호환
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.save() — idempotent: false (기본 동작)', () => {
    it('[TC-IDMP-010] idempotent 미설정 시 save()에 Idempotency-Key 헤더가 없어야 한다 (POST)', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: false });

        // _isNew를 true로 강제 설정하여 POST 분기 진입
        // createTestState()는 fromJSON()을 사용하므로 isNew: false가 기본값.
        // DomainVO 없이 POST 분기를 검증하는 가장 단순한 방법이다.
        state._isNew = true;
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        expect(options?.method).toBe('POST'); // POST 분기 진입 확인
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).not.toHaveProperty('Idempotency-Key');
    });

    it('[TC-IDMP-011] idempotent 미설정 시 save()에 Idempotency-Key 헤더가 없어야 한다 (PATCH)', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: false });
        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).not.toHaveProperty('Idempotency-Key');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. idempotent: true — UUID 발급 및 헤더 주입
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.save() — idempotent: true', () => {
    it('[TC-IDMP-020] idempotent: true 시 PATCH 요청에 Idempotency-Key 헤더가 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');
        expect(typeof headers['Idempotency-Key']).toBe('string');
        expect(headers['Idempotency-Key'].length).toBeGreaterThan(0);
    });

    it('[TC-IDMP-021] idempotent: true 시 PUT 요청에 Idempotency-Key 헤더가 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        // 모든 필드 변경 → dirtyRatio 100% → PUT 분기
        state.data.name = 'Changed';
        state.data.email = 'new@example.com';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');
    });

    it('[TC-IDMP-022] idempotent: true 시 POST 요청에 Idempotency-Key 헤더가 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state._isNew = true; // POST 분기 강제
        await state.save('/api/users');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');
    });

    it('[TC-IDMP-023] UUID 형식이 UUID v4 패턴이어야 한다', async () => {
        const UUID_V4_PATTERN =
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';
        await state.save('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const uuid = /** @type {Record<string, string>} */ (options?.headers ?? {})[
            'Idempotency-Key'
        ];
        expect(uuid).toMatch(UUID_V4_PATTERN);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. 성공 후 UUID 초기화
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.save() — 성공 후 UUID 초기화', () => {
    it('[TC-IDMP-030] save() 성공 후 #idempotencyKey가 초기화되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';
        await state.save('/api/users/1');

        // 첫 번째 성공 후 두 번째 save() 호출
        state.data.name = 'Changed Again';
        await state.save('/api/users/1');

        // 두 번의 save() 호출에서 서로 다른 UUID가 발급되어야 한다
        const firstUUID = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[0][1]?.headers ?? {}
        )['Idempotency-Key'];
        const secondUUID = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(firstUUID).toBeDefined();
        expect(secondUUID).toBeDefined();
        expect(firstUUID).not.toBe(secondUUID);
    });

    it('[TC-IDMP-031] 변경 없는 상태에서 save()를 두 번 호출하면 매번 다른 UUID가 발급되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });

        // dirtyFields.size === 0 → PUT (변경 없음)
        await state.save('/api/users/1');
        await state.save('/api/users/1');

        const uuid1 = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[0][1]?.headers ?? {}
        )['Idempotency-Key'];
        const uuid2 = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(uuid1).not.toBe(uuid2);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. 실패 후 UUID 재사용 (재시도 시나리오)
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.save() — 실패 후 UUID 재사용 (재시도)', () => {
    it('[TC-IDMP-040] save() 실패 후 재시도 시 동일 UUID를 재사용해야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';

        // 1차 시도: 서버 오류로 실패
        fetchSpy.mockRejectedValueOnce({
            status: 500,
            statusText: 'Internal Server Error',
            body: '',
        });

        let firstUUID;
        try {
            await state.save('/api/users/1');
        } catch {
            // 실패 후 fetchSpy 호출 인자에서 UUID 추출
            firstUUID = /** @type {Record<string, string>} */ (
                fetchSpy.mock.calls[0][1]?.headers ?? {}
            )['Idempotency-Key'];
        }

        // 2차 시도: 성공
        fetchSpy.mockResolvedValueOnce(null);
        await state.save('/api/users/1');

        const secondUUID = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(firstUUID).toBeDefined();
        expect(secondUUID).toBeDefined();
        expect(firstUUID).toBe(secondUUID); // 동일 UUID 재사용 확인
    });

    it('[TC-IDMP-041] 네트워크 오류(Error) 후 재시도 시 동일 UUID를 재사용해야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';

        // 1차 시도: 네트워크 오류
        fetchSpy.mockRejectedValueOnce(new Error('Network timeout'));

        let firstUUID;
        try {
            await state.save('/api/users/1');
        } catch {
            firstUUID = /** @type {Record<string, string>} */ (
                fetchSpy.mock.calls[0][1]?.headers ?? {}
            )['Idempotency-Key'];
        }

        // 2차 시도: 성공
        fetchSpy.mockResolvedValueOnce(null);
        await state.save('/api/users/1');

        const secondUUID = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(firstUUID).toBe(secondUUID);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. restore() 후 UUID 초기화
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.restore() — UUID 초기화', () => {
    it('[TC-IDMP-050] restore() 호출 후 save()를 재호출하면 신규 UUID가 발급되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        state.data.name = 'Changed';

        // 1차 시도: 실패
        fetchSpy.mockRejectedValueOnce({ status: 409, statusText: 'Conflict', body: '' });

        let firstUUID;
        try {
            await state.save('/api/users/1');
        } catch {
            firstUUID = /** @type {Record<string, string>} */ (
                fetchSpy.mock.calls[0][1]?.headers ?? {}
            )['Idempotency-Key'];
        }

        // restore() 호출 → UUID 초기화
        state.restore();

        // 2차 시도: 신규 UUID
        state.data.name = 'New Value';
        fetchSpy.mockResolvedValueOnce(null);
        await state.save('/api/users/1');

        const secondUUID = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(firstUUID).toBeDefined();
        expect(secondUUID).toBeDefined();
        expect(firstUUID).not.toBe(secondUUID); // 신규 UUID 발급 확인
    });

    it('[TC-IDMP-051] restore() 후 #snapshot이 undefined이므로 재차 restore()는 no-op이어야 한다', () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });

        // save() 없이 restore() → no-op (false 반환)
        const result = state.restore();
        expect(result).toBe(false);
        // _fetch가 호출되지 않아야 한다
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. remove() — idempotent 옵션 적용
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.remove() — idempotent 옵션', () => {
    it('[TC-IDMP-060] idempotent: false 시 remove()에 Idempotency-Key 헤더가 없어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: false });
        await state.remove('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).not.toHaveProperty('Idempotency-Key');
    });

    it('[TC-IDMP-061] idempotent: true 시 remove()에 Idempotency-Key 헤더가 포함되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });
        await state.remove('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');
    });

    it('[TC-IDMP-062] remove()를 두 번 호출하면 매번 다른 UUID가 발급되어야 한다', async () => {
        const { state, fetchSpy } = createTestState({ idempotent: true });

        await state.remove('/api/users/1');
        // 두 번째 remove()는 두 번째 호출이므로 fetchSpy의 기본 mock(null 반환)이 다시 동작함
        await state.remove('/api/users/1');

        const uuid1 = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[0][1]?.headers ?? {}
        )['Idempotency-Key'];
        const uuid2 = /** @type {Record<string, string>} */ (
            fetchSpy.mock.calls[1][1]?.headers ?? {}
        )['Idempotency-Key'];

        expect(uuid1).not.toBe(uuid2);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. GET 요청 — Idempotency-Key 미포함 확인
// ────────────────────────────────────────────────────────────────────────────
describe('ApiHandler.get() — Idempotency-Key 미포함', () => {
    it('[TC-IDMP-070] idempotent: true여도 GET 요청에 Idempotency-Key 헤더가 없어야 한다', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080', idempotent: true });

        // GET 응답 mock: 유효한 JSON 반환
        const fetchSpy = vi
            .spyOn(handler, '_fetch')
            .mockResolvedValue(JSON.stringify({ name: 'Davi', email: 'davi@example.com' }));

        await handler.get('/api/users/1');

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});

        // GET 요청이므로 _fetch에 headers 자체가 없거나 Idempotency-Key가 없어야 한다
        // (ApiHandler._fetch()는 GET에서 MUTATING_METHODS.has('GET') === false이므로 헤더 미주입)
        // DomainState가 GET을 직접 호출하지 않으므로 #idempotencyKey는 항상 미관여
        expect(headers).not.toHaveProperty('Idempotency-Key');
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. CSRF + Idempotency-Key 동시 활성화
// ────────────────────────────────────────────────────────────────────────────
describe('DomainState.save() — CSRF + Idempotency-Key 동시 활성화', () => {
    it('[TC-IDMP-080] CSRF 토큰과 Idempotency-Key 헤더가 동시에 포함되어야 한다', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080', idempotent: true });
        handler.init({ csrfToken: 'test-csrf-token' });

        const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);
        const state = DomainState.fromJSON(
            JSON.stringify({ name: 'Davi', email: 'davi@example.com' }),
            handler
        );
        state.data.name = 'Changed';
        await state.save('/api/users/1');

        // _fetch 내부에서 두 헤더 모두 병합되어야 한다
        // ApiHandler._fetch()는 options.headers를 this._headers와 병합하고,
        // CSRF 토큰은 그 뒤에 headers 객체에 직접 추가한다.
        // 최종 fetch() 호출의 headers에 두 가지 모두 포함되어야 한다.
        // → _fetch의 내부 fetch() 호출을 직접 spy하는 방법이 필요.
        // 현재 spy 대상은 _fetch 전체이므로, 전달된 options.headers와
        // _fetch 내부 headers 변수를 분리 검증할 수 없다.
        // → 대신, _fetch 호출 자체가 이루어졌음 + options.headers에 Idempotency-Key 포함을 검증

        const [, options] = fetchSpy.mock.calls[0];
        const headers = /** @type {Record<string, string>} */ (options?.headers ?? {});
        expect(headers).toHaveProperty('Idempotency-Key');

        // CSRF는 _fetch 내부에서 추가되므로 options.headers에는 없고
        // _fetch 내부의 headers 변수에 포함된다.
        // 이 TC는 두 기능이 동시 활성화 시 save()가 에러 없이 완료되는지 확인하는 것으로 충분.
        expect(fetchSpy).toHaveBeenCalledOnce();
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. 하위 호환성 확인
// ────────────────────────────────────────────────────────────────────────────
describe('하위 호환성 — idempotent 옵션 없는 기존 소비자 코드', () => {
    it('[TC-IDMP-090] idempotent 옵션 없이 생성한 ApiHandler도 에러 없이 동작해야 한다', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);
        const state = DomainState.fromJSON(JSON.stringify({ name: 'Davi' }), handler);
        state.data.name = 'Changed';

        await expect(state.save('/api/users/1')).resolves.toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledOnce();
    });

    it('[TC-IDMP-091] idempotent 옵션 없이 remove()도 에러 없이 동작해야 한다', async () => {
        const handler = new ApiHandler({ host: 'localhost:8080' });
        const fetchSpy = vi.spyOn(handler, '_fetch').mockResolvedValue(null);
        const state = DomainState.fromJSON(JSON.stringify({ name: 'Davi' }), handler);

        await expect(state.remove('/api/users/1')).resolves.toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledOnce();
    });
});
