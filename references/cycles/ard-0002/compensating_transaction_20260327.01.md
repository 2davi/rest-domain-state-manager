# Compensating Transaction — Pipeline Rollback Mechanism (2026-03-27)

> **Milestone:** `v1.6.0`
> **Branch:** `feat/compensating-transaction`
> **References:** `ard-0002-alignment.md § 3.7`

---

## (a) 현행 코드 진단

### 현재 `DomainState.save()`의 로컬 스냅샷

```javascript
// DomainState.save() 내부 — 591번째 줄
const snapshot = {
    data:        structuredClone(this._getTarget()),
    changeLog:   this._getChangeLog(),
    dirtyFields: this._getDirtyFields(),
    isNew:       this._isNew,
};
```

이 스냅샷은 **로컬 변수**다. `save()` 실패 시 `_rollback(snapshot)`으로 복원하고, 성공 시 그대로 GC 대상이 된다. 외부에서 접근할 방법이 없다.

### 현재 `DomainPipeline.run()`의 실패 처리

```text
after() 핸들러가 A.save(), B.save() 호출 → 둘 다 서버 커밋 성공
after() 핸들러가 C.save() 호출 → 서버 거부 (409 Conflict)

현재 결과:
  A, B: 인메모리 상태가 저장 성공 상태(isNew=false, changeLog 비움)
  C:    save() 내부 _rollback()이 자동 복원 (save() 진입 이전으로)

문제:
  A, B의 서버 커밋은 완료됐는데 C는 실패한 불일치 상태가 클라이언트에 유지됨
  소비자 앱이 이 상황을 인지할 방법이 없음
  A, B 인메모리 상태를 되돌릴 수 있는 인터페이스가 없음
```

### `failurePolicy` 미존재

현재 `DomainPipeline` 생성자 옵션은 `strict: boolean` 하나뿐이다. `strict: true`는 첫 실패에서 즉시 throw하지만 이미 성공한 상태를 되돌리지는 않는다.

---

## (b) 핵심 설계 결정

### ARD의 Symbol 제안 → Private Class Field 채택

ARD 3.7.2.A는 `Symbol('snapshot')`을 키로 사용하여 외부 접근을 차단하도록 제안했다. 이 프로젝트는 이미 `DomainState` 전반에서 Private Class Field(`#`)를 사용하고 있다. `#snapshot` 선언이 Symbol보다 더 명시적이고, IDE 자동완성·린팅·타입 추론 모두 지원된다. Private Class Field를 채택한다.

### 스냅샷 생명주기 설계

```text
현재 save()의 로컬 snapshot 변수 → #snapshot 인스턴스 필드로 격상

#snapshot 상태 전이:

  undefined         인스턴스 최초 생성. restore() 호출 시 no-op.
      ↓
  save() 진입       structuredClone으로 깊은 복사 → #snapshot = { data, changeLog, dirtyFields, isNew }
      ↓
  ┌─ save() 실패    _rollback()으로 복원. #snapshot은 유지됨 (재시도 기준점 보존)
  │                 소비자가 재시도 or pipeline이 restore() 호출
  │       ↓
  └─ save() 성공    #snapshot 유지. 이후 pipeline이 rollback-all 정책으로 restore() 호출 가능.
          ↓
  restore() 호출    #snapshot → 인메모리 복원 → #snapshot = undefined → dsm:rollback 이벤트 발행
```

`save()` 성공 후에도 `#snapshot`을 즉시 초기화하지 않는 이유 — 파이프라인이 후속 save() 실패를 감지한 뒤 이미 성공한 DomainState에 `restore()`를 호출할 수 있어야 한다. `#snapshot`이 살아있어야 파이프라인 수준 보상이 가능하다.

다음 `save()` 호출 시점에 `#snapshot`을 덮어쓴다. 이것이 스냅샷의 최신 기준점을 자동으로 갱신하는 메커니즘이다.

### `failurePolicy` 세 가지 정책

