/**
 * @fileoverview rest-domain-state-manager — 단일 진입점
 *
 * 라이브러리의 모든 공개 API를 이 파일 하나에서 import한다.
 * 외부 개발자는 이 파일만 알면 된다.
 *
 * ── 내보내는 것 ──────────────────────────────────────────────────────────────
 *   api            ApiHandler 싱글톤 (GET 요청 + 내부 fetch 위임)
 *   DomainState    팩토리 3종 + save / remove / log / openDebugger
 *   DomainVO       도메인 구조 선언 베이스 클래스
 *   DomainPipeline 병렬 fetch + 순차 after() 체이닝
 *   DomainRenderer DOM 렌더링 플러그인 (DomainState.use(DomainRenderer)로 설치)
 *
 * ── 사용 예시 ────────────────────────────────────────────────────────────────
 * @example
 * // index.html
 * <script type="module">
 *   import {
 *     api,
 *     DomainState,
 *     DomainVO,
 *     DomainPipeline,
 *     DomainRenderer
 *   } from './rest-domain-state-manager.js';
 *
 *   // 플러그인 등록 (앱 초기화 시 1회)
 *   DomainState.use(DomainRenderer);
 *
 *   // GET 요청 → DomainState 생성
 *   const user = await api.get('/api/users/user_001');
 *   user.data.name = 'Davi';
 *   await user.save('/api/users/user_001');
 *
 *   // 병렬 fetch + 체이닝
 *   const result = await DomainState.all({
 *     roles: api.get('/api/roles'),
 *     user:  api.get('/api/users/1'),
 *   })
 *   .after('roles', async roles => {
 *     roles.renderTo('#roleSelect', {
 *       type: 'select', valueField: 'roleId', labelField: 'roleName'
 *     });
 *   })
 *   .run();
 * </script>
 *
 * @module rest-domain-state-manager
 */

// DomainPipeline을 먼저 import해 전역 레지스트리(globalThis.__DSM_DomainPipeline)를 등록한다.
// DomainState.all()의 lazy load가 이 등록에 의존한다.
import { DomainPipeline } from './model/DomainPipeline.js';
import { DomainState }    from './model/DomainState.js';
import { DomainVO }       from './model/DomainVO.js';
import { DomainRenderer } from './plugin/domain-renderer/DomainRenderer.js';
import { api }            from './src/handler/api-handler.js';

export { api, DomainState, DomainVO, DomainPipeline, DomainRenderer };
