import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        environmentMatchGlobs: [
            ['tests/plugins/**',       'jsdom'],
            ['test/plugins/**',        'jsdom'],       // 단수 디렉토리 대응
            ['test/ui/**',             'jsdom'],
            ['test/**/*-dom.test.js',  'jsdom'],
            ['test/workers/**',        'happy-dom'],   // Worker API 지원
            ['tests/workers/**',       'happy-dom'],   // 복수 디렉토리 대응
        ],
        coverage: {
            exclude: [
                // 도구 설정 파일
                'eslint.config.js',
                'rollup.config.js',
                'vite.config.js',
                'vitest.config.js',
                'commitlint.config.js',
                'dist/**',                            // 빌드 산출물 - 소스가 아님
                'docs/**',                            // 문서 사이트 - 테스트 대상 아님
                'index.js',                           // 라이브러리 진입점 — 통합테스트 영역, 단위테스트 불가
                'src/debug/debug-channel.js',         // 브라우저 전용 - Node 환경에서 실행 불가
                'src/adapters/react.js',              // 브라우저 전용 — Node 환경에서 실행 불가
                'src/workers/diff.worker.js',         // Web Worker 파일 — Worker 컨텍스트에서만 실행
                'src/workers/diff-worker-client.js',  // Web Worker 파일 - Worker 컨텍스트에서만 실행
                'src/constants/error.messages.js',    // 상수 객체 - Function Coverage 무의미
                'test/**',
                'tests/**'
            ],
        },
    },
});