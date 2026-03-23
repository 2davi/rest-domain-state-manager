/**
 * 테스트 공통 픽스처
 *
 * Vitest와 VitePress Playground가 공유하는 데이터와 Mock을 정의한다.
 * 테스트 코드에서 import하여 beforeEach에서 매 케이스마다 새로 생성해야
 * 케이스 간 상태 오염을 막을 수 있다.
 */

// ── DTO 픽스처 ────────────────────────────────────────────────────────────────

/**
 * 기본 User DTO — 5개 필드로 dirty ratio 테스트에 최적
 * @returns {object}
 */
export function makeUserDto() {
    return {
        userId:  'user_001',
        name:    'Davi',
        email:   'davi@example.com',
        role:    'admin',
        address: { city: 'Seoul', zip: '04524' },
    };
}

/**
 * 역할 목록 DTO — DomainPipeline / DomainRenderer 테스트용 배열
 * @returns {object[]}
 */
export function makeRoleList() {
    return [
        { roleId: 'R01', roleName: '관리자' },
        { roleId: 'R02', roleName: '일반 사용자' },
        { roleId: 'R03', roleName: '게스트' },
    ];
}

// ── Mock ApiHandler ────────────────────────────────────────────────────────────

/**
 * 가짜 ApiHandler.
 * _fetch를 vi.fn()으로 교체하여 실제 HTTP 없이 응답을 제어한다.
 *
 * @param {{ method?: string, status?: number, body?: string }} options
 */
export function makeMockHandler(options = {}) {
    const { status = 200, body = JSON.stringify(makeUserDto()) } = options;
    return {
        _fetch: null, // 각 테스트에서 vi.fn()으로 할당
        getUrlConfig: () => ({ protocol: 'http://', host: 'localhost:8080', basePath: '' }),
        isDebug: () => false,
        _status: status,
        _body:   body,
    };
}

/**
 * save() 실패를 시뮬레이션하는 HttpError 객체
 * @param {number} status
 */
export function makeHttpError(status = 409) {
    return { status, statusText: 'Conflict', body: '{"message":"conflict"}' };
}