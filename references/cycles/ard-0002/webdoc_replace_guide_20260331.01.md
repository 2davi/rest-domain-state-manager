# WebDoc 최신화 파일 교체 가이드

## 파일 목록 및 교체 위치

이 디렉터리의 파일을 아래 경로에 덮어쓰세요.
`docs/.vitepress/` 기준이 아닌 **레포지토리 루트 기준** 경로입니다.

| 이 디렉터리의 파일 | 교체할 실제 경로 | 작업 유형 |
|---|---|---|
| `overview.md` | `docs/architecture/overview.md` | 덮어쓰기 |
| `pipeline.md` | `docs/guide/pipeline.md` | 덮어쓰기 |
| `api-handler.md` | `docs/guide/api-handler.md` | 덮어쓰기 |
| `react-adapter.md` | `docs/guide/react-adapter.md` | **신규 생성** |
| `state-lifecycle.md` | `docs/architecture/state-lifecycle.md` | 덮어쓰기 |
| `save-strategy.md` | `docs/guide/save-strategy.md` | 덮어쓰기 |

---

## docs/.vitepress/config.mts 수정

`react-adapter.md` 는 신규 파일이므로 VitePress 사이드바에 수동으로 항목을 추가해야 합니다.

`config.mts` 에서 가이드 섹션 사이드바를 찾아 아래 항목을 추가하세요.
기존 `pipeline` 항목 뒤에 배치하는 것을 권장합니다.

```typescript
// docs/.vitepress/config.mts
// sidebar 배열에서 guide 섹션을 찾아 추가

{
  text: 'React 어댑터',
  link: '/guide/react-adapter'
}
```

### 예시 (기존 sidebar 구조에 맞춰 삽입)

```typescript
{
  text: '가이드',
  items: [
    { text: '설치',            link: '/guide/installation'    },
    { text: '5분 빠른 시작',   link: '/guide/quick-start'     },
    { text: 'ApiHandler',      link: '/guide/api-handler'     },
    { text: '팩토리 메서드',   link: '/guide/factories'       },
    { text: 'save() 전략',     link: '/guide/save-strategy'   },
    { text: 'DomainPipeline',  link: '/guide/pipeline'        },
    { text: 'React 어댑터',    link: '/guide/react-adapter'   }, // ← 추가
    { text: 'DomainVO',        link: '/guide/domain-vo'       },
    { text: '디버거',          link: '/guide/debugger'        },
    { text: 'FormBinder',      link: '/guide/form-binder'     },
    { text: 'DomainRenderer',  link: '/guide/domain-renderer' },
  ]
}
```

---

## 변경 요약

### overview.md
- **제거**: 구버전 `DomainState.PipelineConstructor = DomainPipeline` 패턴 설명
- **추가**: Composition Root 패턴 (`configure({ pipelineFactory })`) 설명
- **추가**: 레이어 다이어그램에 `src/common/`, `src/adapters/`, `src/workers/` 포함
- **추가**: 핵심 모듈 역할 표에 `clone.js`, `freeze.js`, `logger.js`, `react.js`, `serializer.worker.js` 추가
- **추가**: Silent 모드 설명 섹션

### pipeline.md
- **제거**: `DomainState.PipelineConstructor = DomainPipeline` 코드 예제 (소비자 직접 호출 불필요)
- **추가**: `failurePolicy` 옵션 표 및 `rollback-all` / `fail-fast` 예제
- **추가**: `dsm:pipeline-rollback` 이벤트 구독 방법
- **추가**: 실행 흐름 4단계 다이어그램

### api-handler.md
- **추가**: `init()` 메서드 전체 섹션
  - CSRF 토큰 탐색 우선순위
  - 서버 프레임워크별 연동 방법 (Spring Security / Laravel / Django / Cookie)
  - 3-상태 설계 테이블 (`undefined` / `null` / `string`)
  - 체이닝 예제

### react-adapter.md (신규)
- `useDomainState` 훅 사용법
- `subscribe()` / `getSnapshot()` 직접 사용법
- 동작 원리 (Proxy → microtask → Structural Sharing → 리렌더링)
- Vue 3 / Vanilla JS 예제
- 주의사항 (스냅샷 직접 변경 금지)

### state-lifecycle.md
- **추가**: Shadow State 섹션
  - `#shadowCache` 갱신 시점
  - Structural Sharing 원리 및 코드 예제
  - `Object.freeze` 전략 (개발/프로덕션 분기)
  - `getSnapshot()` / `subscribe()` 계약 설명
- **수정**: 활성 상태 다이어그램에 `_buildSnapshot()` / `_notifyListeners()` 흐름 추가

### save-strategy.md
- **추가**: `save()` 내 자동 롤백과 `restore()` 의 개념 차이 명확화
- **추가**: `restore()` 단독 섹션 (파이프라인 보상 트랜잭션 용도, 직접 호출 예제)
- **추가**: `dsm:rollback` 이벤트 구독 방법
- **추가**: 책임 범위 경고 (인메모리만 복원, 서버 롤백은 소비자 책임)