| 정책             | 동작                                                                                   | 사용 시나리오                                             |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `'ignore'`       | 기존 동작 유지. 실패는 `_errors`에 기록, 계속 진행. 보상 없음.                         | 독립적인 리소스 병렬 로드 (select, radio UI 초기화 등)    |
| `'rollback-all'` | 모든 after() 핸들러 완료 후 에러가 하나라도 있으면 성공한 전체 DomainState에 restore() | 단일 폼에서 여러 도메인을 동시에 save()하는 경우          |
| `'fail-fast'`    | 첫 번째 after() 핸들러 실패 시 즉시 중단, 이전 성공 상태들에 역순(LIFO)으로 restore()  | 순서 의존성 있는 직렬 save() (부모-자식 테이블 순서 보장) |

`strict` 옵션과의 관계 — `strict: true`는 첫 실패에서 즉시 throw(보상 없음)하는 현재 동작이다. `failurePolicy: 'fail-fast'`는 중단 + LIFO 보상 후 throw한다. 용도가 다르므로 병존한다.

### `dsm:rollback` 이벤트

```javascript
// 브라우저 환경에서 restore() 완료 시 발행
window.dispatchEvent(new CustomEvent('dsm:rollback', {
    detail: {
        label:     this._label,
        restored:  true,
        snapshot:  null,   // 복원 완료 후 undefined. 외부에 스냅샷 원본 노출 안 함.
    },
}));
```

파이프라인이 보상 트랜잭션을 완료한 뒤에는 `DomainPipeline`이 별도로 `dsm:pipeline-rollback` 이벤트를 발행하여 소비자가 성공/실패 결과 맵을 수신할 수 있도록 한다.

---

## (c) 변경 파일별 세부 분석

### STEP A — `DomainState.js`: `#snapshot` 필드 + `save()` 수정 + `restore()` 추가

#### 수정 1. `#snapshot` private class field 추가

`#shadowCache` 선언 아래에 추가한다.

```javascript
    /**
     * `save()` 진입 직전 상태의 깊은 복사 스냅샷.
     *
     * | 상태        | 의미                                                                |
     * |-------------|---------------------------------------------------------------------|
     * | `undefined` | `save()` 미호출 또는 `restore()` 완료. `restore()` 호출 시 no-op.  |
     * | `object`    | `save()` 진입 시 캡처된 스냅샷. 파이프라인 보상 트랜잭션 기준점.   |
     *
     * `save()` 성공 후에도 즉시 초기화하지 않는다.
     * `DomainPipeline`이 후속 save() 실패를 감지한 뒤 이미 성공한 인스턴스에
     * `restore()`를 호출할 수 있도록 기준점을 유지한다.
     *
     * 다음 `save()` 호출 시 덮어쓰여 자동으로 최신 기준점으로 갱신된다.
     *
     * @type {{ data: object, changeLog: import('../core/api-proxy.js').ChangeLogEntry[], dirtyFields: Set<string>, isNew: boolean } | undefined}
     */
    #snapshot = undefined;
```

#### 수정 2. `save()` 내부 로컬 snapshot → `#snapshot` 인스턴스 필드로 격상

기존 로컬 `const snapshot = { ... }` 선언을 `this.#snapshot = { ... }`으로 교체한다.

```javascript
    async save(requestPath) {
        const handler = this._assertHandler('save');
        const url = this._resolveURL(requestPath);

        // ── 스냅샷 캡처 ─────────────────────────────────────────────────────
        // save() 진입 직전 상태를 인스턴스 필드에 저장한다.
        // - 실패 시: _rollback()이 이 스냅샷으로 복원한다.
        // - 성공 시: DomainPipeline의 보상 트랜잭션을 위해 유지된다.
        // - 다음 save() 호출 시: 덮어쓰여 자동으로 최신 기준점으로 갱신된다.
        this.#snapshot = {
            data:        structuredClone(this._getTarget()),
            changeLog:   this._getChangeLog(),
            dirtyFields: this._getDirtyFields(),
            isNew:       this._isNew,
        };
        // ───────────────────────────────────────────────────────────────────

        try {
            // ... (기존 POST/PUT/PATCH 분기 코드 그대로)

            // ── 동기화 성공 후 상태 초기화 ──────────────────────────────────
            this._clearChangeLog();
            this._clearDirtyFields();
            // #snapshot은 유지한다. DomainPipeline 보상 트랜잭션 기준점 역할.
            if (this._debug) this._broadcast();

        } catch (err) {
            console.warn(ERR.SAVE_ROLLBACK(/** @type {any} */ (err)?.status ?? 0));
            this._rollback(this.#snapshot);
            // #snapshot은 유지한다. 재시도 시 동일 기준점으로 다시 rollback 가능.
            throw err;
        }
    }
```

