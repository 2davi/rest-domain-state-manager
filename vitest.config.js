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
                'src/debug/debug-channel.js',    // BroadcastChannel — 브라우저 전용
                'src/workers/diff.worker.js',    // Web Worker 파일 — 직접 실행 불가
                'src/adapters/react.js',         // React peerDep — 테스트 환경 미설치
                'commitlint.config.js',          // 도구 설정 파일
                'index.js',                      // Composition Root — 통합 테스트 영역
            ],
        },
    },
});