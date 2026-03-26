// eslint.config.js
import js           from '@eslint/js';
import jsdoc        from 'eslint-plugin-jsdoc';
import importPlugin from 'eslint-plugin-import';
import globals      from 'globals';

export default [

    // ── 1. 전역 무시 패턴 ──────────────────────────────────────────────────
    // dist/, docs/.vitepress/cache/ 등 빌드 산출물과 자동 생성 파일은 검사하지 않는다.
    {
        ignores: [
            'dist/**',
            'docs/.vitepress/cache/**',
            'docs/.vitepress/dist/**',
            'node_modules/**',
            'coverage/**',
        ],
    },

    // ── 2. src/ 소스 파일 — 핵심 규칙 ────────────────────────────────────
    {
        files: ['src/**/*.js', 'index.js'],

        plugins: { 
            jsdoc,
            import: importPlugin // KEY 이름이 'import'여야 규칙 prefix에 맞음
        },

        languageOptions: {
            ecmaVersion:  2022,
            sourceType:   'module',
            // browser 전역 + 일부 Node 전역(console, process)을 허용
            // src/ 코드는 브라우저에서 동작하는 게 주 목적
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },

        rules: {
            // ESLint 공식 권장 규칙 전체 상속
            ...js.configs.recommended.rules,

            // ── 코드 품질 ──────────────────────────────────────────────────

            // 선언했지만 쓰지 않는 변수 금지
            // _로 시작하는 인자(콜백 무시용)는 예외로 허용
            'no-unused-vars': ['error', {
                vars:               'all',
                args:               'after-used',
                argsIgnorePattern:  '^_',
                caughtErrors:       'all',
            }],

            // console.log 금지 (개발 중 남긴 디버그 로그 방지)
            // console.debug / console.warn / console.error는 허용
            // 이유: src/debug/는 의도적으로 console.debug를 쓰고,
            //       error.messages.js의 console.warn도 의도된 동작
            'no-console': ['warn', {
                allow: ['debug', 'warn', 'error', 'group', 'groupEnd', 'table'],
            }],

            // var 금지 — const/let만 허용
            'no-var': 'error',

            // const로 선언 가능한데 let 쓰면 경고
            'prefer-const': ['warn', { destructuring: 'all' }],

            // 동일값 비교 시 === 강제 (== 금지)
            'eqeqeq': ['error', 'always', { null: 'ignore' }],

            // ── JSDoc 규칙 ─────────────────────────────────────────────────

            // JSDoc 파라미터 이름이 실제 함수 파라미터와 일치해야 함
            'jsdoc/check-param-names':    'warn',

            // JSDoc 태그 이름 유효성 검사 (@param, @returns 등 공식 태그만 허용)
            'jsdoc/check-tag-names':      ['warn', { definedTags: ['module'] }],

            // @returns 설명이 있으면 타입도 있어야 함
            'jsdoc/check-types':          'warn',

            // @param 타입이 있는데 설명이 없으면 경고
            'jsdoc/require-param-description': 'warn',

            // ── 순환 참조 감지 ──────────────────────────────────────────────
            
            // maxDepth: Infinity  → A→B→C→A 같은 간접 순환도 전부 추적
            // ignoreExternal: true → node_modules 내부까지는 추적 안 함 (성능)
            'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
        },
    },

    // ── 3. test/ 파일 — 규칙 완화 ─────────────────────────────────────────
    {
        files: ['test/**/*.js'],

        languageOptions: {
            ecmaVersion: 2022,
            sourceType:  'module',
            globals: {
                // 테스트 파일은 Node.js + jsdom 혼합 환경
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },

        rules: {
            ...js.configs.recommended.rules,

            // 테스트 파일은 console.log 허용 (디버깅 편의)
            'no-console': 'off',

            // 테스트 픽스처에서 임시 변수 선언이 많으므로 완화
            'no-unused-vars': ['warn', {
                vars:              'all',
                args:              'after-used',
                argsIgnorePattern: '^_',
            }],

            'no-var':       'error',
            'prefer-const': 'warn',
            'eqeqeq':       ['error', 'always', { null: 'ignore' }],
        },
    },

];