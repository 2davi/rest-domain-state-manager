/**
 * @fileoverview rest-domain-state-manager — 단일 진입점
 *
 * 라이브러리의 모든 공개 API를 이 파일 하나에서 import한다.
 * 외부 개발자는 이 파일만 알면 된다.
 *
 * ── 내보내는 것 ──────────────────────────────────────────────────────────────
 *   ApiHandler     HTTP 전송 레이어 클래스 (인스턴스 생성은 소비자가 담당)
 *   DomainState    팩토리 3종 + save / remove / log / openDebugger
 *   DomainVO       도메인 구조 선언 베이스 클래스
 *   DomainPipeline 병렬 fetch + 순차 after() 체이닝
 *   DomainRenderer DOM 렌더링 플러그인 (DomainState.use(DomainRenderer)로 설치)
 *
 * @module rest-domain-state-manager
 */

import { DomainPipeline }    from './model/DomainPipeline.js';
import { DomainState }       from './model/DomainState.js';
import { DomainVO }          from './model/DomainVO.js';
import { ApiHandler }        from './src/handler/api-handler.js';
import { DomainRenderer }    from './plugin/domain-renderer/DomainRenderer.js';
import { FormBinder}         from './plugin/form-binding/FormBinder.js';
import { closeDebugChannel } from './src/debug/debug-channel.js';

// 의존성 주입: DomainState가 순환 참조 없이 DomainPipeline을 생성할 수 있도록 생성자를 넘겨준다.
DomainState.PipelineConstructor = DomainPipeline;

export { ApiHandler, DomainState, DomainVO, DomainPipeline, DomainRenderer, FormBinder, closeDebugChannel };
