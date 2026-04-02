import { defineConfig } from 'vitepress'
import { resolve }      from 'path'
import { fileURLToPath } from 'url'

export default defineConfig({
    title:       'DSM',
    description: 'REST 도메인 상태 관리 라이브러리 — Proxy 기반 자동 HTTP 분기 엔진',
    base:        '/rest-domain-state-manager/',

    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/rest-domain-state-manager/favicon.svg' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
        ['link', {
            rel:  'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        }],
    ],

    // ── Vite 설정 — Playground에서 /index.js 로 라이브러리 resolve ──────────
    vite: {
        plugins: [
            {
                name: 'escape-typedoc-angle-brackets',
                transform(code, id) {
                if (!id.includes('docs/api') || !id.endsWith('.md')) return;
                // 코드 블록 밖의 bare < > 를 HTML 엔티티로 치환
                return code
                    .split('```')
                    .map((segment, i) =>
                    i % 2 === 0
                        ? segment.replace(/<(?!\/?[a-zA-Z])/g, '&lt;')
                        : segment
                    )
                    .join('```');
                },
            },
        ],
        resolve: {
            alias: {
                // Playground 컴포넌트 내부의 import('/index.js') 가
                // 레포지토리 루트의 index.js 를 가리키도록 설정
                //'/index.js': resolve(process.cwd(), 'index.js'),
                '@2davi/rest-domain-state-manager': fileURLToPath(
                    new URL('../../index.js', import.meta.url)
                ),
            },
        },
        // ── publicDir 수정 ──────────────────────────────────────────
        // .vitepress 폴더 자체를 정적 자산 폴더로 사용 (네 고집대로)
        // __dirname 대신 ESM 표준인 import.meta.url 을 사용해라.
        // ────────────────────────────────────────────────────────────
        publicDir: fileURLToPath(new URL('.', import.meta.url)),
    },

    locales: {
        root: { label: '한국어', lang: 'ko' },
        en:   { label: 'English', lang: 'en', link: '/en/' },
    },

    themeConfig: {
        logo: { light: '/favicon.svg', dark: '/favicon.svg', alt: 'DSM' },

        outline: { level: [2, 3], label: '목차' },

        search: { provider: 'local' },

        nav: [
            { text: '가이드',       link: '/guide/installation' },
            { text: '아키텍처',     link: '/architecture/overview' },
            { text: '철학',         link: '/philosophy' },
            { text: 'API 레퍼런스', link: '/api/domain.DomainState.Class.DomainState' },
            { text: 'GitHub',       link: 'https://github.com/2davi/rest-domain-state-manager' },
        ],

        sidebar: {
            '/': [
                {
                    text: 'Getting Started', collapsed: false,
                    items: [
                        { text: '설치 <span class="nav-badge light">1-1</span>',                         link: '/guide/installation' },
                        { text: '5분 빠른 시작 <span class="nav-badge light">1-2</span>',                link: '/guide/quick-start' },
                        { text: 'ApiHandler <span class="nav-badge light">1-3</span>',                   link: '/guide/api-handler' },
                        { text: 'JSP / 레거시 환경 <span class="nav-badge light">1-4</span>',            link: '/guide/si-quickstart' },
                        { text: 'React / Vue <span class="nav-badge light">1-5</span>',                  link: '/guide/modern-quickstart' },
                    ],
                },
                {
                    text: 'Core Concepts', collapsed: false,
                    items: [
                        { text: '팩토리 메서드 <span class="nav-badge heavy">2-1</span>',                link: '/guide/factories' },
                        { text: 'save() 분기 전략 <span class="nav-badge heavy">2-2</span>',             link: '/guide/save-strategy' },
                        { text: 'DomainVO 스키마 <span class="nav-badge heavy">2-3</span>',              link: '/guide/domain-vo' },
                        { text: 'DomainPipeline <span class="nav-badge heavy">2-4</span>',               link: '/guide/pipeline' },
                        { text: 'React 어댑터 <span class="nav-badge heavy">2-5</span>',                 link: '/guide/react-adapter' },
                        { text: '디버거 <span class="nav-badge light">2-6</span>',                       link: '/guide/debugger' },
                        { text: 'FormBinder 플러그인 <span class="nav-badge">2-7</span>',                link: '/guide/form-binder' },
                        { text: 'DomainRenderer 플러그인 <span class="nav-badge">2-8</span>',            link: '/guide/domain-renderer' },
                        { text: 'DomainCollection <span class="nav-badge heavy">2-9</span>',             link: '/guide/domain-collection' },
                        { text: 'UIComposer & UILayout <span class="nav-badge heavy">2-10</span>',       link: '/guide/ui-composer' },
                        { text: '추적 모드 (realtime / lazy) <span class="nav-badge heavy">2-11</span>', link: '/guide/tracking-modes' },
                        { text: 'Idempotency-Key <span class="nav-badge light">2-12</span>',             link: '/guide/idempotency' },
                    ],
                },
                {
                    text: 'Architecture 🏗', collapsed: true,
                    items: [
                        { text: '시스템 개요',           link: '/architecture/overview' },
                        { text: 'Proxy 엔진 심층 분석',  link: '/architecture/proxy-engine' },
                        { text: '상태 생명주기',         link: '/architecture/state-lifecycle' },
                        { text: 'HTTP 자동 라우팅',      link: '/architecture/http-routing' },
                        { text: '디버그 채널 프로토콜',  link: '/architecture/broadcast-channel' },
                        { text: 'V8 최적화 전략',        link: '/architecture/v8-optimization' },
                    ],
                },
                {
                    text: '철학과 가치관 💡', collapsed: true,
                    items: [
                        { text: 'Philosophy', link: '/philosophy' },
                    ],
                },
                {
                    text: 'Decision Log 📋', collapsed: true,
                    items: [
                        { text: '전체 결정 타임라인',               link: '/decision-log/index' },
                        { text: 'ARD-0000 — 아키텍처 진단',         link: '/decision-log/ard-0000' },
                        { text: 'ARD-0001 — V8 최적화 정렬',        link: '/decision-log/ard-0001' },
                        { text: 'IMPL-001 — Dirty Checking',        link: '/decision-log/impl-dirty-fields' },
                        { text: 'IMPL-002 — Optimistic Rollback',   link: '/decision-log/impl-optimistic-rollback' },
                        { text: 'IMPL-003 — Microtask Batching',    link: '/decision-log/impl-microtask-batching' },
                        { text: 'IMPL-004 — Src Layout',            link: '/decision-log/impl-src-layout' },
                        { text: 'IMPL-005 — CI/CD Pipeline',        link: '/decision-log/impl-cicd-pipeline' },
                    ],
                },
                {
                    text: 'Migration 🔄', collapsed: true,
                    items: [
                        { text: 'v2.0.0으로 이전하기',  link: '/guide/migration-v2' },
                    ],
                },
                {
                    text: 'Playground ▶', collapsed: true,
                    items: [
                        { text: 'Playground 모음',      link: '/playground/index' },   // ← 추가
                        { text: 'Playground 구현 원리', link: '/playground/how-it-works' },
                    ],
                },
                {
                    text: 'API Reference 📚', collapsed: true,
                    items: [
                        { text: 'DomainState',          link: '/api/domain.DomainState.Class.DomainState' },
                        { text: 'ApiHandler',           link: '/api/network.api-handler.Class.ApiHandler' },
                        { text: 'DomainVO',             link: '/api/domain.DomainVO.Class.DomainVO' },
                        { text: 'DomainPipeline',       link: '/api/domain.DomainPipeline.Class.DomainPipeline' },
                        { text: 'DomainRenderer',       link: '/api/plugins.domain-renderer.DomainRenderer.Variable.DomainRenderer' },
                        { text: 'DomainCollection',     link: '/api/domain.DomainCollection.Class.DomainCollection' },
                        { text: 'UIComposer',           link: '/api/ui.UIComposer.Variable.UIComposer' },
                        { text: 'UILayout',             link: '/api/ui.UILayout.Class.UILayout' },
                        { text: 'FormBinder',           link: '/api/plugins.form-binder.FormBinder.Variable.FormBinder' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/2davi/rest-domain-state-manager' },
        ],

        footer: {
            message:   'Released under the ISC License.',
            copyright: 'Copyright © 2026 2davi',
        },

        editLink: {
            pattern: 'https://github.com/2davi/rest-domain-state-manager/edit/main/docs/:path',
            text:    'GitHub에서 이 페이지 편집',
        },
    },
})
