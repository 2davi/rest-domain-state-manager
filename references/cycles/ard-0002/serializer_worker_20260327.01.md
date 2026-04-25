# Web Worker Offloading — Serializer Pipeline (2026-03-27)

> **Milestone:** `v1.5.0`
> **Branch:** `feat/serializer-worker`
> **References:** `ard-0002-alignment.md section 3.5`

---

## (a) 현행 코드 진단

### 두 후보 작업의 비용 분석

#### 후보 1 — toPatch() in api-mapper.js

단순 배열 순회 O(n). 일반 REST API VO의 필드 수(10~50개)에서 changeLog 항목도 같은 수준이다. 이 연산이 50ms(Long Task 기준)를 초과하는 것은 현실적으로 불가능하다. ARD 3.5.1에서 명시한 대로, Worker 왕복 비용(postMessage 직렬화 + 역직렬화)이 toPatch() 실행 비용보다 크다.

따라서 toPatch() 경로의 Worker 오프로딩은 실측 후 50ms 초과 확인 시에만 의미가 있다. 이번 Milestone에서는 계측 코드를 먼저 삽입하고 결과에 따라 판단한다.

#### 후보 2 — Object.fromEntries(_stateRegistry) in registerTab()

```javascript
// debug-channel.js
function registerTab() {
    getChannel()?.postMessage({
        type:   MSG_TYPE.TAB_REGISTER,
        tabId:  TAB_ID,
        tabUrl: location.href,
        states: Object.fromEntries(_stateRegistry),  // 후보
    });
}
```

_stateRegistry는 Map 이다. 대규모 애플리케이션에서 수백 개의 DomainState 인스턴스가 등록되면 Object.fromEntries() 와 postMessage 내부 structuredClone 조합이 누적되어 Long Task를 유발할 수 있다.

registerTab()은 두 시점에 호출된다.

1. 페이지 로드 직후 (1회)
2. TAB_PING 수신 시마다 (2초 간격으로 반복)

2번 경로가 지속적으로 메인 스레드를 점유하는 문제다.

### ARD와의 차이점

ARD는 toPatch()와 _stateRegistry 오프로딩을 같은 무게로 다뤘다. 코드를 직접 보면 우선순위가 달라진다. registerTab()만 먼저 Worker로 오프로딩하고, toPatch()는 계측 결과를 보고 Phase 2에서 판단한다.

---

## (b) 목표 아키텍처 설계

### 두 단계 접근

```markdown
Phase 1 (이번 Milestone)
  - 계측 코드 삽입 (performance.mark / measure)
  - _stateRegistry 직렬화 Worker 오프로딩
  - Worker 생명주기 관리

Phase 2 (측정 결과 기반, 조건부)
  - toPatch() 적응형 라우팅
  - changeLog.length >= WORKER_THRESHOLD 시 Worker 위임
  - 실측에서 50ms 초과 확인된 경우에만 활성화
```

### Worker 통신 프로토콜

메인 스레드에서 Worker로 전달하는 메시지 구조:

```json
{
  type:    'REGISTER_TAB',
  tabId:   string,
  tabUrl:  string,
  payload: string   // JSON.stringify(Object.fromEntries(_stateRegistry))
}
```

payload를 문자열로 전달하는 이유 — Nolan Lawson 분석에 따르면 복잡한 객체를 postMessage로 전달할 때 JSON.stringify 후 문자열로 보내는 것이 structuredClone보다 빠를 수 있다. postMessage가 문자열을 zero-copy에 가깝게 처리하기 때문이다.

### Worker Lazy Singleton 패턴

```text
_serializeWorker 변수 (모듈 레벨)

  null   -> 아직 생성 안 됨
  Worker -> 생성됨

getSerializeWorker() 호출 시:
  _serializeWorker 있으면 반환
  typeof Worker === 'undefined' 이면 null 반환 (Node.js 가드)
  새 Worker 생성 후 반환
```

new Worker(new URL('./serializer.worker.js', import.meta.url)) 패턴이 핵심이다. Rollup/Vite/Webpack 모두 이 패턴으로 Worker 파일을 정적으로 분석하여 번들에 포함시킨다.

### Worker 생명주기

```text
생성:   registerTab() 최초 호출 -> getSerializeWorker()로 Lazy 생성
유지:   이후 모든 registerTab() 호출이 동일 Worker 인스턴스 재사용
종료:   closeDebugChannel() 호출 시 worker.terminate() + _serializeWorker = null
        beforeunload 이벤트에서도 closeDebugChannel()이 호출되므로 자동 처리
```