기존 `_rollback()` 메서드의 파라미터도 `snapshot` 인자에서 `this.#snapshot`을 직접 참조하도록 변경한다.

```javascript
    _rollback(snapshot) {
        this._restoreTarget(snapshot.data);
        this._restoreChangeLog(snapshot.changeLog);
        this._restoreDirtyFields(snapshot.dirtyFields);
        this._isNew = snapshot.isNew;
        if (this._debug) this._broadcast();
    }
```

`_rollback(this.#snapshot)` 으로 호출하므로 메서드 시그니처 자체는 그대로 둔다.

#### 수정 3. `restore()` 공개 메서드 추가

`save()` 메서드 **바로 아래**, `remove()` 앞에 추가한다.

```javascript
    /**
     * 인메모리 도메인 상태를 `save()` 진입 이전 스냅샷으로 복원한다.
     *
     * `DomainPipeline`의 보상 트랜잭션(Compensating Transaction) 메커니즘에서
     * 파이프라인이 자동으로 호출한다. 소비자가 직접 호출할 수도 있다.
     *
     * ## 복원 대상
     * `save()` 진입 직전 캡처된 `#snapshot`의 네 가지 상태를 복원한다.
     * - `domainObject` (원본 데이터)
     * - `changeLog` (변경 이력)
     * - `dirtyFields` (변경된 필드 집합)
     * - `isNew` 플래그
     *
     * ## 멱등성 보장
     * `#snapshot`이 `undefined`이면 경고 로그 후 즉시 반환한다.
     * 동일 인스턴스에 여러 번 호출해도 에러 없이 동일한 결과를 낸다.
     *
     * ## 책임 범위
     * 이 메서드는 **프론트엔드 인메모리 상태만 복원**한다.
     * 서버에 이미 커밋된 상태(POST/PUT/PATCH 성공 후)를 서버에서 되돌리는 것은
     * 라이브러리 책임 범위 밖이며, 소비자가 `dsm:rollback` 이벤트를 구독하여
     * 서버 롤백 API를 직접 호출해야 한다.
     *
     * ## dsm:rollback 이벤트
     * 복원 완료 후 브라우저 환경에서 `window.dispatchEvent(new CustomEvent('dsm:rollback', ...))`를
     * 발행한다. 소비자 앱이 이 이벤트를 구독하여 사용자 알림을 표시할 수 있다.
     *
     * @returns {boolean} 복원 성공 시 `true`, 스냅샷 없어 no-op 시 `false`
     *
     * @example <caption>DomainPipeline이 자동으로 호출하는 경우</caption>
     * // failurePolicy: 'rollback-all' 설정 시 파이프라인이 자동 호출
     * const result = await DomainState.all({ a: ..., b: ..., c: ... }, {
     *     failurePolicy: 'rollback-all',
     * }).after('a', s => s.save('/api/a'))
     *   .after('b', s => s.save('/api/b'))
     *   .after('c', s => s.save('/api/c'))
     *   .run();
     *
     * @example <caption>소비자가 직접 호출하는 경우</caption>
     * try {
     *     await userState.save('/api/users/1');
     *     await profileState.save('/api/profiles/1');
     * } catch (err) {
     *     userState.restore();  // 인메모리 상태 복원
     *     // 서버 롤백은 소비자 책임: DELETE /api/users/1 등
     * }
     *
     * @example <caption>dsm:rollback 이벤트 구독</caption>
     * window.addEventListener('dsm:rollback', (e) => {
     *     console.warn(`[UI] ${e.detail.label} 상태가 복원되었습니다.`);
     *     showErrorNotification('저장에 실패하여 이전 상태로 복원되었습니다.');
     * });
     */
    restore() {
        // ── 멱등성 방어 ─────────────────────────────────────────────────────
        // #snapshot이 없으면 no-op. save() 미호출이거나 이미 restore()된 상태.
        if (this.#snapshot === undefined) {
            console.warn(`[DSM][${this._label}] restore(): 스냅샷이 없습니다. save() 호출 없이 restore()를 호출했거나 이미 복원된 상태입니다.`);
            return false;
        }
        // ───────────────────────────────────────────────────────────────────

        // ── 인메모리 상태 복원 ───────────────────────────────────────────────
        this._rollback(this.#snapshot);
        // ───────────────────────────────────────────────────────────────────

        // ── 스냅샷 초기화 ────────────────────────────────────────────────────
        // 복원 완료. 다음 restore() 호출은 no-op이 된다 (멱등성).
        this.#snapshot = undefined;
        // ───────────────────────────────────────────────────────────────────

        // ── dsm:rollback 이벤트 발행 ─────────────────────────────────────────
        // 소비자 앱이 이 이벤트를 구독하여 서버 롤백 API 호출 또는 UI 알림 표시.
        // Node.js / Vitest 환경에서는 window가 없으므로 건너뛴다.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('dsm:rollback', {
                detail: { label: this._label },
            }));
        }
        // ───────────────────────────────────────────────────────────────────

        return true;
    }
