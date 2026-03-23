// commitlint.config.js
export default {
    extends: ['@commitlint/config-conventional'],

    rules: {
        // type 허용 목록 — config-conventional 기본값에 perf 명시 추가
        'type-enum': [
            2,
            'always',
            ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'revert'],
        ],

        // 제목 최대 100자 (JSDoc이 긴 이 프로젝트 특성상 80은 빡빡함)
        'header-max-length': [2, 'always', 100],

        // 제목 끝 마침표 금지
        'subject-full-stop': [2, 'never', '.'],

        // 본문과 제목 사이 빈 줄 강제
        'body-leading-blank': [1, 'always'],
    },
};