---

## (c) 변경 파일별 세부 분석

### STEP A — 성능 계측 코드 삽입

#### api-mapper.js — toPatch() 전후 계측

```javascript
export function toPatch(getChangeLogFn) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        performance.mark('toPatch:start');
    }

    const result = getChangeLogFn().map(({ op, path, newValue }) => {
        const patch = { op, path };
        if (op !== OP.REMOVE) patch.value = newValue;
        return patch;
    });

    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        performance.mark('toPatch:end');
        const measure = performance.measure('toPatch', 'toPatch:start', 'toPatch:end');
        if (measure.duration > 10) {
            console.debug(`[DSM] toPatch() ${measure.duration.toFixed(2)}ms (changeLog: ${result.length}항목)`);
        }
    }

    return result;
}
```

10ms 이상이면 로그 출력한다. 50ms Long Task 기준보다 낮은 임계값이라 조기 경보 역할을 한다.

#### debug-channel.js — registerTab() 전후 계측

registerTab() 함수 진입부와 반환부에 동일한 패턴으로 삽입한다.

```javascript
function registerTab() {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        performance.mark('registerTab:start');
    }

    // ... 기존 로직 ...

    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        performance.mark('registerTab:end');
        const measure = performance.measure('registerTab', 'registerTab:start', 'registerTab:end');
        if (measure.duration > 10) {
            console.debug(`[DSM] registerTab() ${measure.duration.toFixed(2)}ms (_stateRegistry: ${_stateRegistry.size}항목)`);
        }
    }
}
```

두 계측 블록 모두 개발 환경 전용이다. 소비자 번들러가 process.env.NODE_ENV를 'production'으로 치환하면 Tree-shaking으로 번들에서 제거된다.

---

### STEP B — src/workers/serializer.worker.js 신규 생성

```javascript
/**
 * DSM Serialize Worker
 *
 * 메인 스레드의 _stateRegistry 직렬화 및 BroadcastChannel 발화를 오프로딩 처리한다.
 *
 * ## 수신 메시지 구조 (메인 스레드 -> Worker)
 * {
 *   type:    'REGISTER_TAB',
 *   tabId:   string,
 *   tabUrl:  string,
 *   payload: string  // JSON.stringify(Object.fromEntries(_stateRegistry))
 * }
 *
 * ## BroadcastChannel 호환성
 * BroadcastChannel API는 Web Worker 컨텍스트에서 직접 인스턴스화 가능하다. (MDN 명세)
 * Worker 내부에서 채널을 생성하므로 메인 스레드 채널과 독립적으로 동작한다.
 *
 * ## postMessage 전송 비용 최소화
 * 메인 스레드에서 JSON.stringify() 후 문자열로 전달한다.
 * postMessage의 structuredClone이 문자열을 zero-copy에 가깝게 처리하기 때문이다.
 *
 * @module workers/serializer.worker
 */

const CHANNEL_NAME = 'dsm_debug';

/** @type {BroadcastChannel | null} */
let _workerChannel = null;

/**
 * Worker 내부 BroadcastChannel 싱글톤을 반환한다.
 *
 * @returns {BroadcastChannel | null}
 */
function getWorkerChannel() {
    if (_workerChannel) return _workerChannel;
    if (typeof BroadcastChannel === 'undefined') return null;
    _workerChannel = new BroadcastChannel(CHANNEL_NAME);
    return _workerChannel;
}

/**
 * 메인 스레드로부터 메시지를 수신하여 BroadcastChannel에 발화한다.
 *
 * @param {MessageEvent<{ type: string, tabId: string, tabUrl: string, payload: string }>} event
 */
self.onmessage = function (event) {
    const { type, tabId, tabUrl, payload } = event.data ?? {};

    if (type === 'REGISTER_TAB') {
        let states;
        try {
            states = JSON.parse(payload);
        } catch {
            // JSON 파싱 실패 시 빈 상태 맵으로 폴백. Silent Failure 방지.
            states = {};
        }

        getWorkerChannel()?.postMessage({
            type:   'TAB_REGISTER',
            tabId,
            tabUrl,
            states,
        });
    }
    // 알 수 없는 타입은 조용히 무시한다.
};
```

---

### STEP C — debug-channel.js 수정 (4개 지점)

#### 수정 1. 모듈 레벨 변수 추가

기존 let _channel = null; 아래에 추가한다.