```

---

### STEP B — `src/constants/error.messages.js` 에러 상수 추가

```javascript
    // ── DomainPipeline 보상 트랜잭션 ───────────────────────────────────────────
    PIPELINE_ROLLBACK_WARN:
        `${PREFIX} DomainPipeline: 파이프라인 실패로 보상 트랜잭션을 실행합니다. ` +
        '성공한 DomainState 인스턴스를 save() 이전 상태로 복원합니다. ' +
        '서버에 이미 커밋된 데이터는 소비자가 직접 처리해야 합니다.',
```

---

### STEP C — `DomainPipeline.js` 수정 (3개 지점)

#### 수정 1. `PipelineOptions` typedef 확장

```javascript
/**
 * `DomainPipeline` 생성자의 `options` 파라미터.
 *
 * @typedef {object} PipelineOptions
 * @property {boolean} [strict=false]
 *   `true`이면 fetch 또는 `after()` 핸들러 실패 시 즉시 reject.
 *   `false`(기본값)이면 `_errors`에 기록하고 계속 진행.
 * @property {'ignore'|'rollback-all'|'fail-fast'} [failurePolicy='ignore']
 *   파이프라인 실패 시 보상 트랜잭션 정책.
 *
 *   | 값             | 동작                                                                   |
 *   |----------------|------------------------------------------------------------------------|
 *   | `'ignore'`     | 기존 동작 유지. 실패를 `_errors`에 기록하고 계속 진행. 보상 없음.     |
 *   | `'rollback-all'`| 모든 핸들러 완료 후 에러가 하나라도 있으면 전체 resolved에 restore(). |
 *   | `'fail-fast'`  | 첫 번째 핸들러 실패 시 즉시 중단. 이전 성공 상태들에 LIFO restore().  |
 */
```

#### 수정 2. constructor에 `_failurePolicy` 추가

```javascript
    constructor(resourceMap, { strict = false, failurePolicy = 'ignore' } = {}) {
        this._resourceMap = resourceMap;
        this._strict      = strict;
        this._queue       = [];

        /**
         * 파이프라인 실패 시 보상 트랜잭션 정책.
         *
         * @type {'ignore'|'rollback-all'|'fail-fast'}
         */
        this._failurePolicy = failurePolicy;
    }
```

#### 수정 3. `run()` — 보상 트랜잭션 로직 추가

`run()` 메서드를 아래로 **통째로 교체**한다. JSDoc `## 실행 흐름` 항목에 보상 트랜잭션 설명을 추가하고, 코드는 아래로 교체한다.

