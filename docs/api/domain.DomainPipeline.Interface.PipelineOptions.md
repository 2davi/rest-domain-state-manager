# Interface: PipelineOptions

## Properties

### failurePolicy?

```ts
optional failurePolicy?: "ignore" | "rollback-all" | "fail-fast";
```

파이프라인 실패 시 보상 트랜잭션 정책.

  | 값              | 동작                                                                    |
  |-----------------|-------------------------------------------------------------------------|
  | `'ignore'`      | 기존 동작 유지. 실패를 `_errors`에 기록하고 계속 진행. 보상 없음.      |
  | `'rollback-all'`| 모든 핸들러 완료 후 에러가 하나라도 있으면 전체 resolved에 restore(). |
  | `'fail-fast'`   | 첫 번째 핸들러 실패 시 즉시 중단. 이전 성공 상태들에 LIFO restore().  |

  `'ignore'`가 기본값이므로 `failurePolicy`를 지정하지 않으면 기존 동작과 완전히 동일하다.

***

### strict?

```ts
optional strict?: boolean;
```

`true`이면 fetch 또는 `after()` 핸들러 실패 시 즉시 reject.
  `false`(기본값)이면 `_errors`에 기록하고 계속 진행.