```javascript
/**
 * _stateRegistry 직렬화 및 BroadcastChannel 발화를 오프로딩하는 Worker 싱글톤.
 * getSerializeWorker() 최초 호출 시 Lazy하게 생성된다.
 * closeDebugChannel() 호출 시 terminate() 후 null로 리셋된다.
 *
 * @type {Worker | null}
 */
let _serializeWorker = null;
```

#### 수정 2. getSerializeWorker() 내부 함수 추가

getChannel() 함수 바로 아래에 추가한다.

```javascript
/**
 * Serialize Worker 싱글톤 인스턴스를 반환한다.
 *
 * 최초 호출 시 Worker를 생성하고, 이후에는 캐싱된 인스턴스를 반환한다.
 * Worker API가 없는 환경(Node.js, Vitest)에서는 null을 반환한다.
 *
 * new Worker(new URL(...)) 패턴은 Rollup/Vite/Webpack이 Worker 파일을
 * 별도 청크로 번들링하는 표준 방식이다.
 *
 * @returns {Worker | null}
 */
function getSerializeWorker() {
    if (_serializeWorker) return _serializeWorker;
    if (typeof Worker === 'undefined') return null;

    _serializeWorker = new Worker(
        new URL('./serializer.worker.js', import.meta.url),
        { type: 'module' }
    );
    return _serializeWorker;
}
```

#### 수정 3. registerTab() — Worker 오프로딩으로 교체

```javascript
function registerTab() {
    const worker = getSerializeWorker();

    if (worker) {
        // Worker 오프로딩: _stateRegistry 직렬화를 메인 스레드 밖으로 위임.
        // JSON.stringify 후 문자열로 전달 — postMessage structuredClone보다 빠름.
        worker.postMessage({
            type:    'REGISTER_TAB',
            tabId:   TAB_ID,
            tabUrl:  location.href,
            payload: JSON.stringify(Object.fromEntries(_stateRegistry)),
        });
    } else {
        // Worker 미지원 환경 폴백: 기존 방식으로 직접 처리.
        getChannel()?.postMessage(
            /** @type {TabRegisterMessage} */ ({
                type:   MSG_TYPE.TAB_REGISTER,
                tabId:  TAB_ID,
                tabUrl: location.href,
                states: Object.fromEntries(_stateRegistry),
            })
        );
    }
}
```

#### 수정 4. closeDebugChannel() — Worker 생명주기 정리 추가

기존 채널 close 블록 아래에 추가한다.

```javascript
export function closeDebugChannel() {
    if (_channel) {
        _channel.postMessage(/** @type {TabUnregisterMessage} */ ({
            type:  MSG_TYPE.TAB_UNREGISTER,
            tabId: TAB_ID,
        }));
        _channel.close();
        _channel = null;
        console.debug('[DSM] Debug BroadcastChannel closed.');
    }

    // Worker 생명주기 정리.
    // terminate() 미호출 시 Worker 스레드가 페이지 언로드 후에도 살아남아
    // 메모리 누수가 발생할 수 있다.
    if (_serializeWorker) {
        _serializeWorker.terminate();
        _serializeWorker = null;
        console.debug('[DSM] Serialize Worker terminated.');
    }
}
```

initDebugChannel()의 beforeunload 핸들러가 closeDebugChannel()을 호출하는 구조이므로 Worker 종료가 자동으로 보장된다.

---

### STEP D — vitest.config.js 갱신

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        environmentMatchGlobs: [
            ['test/plugins/**',       'jsdom'],
            ['test/**/*-dom.test.js', 'jsdom'],
            ['test/workers/**',       'happy-dom'],  // 추가: Worker API 지원
        ],
    },
});
```

jsdom이 아닌 happy-dom을 선택하는 이유 — jsdom은 Worker API를 구현하지 않는다. happy-dom은 Web Worker를 포함한 더 많은 브라우저 API를 지원한다. Worker onmessage 핸들러 로직을 직접 단위 테스트로 검증하므로 BroadcastChannel mock이 필요한데 happy-dom 환경에서 처리한다.

---

### STEP E — test/workers/serializer.worker.test.js 신규 생성

```javascript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Worker 파일을 직접 import하여 onmessage 핸들러 로직을 단위 테스트한다.
// new Worker() 인스턴스화 없이 핸들러 함수 자체를 검증하는 방식이다.

