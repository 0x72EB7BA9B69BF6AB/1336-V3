module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        // Code quality
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-console': 'off', // Allow console for logging
        'prefer-const': 'error',
        'no-var': 'error',
        
        // Style consistency
        'indent': ['error', 4],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        
        // Best practices
        'eqeqeq': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-throw-literal': 'error',
        'prefer-promise-reject-errors': 'error',
        
        // Async/await patterns
        'no-async-promise-executor': 'error',
        'no-await-in-loop': 'warn',
        'prefer-async-await': 'off',
        
        // Security
        'no-buffer-constructor': 'error'
    },
    ignorePatterns: [
        'node_modules/',
        'dist/',
        'build/',
        'temp/',
        '*.min.js'
    ]
};