```javascript
    async run() {
        const keys = Object.keys(this._resourceMap);
        /** @type {PipelineError[]} */
        const errors = [];

        // ── 1단계: 병렬 fetch ─────────────────────────────────────────────────
        console.debug(formatMessage(LOG.pipeline.fetchStart, { keys: keys.join(', ') }));

        const settled = await Promise.allSettled(keys.map((k) => this._resourceMap[k]));

        /** @type {Record<string, import('./DomainState.js').DomainState>} */
        const resolved = {};

        for (let i = 0; i < keys.length; i++) {
            const key    = keys[i];
            const result = settled[i];

            if (result.status === 'fulfilled') {
                resolved[key] = result.value;
            } else {
                errors.push({ key, error: result.reason });
                if (this._strict) throw result.reason;
                broadcastError(key, result.reason);
                console.error(`[DSM][Pipeline] fetch 실패 | key: ${key}`, result.reason);
            }
        }

        console.debug(LOG.pipeline.fetchDone);

        // ── 2단계: after() 핸들러 순차 실행 ──────────────────────────────────
        // fail-fast 정책에서 LIFO 보상을 위해 완료된 키를 순서대로 추적한다.
        /** @type {string[]} */
        const completedKeys = [];

        for (const { key, handler } of this._queue) {
            const state = resolved[key];

            if (!state) {
                errors.push({
                    key,
                    error: new Error(`fetch 실패로 인해 "${key}" 핸들러를 건너뜁니다.`),
                });
                continue;
            }

            console.debug(formatMessage(LOG.pipeline.afterStart, { key }));
            try {
                await handler(state);
                console.debug(formatMessage(LOG.pipeline.afterDone, { key }));
                completedKeys.push(key);
            } catch (err) {
                errors.push({ key, error: err });
                broadcastError(key, err);
                console.error(
                    formatMessage(LOG.pipeline.afterError, { key, error: String(err) }),
                    err
                );

                // ── fail-fast: 즉시 중단 + LIFO 보상 ─────────────────────────
                if (this._failurePolicy === 'fail-fast') {
                    this._compensate(resolved, [...completedKeys].reverse());
                    if (this._strict) throw err;
                    errors.push({ key, error: err });
                    break;  // 나머지 핸들러 건너뜀
                }

                if (this._strict) throw err;
            }
        }

        // ── 3단계: rollback-all 보상 트랜잭션 ────────────────────────────────
        // 모든 핸들러 완료 후 에러가 하나라도 있으면 전체 resolved에 restore()
        if (this._failurePolicy === 'rollback-all' && errors.length > 0) {
            this._compensate(resolved, Object.keys(resolved));
        }

        // ── 4단계: dsm:pipeline-rollback 이벤트 발행 ─────────────────────────
        if (errors.length > 0 && this._failurePolicy !== 'ignore') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('dsm:pipeline-rollback', {
                    detail: {
                        errors,
                        resolved: Object.fromEntries(
                            Object.entries(resolved).map(([k, v]) => [k, v._label])
                        ),
                    },
                }));
            }
        }

        // ── 5단계: 결과 반환 ──────────────────────────────────────────────────
        /** @type {PipelineResult} */
        const output = { ...resolved };
        if (errors.length > 0) output._errors = errors;
        return output;
    }

    // ── 내부 유틸: 보상 트랜잭션 실행 ────────────────────────────────────────────

    /**
     * 지정된 키 목록의 DomainState에 역순으로 `restore()`를 호출한다.
     *
     * `fail-fast` 정책에서는 LIFO 순서(completedKeys를 reverse()한 것)로,
     * `rollback-all` 정책에서는 전체 resolved 키 목록으로 호출한다.
     *
     * `restore()`는 멱등성이 보장되므로 스냅샷이 없는 DomainState에 호출해도 안전하다.
     *
     * @param {Record<string, import('./DomainState.js').DomainState>} resolved
     *   성공한 DomainState 맵
     * @param {string[]} keys
     *   restore()를 호출할 키 목록 (순서가 실행 순서가 됨)
     * @returns {void}
     */
    _compensate(resolved, keys) {
        console.warn(ERR.PIPELINE_ROLLBACK_WARN);
        for (const key of keys) {
            const state = resolved[key];
            if (state && typeof state.restore === 'function') {
                state.restore();
            }
        }
    }
```

