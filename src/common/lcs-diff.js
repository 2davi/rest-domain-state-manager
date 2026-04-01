/**
 * LCS(Longest Common Subsequence) 기반 깊은 비교 유틸리티
 *
 * `DomainState`의 `lazy` tracking mode에서 `save()` 호출 시,
 * 인스턴스 생성 시점에 저장된 `_initialSnapshot`과 현재 도메인 객체를 비교하여
 * RFC 6902 형식의 `changeLog` 배열을 생성한다.
 *
 * ## `realtime` 모드와의 차이
 * `realtime` 모드에서는 Proxy `set` 트랩이 발화될 때마다 changeLog에 즉시 기록한다.
 * `lazy` 모드에서는 set 트랩 기록을 건너뛰고, `save()` 시점에 이 유틸로 한 번에 계산한다.
 * 동일한 필드를 10번 바꿔도 최종 변경 결과만 1개 항목으로 기록되어
 * 네트워크 페이로드가 최소화된다.
 *
 * ## 배열 비교 전략
 * - `itemKey` 지정 시: LCS 알고리즘으로 항목 동일성(itemKey 필드값 기준)을 판단한다.
 *   위치가 달라도 같은 항목으로 인식하며, 삭제/추가가 정확히 구분된다.
 * - `itemKey` 미지정 시: 위치(positional) 기준 비교를 수행한다.
 *   같은 위치의 값이 달라지면 'replace'로 기록한다.
 *
 * ## `itemKey` 필요성 예시
 * ```
 * 초기: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
 * 현재: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }]
 *
 * positional(오류):
 *   index 0: id:1 → id:2 → 'replace'
 *   index 1: id:2 → id:3 → 'replace'
 *
 * LCS(itemKey='id', 정확):
 *   id:1 → 초기에만 있음 → 'remove'
 *   id:2 → 양쪽에 있음  → no-op
 *   id:3 → 현재에만 있음 → 'add'
 * ```
 *
 * @module common/lcs-diff
 * @see {@link https://www.cs.columbia.edu/~allen/S14/NOTES/lcs.pdf LCS 알고리즘 참조}
 * @see {@link https://www.rfc-editor.org/rfc/rfc6902 RFC 6902 — JSON Patch}
 */

// ════════════════════════════════════════════════════════════════════════════════
// 타입 정의
// ════════════════════════════════════════════════════════════════════════════════

/**
 * RFC 6902 JSON Patch 연산 하나를 나타내는 변경 이력 항목.
 * `api-proxy.js`의 `ChangeLogEntry`와 동일한 구조를 사용한다.
 *
 * @typedef {object} ChangeLogEntry
 * @property {'add'|'replace'|'remove'} op         - RFC 6902 연산 종류
 * @property {string}                   path       - JSON Pointer 경로 (예: `/name`, `/items/0`)
 * @property {*}                        [newValue] - 새 값. `op === 'remove'` 시 존재하지 않음.
 * @property {*}                        [oldValue] - 이전 값. `op === 'add'` 시 존재하지 않음.
 */

// ════════════════════════════════════════════════════════════════════════════════
// 내부 유틸
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 값이 plain object인지 판단한다.
 *
 * `null`, 배열, Date, RegExp 등을 배제하고
 * `Object.prototype`을 직접 가지거나 프로토타입이 없는 순수 객체만 `true`를 반환한다.
 *
 * @param {*} val - 검사할 값
 * @returns {boolean}
 */
function _isPlainObject(val) {
    if (val === null || typeof val !== 'object') return false;
    if (Array.isArray(val)) return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
}

// ════════════════════════════════════════════════════════════════════════════════
// LCS 알고리즘 (배열 비교용)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * `itemKey` 기반 LCS 알고리즘으로 두 배열의 매칭 쌍 인덱스를 계산한다.
 *
 * ## 알고리즘
 * 표준 LCS DP 테이블을 구성한 뒤 역추적(backtracking)으로
 * 일치하는 항목 쌍(oldIdx, newIdx)의 목록을 반환한다.
 *
 * 시간 복잡도: O(M × N) — M: oldArr 길이, N: newArr 길이
 * 공간 복잡도: O(M × N)
 *
 * @param {Array<*>} oldArr    - 이전 배열
 * @param {Array<*>} newArr    - 현재 배열
 * @param {string}   itemKey   - 항목 동일성 기준 필드명
 * @returns {Array<{ oldIdx: number, newIdx: number }>} 매칭 쌍 인덱스 목록 (오름차순)
 */
