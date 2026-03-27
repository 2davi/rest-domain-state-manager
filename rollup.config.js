// `"type": "module"`이므로, 이 파일도 ESM으로 평가된다. `__dirname`은 ESM에서 존재하지 않기에, `import.meta.url`로 대체한다.
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { fileURLToPath }  from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [

    // ── ESM 출력 ─────────────────────────────────────────────────────────────
    // preserveModules: true → src/ 디렉토리 구조 그대로 dist/ 에 출력
    // 소비자 번들러가 실제로 import한 파일만 가져갈 수 있어 Tree-shaking 효율 극대화
    {
        input:   resolve(__dirname, 'index.js'),

        output: {
            dir:            'dist',
            format:         'es',
            preserveModules: true,
            entryFileNames:  '[name].mjs',
            sourcemap:       true,
        },

        plugins: [nodeResolve()],

        // 현재 dependencies가 없으므로 external이 비어있다.
        // 추후 React / Vue 등 peer dependency가 생기면 여기에 추가한다.
        external: [],
    },

    // ── CJS 출력 ─────────────────────────────────────────────────────────────
    // ESM(.mjs)과 파일명 충돌을 피하기 위해 dist/cjs/ 서브디렉토리로 분리한다.
    {
        input:   resolve(__dirname, 'index.js'),

        output: {
            dir:            'dist/cjs',
            format:         'cjs',
            preserveModules: true,
            entryFileNames:  '[name].cjs',
            sourcemap:       true,
            // Rollup이 ESM import/export를 module.exports / require() 패턴으로 자동 변환한다.
        },

        plugins: [nodeResolve()],

        external: [],
    },
];