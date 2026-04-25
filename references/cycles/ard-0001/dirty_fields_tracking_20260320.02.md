# Dirty Fields Tracking (2026-03-20)

## (a) 분기 알고리즘의 정합성 검증

### 케이스 별 예상 시나리오

#### Case 1: POST  - 신규 리소스

```text
isNew = true
→ POST 무조건, dirtyFields 체크 없음
→ 정상. POST 분기는 isNew 플래그 하나로만 결정되어야 함.
```

#### Case 2: PUT   - 변경 없는 재저장 PUT

```text
isNew = false
dirtyFields.size = 0  (아무것도 안 바꾸고 save() 호출)
totalFields = 4

dirtyRatio = 0 / 4 = 0
→ dirtyFields.size === 0  → PUT
→ 정상. 의도적 재저장(Intentional re-save) 패턴을 정확히 처리.
```

#### Case 3: PATCH - 소량 변경

```text
isNew = false
데이터: { id, name, email, role, address }  (5개 필드)
변경: user.data.name = 'Davi'   → dirtyFields = { 'name' }

dirtyFields.size = 1, totalFields = 5
dirtyRatio = 1/5 = 0.2 < 0.7
→ PATCH
→ 정상. 5개 중 1개만 바뀐 거니까 JSON Patch 배열이 효율적.
```

#### Case 4: PUT   - 대량 변경

```text
isNew = false
데이터: { id, name, email, role, address }  (5개 필드)
변경: name, email, role, address 전부 수정 → dirtyFields = { 'name', 'email', 'role', 'address' }

dirtyFields.size = 4, totalFields = 5
dirtyRatio = 4/5 = 0.8 ≥ 0.7
→ PUT
→ 정상. 80%가 바뀌면 Patch 배열보다 전체 직렬화가 더 단순하고 효율적.
```

#### Case 5: Edge Case (빈 객체)

```text
isNew = false
데이터: {}  (필드가 하나도 없는 객체)

totalFields = Object.keys({}).length = 0
dirtyRatio = totalFields > 0 ? dirtyFields.size / totalFields : 0
→ totalFields가 0이면 0을 강제 반환 (ZeroDivisionError 방어)
→ dirtyFields.size가 0이면 → PUT
→ 정상. 빈 도메인 객체에 대한 save()는 PUT으로 처리되는 게 의미론적으로 맞아.
```

## (b) `api-mapper.js` JSDoc 주석에 Drity Checking 분기 전략 반영

> 앞선 커밋 및 빌드 작업에서 반영된 Dirty Checking 분기 전략에 대한 설명이
> `api-mapper.js` 내에 반영되지 않았다.

```javascript
//수정 전
/**
 * ## 호출 시점
 * - `DomainState.save()` 에서 `isNew === true` → POST
 * - `DomainState.save()` 에서 `changeLog.length === 0` → PUT (변경 없는 재저장)  ← 구버전 설명
 */

//수정 후
/**
 * ## 호출 시점
 * - `DomainState.save()` 에서 `isNew === true`                            → POST
 * - `DomainState.save()` 에서 `dirtyFields.size === 0`                    → PUT (변경 없는 재저장)
 * - `DomainState.save()` 에서 `dirtyRatio >= DIRTY_THRESHOLD`             → PUT (대량 변경)
 */
```

### Feature 브랜치명 및 커밋 메시지

- **브랜치명:** `feature/dirty-fields-tracking`
- **Commit Sequence:**

```markdown
# 커밋 1 — JSDoc 정합성 수정
docs(api-mapper): update toPayload() JSDoc to reflect dirty-based PUT routing

  - 구버전 설명 'changeLog.length === 0 → PUT' 제거
  - 실제 구현과 일치하도록 dirtyFields 기반 분기 시나리오 3가지로 교체
  - api-mapper.js 주석과 코드의 동기화
```
