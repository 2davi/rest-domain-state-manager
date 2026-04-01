/**
 * @file rest-domain-state-manager — 단일 진입점
 *
 * 라이브러리의 모든 공개 API를 이 파일 하나에서 import한다.
 * 외부 개발자는 이 파일만 알면 된다.
 *
 * ── 내보내는 것 ──────────────────────────────────────────────────────────────
 *   ApiHandler        HTTP 전송 레이어 클래스 (인스턴스 생성은 소비자가 담당)
 *   DomainState       팩토리 3종 + save / remove / log / openDebugger
 *   DomainVO          도메인 구조 선언 베이스 클래스 (선택적 레이어)
 *   DomainCollection  1:N 배열 상태 컨테이너 + saveAll({ strategy: 'batch' })
 *   DomainPipeline    병렬 fetch + 순차 after() 체이닝
 *   DomainRenderer    DOM 렌더링 플러그인 (DomainState.use(DomainRenderer)로 설치)
 *
 * ── React 어댑터 (서브패스) ───────────────────────────────────────────────────
 *   import { useDomainState } from '@2davi/rest-domain-state-manager/adapters/react';
 *   React 18+의 useSyncExternalStore를 통해 DomainState를 컴포넌트에 연결한다.
 *   React가 peerDependencies(optional)로 설치되어 있어야 한다.
 *
 * @module rest-domain-state-manager
 */

import { DomainPipeline } from './src/domain/DomainPipeline.js';
import { DomainState } from './src/domain/DomainState.js';
import { DomainVO } from './src/domain/DomainVO.js';
import { DomainCollection } from './src/domain/DomainCollection.js';
import { ApiHandler } from './src/network/api-handler.js';
import { DomainRenderer } from './src/plugins/domain-renderer/DomainRenderer.js';
import { FormBinder } from './src/plugins/form-binder/FormBinder.js';
import { closeDebugChannel } from './src/debug/debug-channel.js';

DomainState.configure({
    // index.js가 두 모듈을 import하는 유일한 파일 (Composition Root).
    // DomainState.js와 DomainPipeline.js는 서로의 존재를 모른다.
    // index.js는 DomainPipeline을 직접 import하여서 `configure()`의 `@param` 타입을 인지하고 있다. 그래서 명시적으로 작성.
    pipelineFactory: (resourceMap, options) => new DomainPipeline(resourceMap, options),
});

export {
    ApiHandler,
    DomainState,
    DomainVO,
    DomainCollection,
    DomainPipeline,
    DomainRenderer,
    FormBinder,
    closeDebugChannel,
};
