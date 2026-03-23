# 설치

<span class="badge badge-stable">Stable</span>

`rest-domain-state-manager` 는 번들러에 대한 의존성 없이 세 가지 방식으로 설치할 수 있습니다. 대부분의 현대 프로젝트는 npm 방식을 권장합니다.

## npm (권장)

Node.js 20 이상 환경에서 아래 명령어로 설치합니다.

```bash
npm install @2davi/rest-domain-state-manager
```

```javascript
// ES Module (Vite, Next.js, Nuxt 등)
import { ApiHandler, DomainState, DomainVO } from '@2davi/rest-domain-state-manager'

// 플러그인이 필요하다면
import { FormBinder, DomainRenderer }        from '@2davi/rest-domain-state-manager'
DomainState.use(FormBinder)
DomainState.use(DomainRenderer)
```

## CDN (번들러 없는 환경)

번들러 없이 HTML에서 직접 사용하는 경우 jsDelivr 또는 unpkg를 통해 ES Module로 로드합니다.

```html
<script type="module">
    import {
        ApiHandler,
        DomainState,
    } from 'https://cdn.jsdelivr.net/npm/@2davi/rest-domain-state-manager/dist/index.js'

    const api  = new ApiHandler({ host: 'localhost:8080' })
    const user = await api.get('/api/users/1')
    console.log(user.data.name)
</script>
```

## 직접 다운로드 (레거시 환경)

번들러도 CDN도 사용할 수 없는 완전한 오프라인 레거시 환경(예: 내부망 JSP 프로젝트)을 위한 방법입니다.

1. [GitHub Releases](https://github.com/2davi/rest-domain-state-manager/releases) 에서 최신 버전의 `dist.zip` 을 다운로드합니다.
2. 압축 해제 후 `dist/` 폴더를 프로젝트 내 원하는 위치에 복사합니다.
3. 아래와 같이 상대 경로로 import 합니다.

```html
<script type="module">
    import { ApiHandler, DomainState }
        from '/assets/lib/rest-domain-state-manager/index.js'
</script>
```

::: tip 브라우저 지원
`type="module"` 스크립트와 ES2022 문법을 지원하는 모던 브라우저가 필요합니다. Chrome 94+, Firefox 93+, Safari 15.4+, Edge 94+ 에서 동작이 확인되었습니다. IE는 지원하지 않습니다.
:::

## TypeScript 지원

별도의 `@types` 패키지 없이 `.d.ts` 선언 파일이 패키지에 포함되어 있습니다. TypeScript 5.x 환경에서 자동 완성과 타입 검사가 즉시 동작합니다.

```json
// tsconfig.json — moduleResolution이 bundler 또는 node16 이상이어야 합니다
{
    "compilerOptions": {
        "module":           "ESNext",
        "moduleResolution": "bundler"
    }
}
```

## 다음 단계

설치가 완료되었다면 [5분 빠른 시작](/guide/quick-start) 으로 이동하여 핵심 흐름을 확인하세요.