---

## (d) 예상 시나리오

### 시나리오 1. `failurePolicy: 'rollback-all'` — 병렬 save() 중 하나 실패

```text
파이프라인 설정:
  failurePolicy: 'rollback-all'

1단계: fetch 모두 성공 (A, B, C DomainState 생성)
2단계 after() 핸들러 실행:
  after('a'): a.save('/api/a') → 성공 → a.#snapshot 유지
  after('b'): b.save('/api/b') → 성공 → b.#snapshot 유지
  after('c'): c.save('/api/c') → 서버 409 → c._rollback() 자동 실행
                                 errors에 기록. 다음 핸들러 계속.

3단계 rollback-all 보상:
  errors.length > 0 확인
  _compensate(resolved, ['a', 'b', 'c']) 실행:
    a.restore() → a 인메모리를 save() 진입 이전으로 복원 → dsm:rollback 발행
    b.restore() → b 인메모리를 save() 진입 이전으로 복원 → dsm:rollback 발행
    c.restore() → #snapshot 없음 (이미 _rollback으로 처리됨) → no-op, false 반환

4단계 dsm:pipeline-rollback 이벤트 발행:
  { errors: [{key: 'c', error: HttpError}], resolved: {a: 'user', b: 'profile', c: 'order'} }

소비자 코드:
  window.addEventListener('dsm:pipeline-rollback', (e) => {
      showToast('일부 저장에 실패했습니다. 서버 관리자에게 문의하세요.');
      // 서버 롤백 필요 시: DELETE /api/a, DELETE /api/b 등
  });
```

### 시나리오 2. `failurePolicy: 'fail-fast'` — 직렬 save() 중 첫 번째 실패

```text
파이프라인 설정:
  failurePolicy: 'fail-fast'

1단계: fetch 모두 성공
2단계 after() 핸들러 실행:
  after('parent'): parent.save() → 성공 → completedKeys: ['parent']
  after('child'):  child.save()  → 실패 → 즉시 중단

  _compensate(resolved, ['parent']) 실행 (LIFO = 역순):
    parent.restore() → save() 진입 이전으로 복원 → dsm:rollback 발행

  나머지 핸들러('grandchild' 등) 건너뜀

결과: A, B 인메모리 모두 깨끗하게 복원.
      소비자는 dsm:pipeline-rollback 이벤트로 상황 파악.
```

### 시나리오 3. `failurePolicy: 'ignore'` (기본) — 기존 동작 보존

```text
failurePolicy 미지정 시 기본값 'ignore':
  현재 DomainPipeline 동작과 완전 동일.
  restore(), _compensate() 호출 없음.
  하위 호환성 100% 유지.
```

### 시나리오 4. `restore()` 멱등성

```text
// save() 호출 없이 restore() → no-op
state.restore(); // false 반환, console.warn만 출력

// 두 번 연속 restore() → 두 번째는 no-op
state.save('/api/...');
state.restore(); // true 반환, 복원 완료, #snapshot = undefined
state.restore(); // false 반환, no-op (이미 undefined)
```

---

## (e) 계획 수립

### 수정/생성 파일 목록

| 파일                                 | 변경 종류  | 변경 내용                                                                                                                                       |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/DomainState.js`          |  **수정**  | `#snapshot` private field 추가, `save()` 스냅샷 인스턴스 필드로 격상, `restore()` 공개 메서드 추가                                              |
| `src/domain/DomainPipeline.js`       |  **수정**  | `PipelineOptions` typedef에 `failurePolicy` 추가, constructor에 `_failurePolicy` 추가, `run()` 보상 로직 추가, `_compensate()` 내부 메서드 추가 |
| `src/constants/error.messages.js`    |  **수정**  | `ERR.PIPELINE_ROLLBACK_WARN` 상수 추가                                                                                                          |
| `test/domain/DomainState.test.js`    |  **수정**  | `restore()` 관련 테스트 추가                                                                                                                    |
| `test/domain/DomainPipeline.test.js` |  **수정**  | `failurePolicy` 관련 통합 테스트 추가                                                                                                           |

