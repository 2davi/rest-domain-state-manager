import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "rest-domain-state-manager",
  description: "REST API 연동 도메인 상태 관리 라이브러리",
  base: '/rest-domain-state-manager/', // GitHub Pages (Lab Hub) 경로 맞춤
  

  locales: {
    root: { label: '한국어', lang: 'ko' },
    en: { label: 'English', lang: 'en', link: '/en/' }
  },

  themeConfig: {
    // outline (스크롤 스파이) 활성화: h2, h3 제목을 추적해서 네 사이드바 CSS에 active 클래스를 먹여줄 거다.
    outline: { level: [2, 3], label: '목차' },

    nav: [
      { text: '가이드', link: '/guide/getting-started' },
      { text: 'API 레퍼런스', link: '/api/model.DomainState.Class.DomainState' },
      { text: 'GitHub', link: 'https://github.com/2davi/rest-domain-state-manager' }
    ],

sidebar: {
      '/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: '빠른 시작 <span class="nav-badge light">1-1</span>', link: '/guide/getting-started' },
            { text: 'ApiHandler 생성 <span class="nav-badge light">1-2</span>', link: '/guide/apihandler' },
            { text: 'GET → 변경 → 저장 <span class="nav-badge light">1-3</span>', link: '/guide/data-flow' }
          ]
        },
        {
          text: 'Deep Dive',
          collapsed: false,
          items: [
            { text: '팩토리 메서드 🏭 <span class="nav-badge heavy">2-1</span>', link: '/guide/factories' },
            { text: 'DomainVO 스키마 <span class="nav-badge heavy">2-2</span>', link: '/guide/domain-vo' },
            { text: '파이프라인 (all) <span class="nav-badge heavy">2-3</span>', link: '/guide/pipeline' },
            { text: 'UI 렌더링 (renderTo) <span class="nav-badge heavy">2-4</span>', link: '/guide/renderer' },
            { text: 'save() 분기 전략 <span class="nav-badge heavy">2-5</span>', link: '/guide/save-strategy' },
            { text: '플러그인 시스템 <span class="nav-badge heavy">2-6</span>', link: '/guide/plugins' },
            { text: '핵심 개념과 철학 💡', link: '/guide/core-concepts' }
          ]
        },
        {
          text: 'Architecture 🏗',
          collapsed: false,
          items: [
            { text: '도개교(Drawbridge) 패턴', link: '/architecture/drawbridge' },
            { text: 'V8 엔진 최적화 전략 ⭐️', link: '/architecture/v8-optimization' },
            { text: '디버그 통신 및 메모리 관리 ⭐️', link: '/architecture/memory-management' }
          ]
        },
{
          text: 'API Reference 📋',
          collapsed: false,
          items: [
            // 실제 생성된 파일명(점 포함)을 경로에 그대로 작성
            { text: 'DomainState', link: '/api/model.DomainState.Class.DomainState' },
            { text: 'ApiHandler', link: '/api/handler.api-handler.Class.ApiHandler' },
            { text: 'DomainVO', link: '/api/model.DomainVO.Class.DomainVO' },
            { text: 'DomainPipeline', link: '/api/model.DomainPipeline.Class.DomainPipeline' },
            
            // 플러그인들은 Variable 타입으로 생성
            { text: 'DomainRenderer', link: '/api/plugin.domain-renderer.DomainRenderer.Variable.DomainRenderer' },
            { text: 'FormBinder', link: '/api/plugin.form-binding.FormBinder.Variable.FormBinder' }
          ]
        }
      ]
    }
  }
})