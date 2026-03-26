/**
 * @file rest-domain-state-manager — 단일 진입점
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

import { DomainPipeline } from './src/domain/DomainPipeline.js';
import { DomainState } from './src/domain/DomainState.js';
import { DomainVO } from './src/domain/DomainVO.js';
import { ApiHandler } from './src/network/api-handler.js';
import { DomainRenderer } from './src/plugins/domain-renderer/DomainRenderer.js';
import { FormBinder } from './src/plugins/form-binder/FormBinder.js';
import { closeDebugChannel } from './src/debug/debug-channel.js';

DomainState.configure({
    // index.js가 두 모듈을 import하는 유일한 파일 (Composition Root).
    // DomainState.js와 DomainPipeline.js는 서로의 존재를 모른다.
    pipelineFactory: (...args) => new DomainPipeline(...args),
});

export {
    ApiHandler,
    DomainState,
    DomainVO,
    DomainPipeline,
    DomainRenderer,
    FormBinder,
    closeDebugChannel,
};