### Feature 브랜치명

```text
feat/compensating-transaction
```

`restore()` 공개 API 신규 추가, `DomainPipeline` 옵션 확장. semantic-release 기준 minor +1.

### Commit Sequence

```markdown
# STEP A — 에러 상수 추가
feat(constants): add PIPELINE_ROLLBACK_WARN error message

  - ERR.PIPELINE_ROLLBACK_WARN: 보상 트랜잭션 실행 시 소비자 알림 메시지


# STEP B — DomainState #snapshot 필드 + restore() 구현
feat(domain): add #snapshot field and restore() for compensating transaction

  - #snapshot private class field 추가 (undefined / snapshot 객체 두 상태)
  - save(): 로컬 snapshot 변수 → this.#snapshot 인스턴스 필드로 격상
  - save() 성공 후 #snapshot 유지 (파이프라인 보상 트랜잭션 기준점 보존)
  - restore(): #snapshot 기반 인메모리 복원 + 멱등성 보장 + dsm:rollback 이벤트
  - restore() 반환값: 복원 성공 true, 스냅샷 없어 no-op false
  - JSDoc: restore() 책임 범위 명시 (인메모리 only, 서버 롤백은 소비자 책임)


# STEP C — DomainPipeline failurePolicy + 보상 트랜잭션
feat(domain): add failurePolicy and compensating transaction to DomainPipeline

  - PipelineOptions: failurePolicy 옵션 추가 ('ignore'|'rollback-all'|'fail-fast')
  - constructor: _failurePolicy 필드 추가 (기본값 'ignore' — 하위 호환)
  - run(): completedKeys 추적으로 LIFO 보상 순서 보장
  - run(): fail-fast 시 즉시 중단 + _compensate(LIFO) 실행
  - run(): rollback-all 시 전체 완료 후 _compensate(전체) 실행
  - run(): dsm:pipeline-rollback 이벤트 발행 (에러 맵 + 성공 레이블 맵 포함)
  - _compensate(): 지정 키 목록에 state.restore() 순차 실행, 멱등성 안전


# STEP D — Vitest 통합 테스트
test(domain): add restore() and failurePolicy pipeline integration tests

  - restore() 정상: save() 후 restore() → 인메모리 복원 확인
  - restore() 멱등성: 스냅샷 없이 호출 → false 반환, no-op 확인
  - restore() 멱등성: 2회 연속 호출 → 두 번째 false 반환 확인
  - restore() 이벤트: dsm:rollback CustomEvent 발행 확인
  - failurePolicy 'ignore': 기존 동작 유지 확인 (restore() 미호출)
  - failurePolicy 'rollback-all': 실패 후 전체 resolved에 restore() 확인
  - failurePolicy 'fail-fast': 첫 실패 시 중단 + LIFO restore() 확인
  - dsm:pipeline-rollback 이벤트: 에러 맵 페이로드 포함 확인
```

---

## (f) 검증 기준 (Definition of Done)

| 항목                            | 기준                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `npm run lint`                  | error 0건                                                     |
| `npm test`                      | 전체 테스트 통과 (기존 회귀 없음)                             |
| `restore()` 정상 복원           | save() 진입 이전 데이터·changeLog·dirtyFields·isNew 복원 확인 |
| `restore()` 멱등성              | 스냅샷 없을 때 false 반환, 2회 호출 시 두 번째 false          |
| `restore()` 이벤트              | `dsm:rollback` CustomEvent label 포함 확인                    |
| `failurePolicy: 'ignore'`       | 기존 동작 동일, restore() 미호출                              |
| `failurePolicy: 'rollback-all'` | 에러 발생 시 전체 resolved.restore() 호출                     |
| `failurePolicy: 'fail-fast'`    | 첫 실패 즉시 중단, 이전 성공 역순 restore()                   |
| `dsm:pipeline-rollback`         | 에러 발생 시 이벤트 발행, detail에 errors 포함                |
| 하위 호환성                     | `failurePolicy` 미지정 시 기존 동작 완전 동일                 |
