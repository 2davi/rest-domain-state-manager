import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        environmentMatchGlobs: [
            ['tests/plugins/**', 'jsdom'],
            ['test/plugins/**',        'jsdom'],       // 단수 디렉토리 대응
            ['test/**/*-dom.test.js',  'jsdom'],
            ['test/workers/**',        'happy-dom'],   // Worker API 지원
            ['tests/workers/**',       'happy-dom'],   // 복수 디렉토리 대응
        ],
    },
});