function _computeLCS(oldArr, newArr, itemKey) {
    const m = oldArr.length;
    const n = newArr.length;

    // DP 테이블 생성: dp[i][j] = oldArr[0..i-1], newArr[0..j-1]의 LCS 길이
    // Int32Array 대신 일반 배열 사용 — JavaScript 배열이 V8에서 충분히 최적화됨
    /** @type {number[][]} */
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            // itemKey 필드값으로 동일성 판단
            const oldKey = /** @type {any} */ (oldArr[i - 1])?.[itemKey];
            const newKey = /** @type {any} */ (newArr[j - 1])?.[itemKey];

            if (oldKey !== undefined && oldKey === newKey) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // 역추적으로 매칭 쌍 추출 (뒤에서 앞으로 탐색 후 unshift로 정렬 유지)
    /** @type {Array<{ oldIdx: number, newIdx: number }>} */
    const matches = [];
    let i = m;
    let j = n;

    while (i > 0 && j > 0) {
        const oldKey = /** @type {any} */ (oldArr[i - 1])?.[itemKey];
        const newKey = /** @type {any} */ (newArr[j - 1])?.[itemKey];

        if (oldKey !== undefined && oldKey === newKey) {
            matches.unshift({ oldIdx: i - 1, newIdx: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return matches;
}

/**
 * `itemKey` 기반 LCS를 이용하여 두 배열의 RFC 6902 diff를 생성한다.
 *
 * 매칭되지 않은 old 항목 → `'remove'`, 매칭되지 않은 new 항목 → `'add'`.
 * 매칭된 항목 쌍은 내부 필드를 재귀 비교하여 `'replace'`를 생성한다.
 *
 * `'remove'` path: `basePath/구_인덱스` — RFC 6902 표준 인덱스 기반 제거
 * `'add'` path:    `basePath/-`         — RFC 6902 표준 끝 추가 표기
 *
 * @param {Array<*>} oldArr    - 이전 배열
 * @param {Array<*>} newArr    - 현재 배열
 * @param {string}   itemKey   - 항목 동일성 기준 필드명
 * @param {string}   basePath  - JSON Pointer 경로 prefix (예: `/items`)
 * @returns {ChangeLogEntry[]}
 */
function _diffArraysByKey(oldArr, newArr, itemKey, basePath) {
    /** @type {ChangeLogEntry[]} */
    const result = [];

    const matches = _computeLCS(oldArr, newArr, itemKey);
    const matchedOld = new Set(matches.map((m) => m.oldIdx));
    const matchedNew = new Set(matches.map((m) => m.newIdx));

    // remove: 이전 배열에만 있는 항목
    for (let oi = 0; oi < oldArr.length; oi++) {
        if (!matchedOld.has(oi)) {
            result.push({ op: 'remove', path: `${basePath}/${oi}`, oldValue: oldArr[oi] });
        }
    }

    // add: 현재 배열에만 있는 항목 (RFC 6902 '-' 인덱스: 배열 끝에 추가)
    for (let ni = 0; ni < newArr.length; ni++) {
        if (!matchedNew.has(ni)) {
            result.push({ op: 'add', path: `${basePath}/-`, newValue: newArr[ni] });
        }
    }

    // 매칭 쌍 내부 필드 재귀 비교 (replace 감지)
    for (const { oldIdx, newIdx } of matches) {
        const oldItem = oldArr[oldIdx];
        const newItem = newArr[newIdx];

        if (_isPlainObject(oldItem) && _isPlainObject(newItem)) {
            // 매칭된 항목 내부 필드 비교
            const innerDiffs = _diffObject(
                /** @type {Record<string, *>} */ (oldItem),
                /** @type {Record<string, *>} */ (newItem),
                itemKey,
                `${basePath}/${oldIdx}`
            );
            result.push(...innerDiffs);
        } else if (oldItem !== newItem) {
            result.push({
                op: 'replace',
                path: `${basePath}/${oldIdx}`,
                oldValue: oldItem,
                newValue: newItem,
            });
        }
    }

    return result;
}

/**
 * 위치(positional) 기준으로 두 배열의 RFC 6902 diff를 생성한다.
 *
 * `itemKey`가 없을 때의 폴백 전략:
 * - 같은 인덱스에서 값이 달라지면 → `'replace'`
 * - 현재 배열이 더 길면 초과분 → `'add'`
 * - 이전 배열이 더 길면 초과분 → `'remove'`
 *
 * @param {Array<*>} oldArr   - 이전 배열
 * @param {Array<*>} newArr   - 현재 배열
 * @param {string}   basePath - JSON Pointer 경로 prefix
 * @returns {ChangeLogEntry[]}
 */
function _diffArraysPositional(oldArr, newArr, basePath) {
    /** @type {ChangeLogEntry[]} */
    const result = [];

    const minLen = Math.min(oldArr.length, newArr.length);

    for (let i = 0; i < minLen; i++) {
        const oldVal = oldArr[i];
        const newVal = newArr[i];
        const path = `${basePath}/${i}`;

        if (_isPlainObject(oldVal) && _isPlainObject(newVal)) {
            const innerDiffs = _diffObject(
                /** @type {Record<string, *>} */ (oldVal),
                /** @type {Record<string, *>} */ (newVal),
                undefined,
                path
            );
            result.push(...innerDiffs);
        } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            const innerDiffs = _diffArraysPositional(oldVal, newVal, path);
            result.push(...innerDiffs);
        } else if (oldVal !== newVal) {
            result.push({ op: 'replace', path, oldValue: oldVal, newValue: newVal });
        }
    }

    // 현재 배열이 더 긴 경우: 초과 항목 추가
    for (let i = minLen; i < newArr.length; i++) {
        result.push({ op: 'add', path: `${basePath}/-`, newValue: newArr[i] });
    }

    // 이전 배열이 더 긴 경우: 초과 항목 제거
    // JSON Patch 관점에서 뒤 인덱스부터 제거하는 것이 안전하나,
    // lazy diff 결과는 서버로 전송 후 서버가 적용하므로 인덱스 순서를 유지한다.
    for (let i = minLen; i < oldArr.length; i++) {
        result.push({ op: 'remove', path: `${basePath}/${i}`, oldValue: oldArr[i] });
    }

    return result;
}

/**
 * 두 plain object의 RFC 6902 diff를 재귀적으로 생성한다.
 *
 * 키를 union하여 순회하고, 각 키의 값 유형에 따라 재귀 또는 직접 비교한다.
 *
 * @param {Record<string, *>}  initial  - 이전 객체
 * @param {Record<string, *>}  current  - 현재 객체
 * @param {string | undefined} itemKey  - 배열 항목 동일성 기준 필드명 (없으면 positional)
 * @param {string}             basePath - JSON Pointer 경로 prefix
 * @returns {ChangeLogEntry[]}
 */
function _diffObject(initial, current, itemKey, basePath) {
    /** @type {ChangeLogEntry[]} */
    const result = [];

    // 초기 객체와 현재 객체의 키를 union하여 모든 변경을 탐지한다
    const allKeys = new Set([
        ...Object.keys(initial ?? {}),
        ...Object.keys(current ?? {}),
    ]);

    for (const key of allKeys) {
        const path = `${basePath}/${key}`;
        const inInitial = Object.prototype.hasOwnProperty.call(initial ?? {}, key);
        const inCurrent = Object.prototype.hasOwnProperty.call(current ?? {}, key);
        const oldVal = inInitial ? initial[key] : undefined;
        const newVal = inCurrent ? current[key] : undefined;

        if (!inInitial && inCurrent) {
            // 키 신규 추가
            result.push({ op: 'add', path, newValue: newVal });
        } else if (inInitial && !inCurrent) {
            // 키 제거
            result.push({ op: 'remove', path, oldValue: oldVal });
        } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            // 배열: itemKey 여부에 따라 LCS 또는 positional
            const arrayDiffs = itemKey
                ? _diffArraysByKey(oldVal, newVal, itemKey, path)
                : _diffArraysPositional(oldVal, newVal, path);
            result.push(...arrayDiffs);
        } else if (_isPlainObject(oldVal) && _isPlainObject(newVal)) {
            // 중첩 객체: 재귀
            const nestedDiffs = _diffObject(
                /** @type {Record<string, *>} */ (oldVal),
                /** @type {Record<string, *>} */ (newVal),
                itemKey,
                path
            );
            result.push(...nestedDiffs);
        } else if (oldVal !== newVal) {
            // 원시값 교체
            result.push({ op: 'replace', path, oldValue: oldVal, newValue: newVal });
        }
        // oldVal === newVal → no-op (changeLog에 기록 안 함)
    }

    return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 두 도메인 객체를 깊이 비교하여 RFC 6902 형식의 `changeLog` 배열을 반환한다.
 *
 * `DomainState`의 `lazy` tracking mode에서 `save()` 호출 시
 * `_initialSnapshot`(초기 상태)과 `_getTarget()`(현재 상태)을 비교할 때 사용된다.
 *
 * ## 배열 비교 전략
 * - `itemKey` 지정 시: LCS 알고리즘 (항목 동일성 = itemKey 필드값 일치)
 * - `itemKey` 미지정 시: positional 비교 (위치 기반)
 *
 * ## 경고: `initial` 또는 `current`가 null/undefined인 경우
 * 최상위 수준에서는 null/undefined를 빈 객체로 안전하게 처리한다.
 * 단, VO 레이어에서는 DomainState 생성 시 항상 유효한 객체가 보장되어야 한다.
 *
 * @param {object}             initial  - 이전 상태 (예: `_initialSnapshot`)
 * @param {object}             current  - 현재 상태 (예: `_getTarget()`)
 * @param {string | undefined} [itemKey] - 배열 항목 동일성 기준 필드명.
 *                                         `UILayout.static itemKey` 또는 `fromJSON()` options에서 주입.
 *                                         미지정 시 positional fallback.
 * @returns {ChangeLogEntry[]} RFC 6902 형식의 변경 이력 배열.
 *   변경이 없으면 빈 배열 `[]`을 반환한다.
 *
 * @example <caption>기본 사용 — 스칼라 변경 감지</caption>
 * const initial = { name: 'Davi', email: 'davi@example.com' };
 * const current = { name: 'Lee',  email: 'davi@example.com' };
 * deepDiff(initial, current);
 * // → [{ op: 'replace', path: '/name', oldValue: 'Davi', newValue: 'Lee' }]
 *
 * @example <caption>itemKey 없는 배열 — positional fallback</caption>
 * const initial = { tags: ['A', 'B', 'C'] };
 * const current = { tags: ['A', 'X', 'C'] };
 * deepDiff(initial, current);
 * // → [{ op: 'replace', path: '/tags/1', oldValue: 'B', newValue: 'X' }]
 *
 * @example <caption>itemKey 있는 배열 — LCS 기반 정확한 감지</caption>
 * const initial = { items: [{ id: 1, v: 'A' }, { id: 2, v: 'B' }] };
 * const current = { items: [{ id: 2, v: 'B' }, { id: 3, v: 'C' }] };
 * deepDiff(initial, current, 'id');
 * // → [
 * //   { op: 'remove', path: '/items/0', oldValue: { id: 1, v: 'A' } },
 * //   { op: 'add',    path: '/items/-', newValue: { id: 3, v: 'C' } },
 * // ]
 */
export function deepDiff(initial, current, itemKey) {
    // 최상위가 배열인 케이스 (DomainCollection의 Root Array 시나리오)
    if (Array.isArray(initial) && Array.isArray(current)) {
        return itemKey
            ? _diffArraysByKey(initial, current, itemKey, '')
            : _diffArraysPositional(initial, current, '');
    }

    // 일반 객체 비교 (가장 흔한 케이스: 단일 DTO)
    return _diffObject(
        /** @type {Record<string, *>} */ (initial ?? {}),
        /** @type {Record<string, *>} */ (current ?? {}),
        itemKey,
        ''
    );
}