describe('serializer.worker — REGISTER_TAB 메시지 처리', () => {

    /** @type {ReturnType<typeof vi.fn>} */
    let mockChannelPostMessage;

    beforeEach(() => {
        mockChannelPostMessage = vi.fn();

        globalThis.BroadcastChannel = vi.fn().mockImplementation(() => ({
            postMessage: mockChannelPostMessage,
            close:       vi.fn(),
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Worker 모듈 캐시 초기화: 각 테스트가 독립적인 _workerChannel 상태에서 실행
        vi.resetModules();
    });

    it('SW-001: REGISTER_TAB 수신 시 BroadcastChannel에 TAB_REGISTER를 발화한다', async () => {
        await import('../../src/workers/serializer.worker.js');

        const statesObj = {
            'user_001': { label: 'user', data: { name: 'Davi' }, changeLog: [], isNew: false, errors: [] },
        };

        self.onmessage(new MessageEvent('message', {
            data: {
                type:    'REGISTER_TAB',
                tabId:   'dsm_123_abc',
                tabUrl:  'http://localhost:5173',
                payload: JSON.stringify(statesObj),
            },
        }));

        expect(mockChannelPostMessage).toHaveBeenCalledOnce();

        const call = mockChannelPostMessage.mock.calls[0][0];
        expect(call.type).toBe('TAB_REGISTER');
        expect(call.tabId).toBe('dsm_123_abc');
        expect(call.tabUrl).toBe('http://localhost:5173');
        expect(call.states).toMatchObject(statesObj);
    });

    it('SW-002: payload가 유효하지 않은 JSON이면 빈 states로 폴백하여 발화한다', async () => {
        await import('../../src/workers/serializer.worker.js');

        self.onmessage(new MessageEvent('message', {
            data: {
                type:    'REGISTER_TAB',
                tabId:   'dsm_err',
                tabUrl:  'http://localhost',
                payload: '{ invalid json }',
            },
        }));

        expect(mockChannelPostMessage).toHaveBeenCalledOnce();

        const call = mockChannelPostMessage.mock.calls[0][0];
        expect(call.type).toBe('TAB_REGISTER');
        expect(call.states).toEqual({});
    });

    it('SW-003: 알 수 없는 메시지 타입은 무시한다', async () => {
        await import('../../src/workers/serializer.worker.js');

        self.onmessage(new MessageEvent('message', {
            data: {
                type:    'UNKNOWN_TYPE',
                payload: '{}',
            },
        }));

        expect(mockChannelPostMessage).not.toHaveBeenCalled();
    });
});
```

---

## (d) 예상 시나리오

### 시나리오 1. 정상 브라우저 환경 — Worker 오프로딩 흐름

```text
TAB_PING 수신 (2초마다)
  -> registerTab() 호출
       -> getSerializeWorker() -> Worker 인스턴스 반환 (Lazy Singleton)
       -> worker.postMessage({
              type:    'REGISTER_TAB',
              payload: '{"user_001":{...},...}'  // 문자열
          })
       -> 메인 스레드 즉시 반환

Worker 스레드 (독립 실행):
  -> JSON.parse(payload)
  -> BroadcastChannel('dsm_debug').postMessage(TAB_REGISTER)
  -> 디버그 팝업이 수신하여 탭 상태 갱신
```

### 시나리오 2. Node.js / Vitest 환경 — 폴백 흐름

```text
registerTab() 호출
  -> getSerializeWorker() -> typeof Worker === 'undefined' -> null
  -> 폴백: getChannel()?.postMessage(TAB_REGISTER 직접 발화)
       -> BroadcastChannel 미지원이면 null -> 아무것도 하지 않음
```

### 시나리오 3. 페이지 언로드 — Worker 생명주기 정리

```text
window.beforeunload 발화
  -> initDebugChannel()에서 등록된 리스너
       -> closeDebugChannel() 호출
            -> _channel.close()
            -> _serializeWorker.terminate()   (이번 작업에서 추가)
            -> _serializeWorker = null
```

### 시나리오 4. toPatch() 계측 결과 시나리오

```text
개발 콘솔 출력 예시

  일반 케이스 (10~50개 변경항목):
    duration < 10ms -> 로그 없음

  비정상 케이스 (1000개 changeLog):
    [DSM] toPatch() 15.23ms (changeLog: 1000항목)
    -> 50ms 미만이므로 Worker 오프로딩 불필요
    -> 만약 50ms 초과라면 Phase 2 적응형 라우팅 검토
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일                                     | 변경 종류 | 변경 내용                                                                                                                   |
| ---------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/workers/serializer.worker.js`       | 신규 생성 | REGISTER_TAB 핸들러, Worker 내부 BroadcastChannel, JSON.parse 폴백                                                          |
| `src/debug/debug-channel.js`             | 수정      | _serializeWorker 변수, getSerializeWorker(), registerTab() Worker 오프로딩, closeDebugChannel() Worker 종료, 성능 계측 코드 |
| `src/core/api-mapper.js`                 | 수정      | toPatch() 전후 성능 계측 코드 (개발 환경 전용)                                                                              |
| `vitest.config.js`                       | 수정      | test/workers/ -> happy-dom 환경 추가                                                                                        |
| `test/workers/serializer.worker.test.js` | 신규 생성 | Worker onmessage 핸들러 단위 테스트 3케이스                                                                                 |

### Feature 브랜치명

```text
feat/serializer-worker
```

registerTab() 동작 방식이 변경되지만 외부 공개 API 시그니처 변화는 없다. Worker 오프로딩은 내부 구현 변경이다. semantic-release 기준 feat: -> minor +1.

### Commit Sequence

```markdown
# STEP A
perf(core): add performance.mark instrumentation to toPatch and registerTab

  - api-mapper.js: toPatch() 전후 performance.mark/measure 삽입 (개발 환경 전용)
  - debug-channel.js: registerTab() 전후 performance.mark/measure 삽입
  - 10ms 이상 소요 시 console.debug 출력 (50ms Long Task 기준 조기 경보)
  - 프로덕션 번들에서 Tree-shaking으로 계측 코드 블록 제거


# STEP B
feat(workers): add serializer worker for _stateRegistry broadcast offloading

  - src/workers/serializer.worker.js 신규 생성
  - REGISTER_TAB 메시지 수신 -> JSON.parse -> BroadcastChannel TAB_REGISTER 발화
  - BroadcastChannel을 Worker 내부에서 직접 인스턴스화 (MDN 명세 확인)
  - payload JSON.parse 실패 시 빈 객체로 폴백
  - 알 수 없는 메시지 타입 무시 처리


# STEP C
feat(debug): offload registerTab serialization to serialize worker

  - _serializeWorker 모듈 레벨 변수 추가 (Lazy Singleton)
  - getSerializeWorker(): new Worker(new URL(...)) Lazy 생성 + Node.js 가드
  - registerTab(): Worker 있으면 postMessage 위임, 없으면 직접 처리 폴백
  - JSON.stringify() 후 문자열로 전달 (postMessage structuredClone 비용 최소화)
  - closeDebugChannel(): _serializeWorker.terminate() + null 리셋 추가


# STEP D
test(workers): add serializer worker unit tests with happy-dom environment

  - vitest.config.js: test/workers/** -> happy-dom 환경 추가
  - test/workers/serializer.worker.test.js 신규 생성
  - SW-001: REGISTER_TAB -> BroadcastChannel TAB_REGISTER 발화 확인
  - SW-002: 잘못된 JSON payload -> 빈 states 폴백 확인
  - SW-003: 알 수 없는 메시지 타입 -> 무시 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                      | 기준                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| npm run lint              | error 0건                                                           |
| npm test                  | 전체 테스트 통과 (기존 회귀 없음)                                   |
| registerTab() Worker 경로 | getSerializeWorker() 반환값 있으면 worker.postMessage() 호출        |
| registerTab() 폴백 경로   | Worker null 시 channel.postMessage() 직접 호출                      |
| closeDebugChannel()       | _serializeWorker.terminate() 호출 후 null 리셋 확인                 |
| Worker JSON 정상 파싱     | 유효한 payload -> 올바른 states 객체 전달                           |
| Worker JSON 폴백          | 잘못된 payload -> 빈 객체 폴백, 에러 미전파                         |
| 계측 코드                 | toPatch() / registerTab() 호출 시 performance.mark 발화 (개발 환경) |

---

## (f-2) Phase 2 진행 조건 (측정 기반)

이번 Milestone 이후 실 프로젝트에 적용하여 계측 결과를 수집한다.

| 조건                         | Phase 2 작업                                             |
| ---------------------------- | -------------------------------------------------------- |
| toPatch() 실측 < 50ms (예상) | Worker 오프로딩 불필요. 계측 코드만 유지.                |
| toPatch() 실측 >= 50ms       | changeLog.length >= WORKER_THRESHOLD 조건부 Worker 위임. |
| registerTab() 실측 < 50ms    | 현재 구현 유지.                                          |
| registerTab() 실측 >= 50ms   | 이번 Milestone에서 Worker 오프로딩 완료.                 |
