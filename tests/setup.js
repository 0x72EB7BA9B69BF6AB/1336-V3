// Jest setup file
// Add any global test setup here

// Mock external dependencies that may not be available in test environment
jest.mock('screenshot-desktop', () => ({
    getScreenshots: jest.fn().mockResolvedValue([])
}));

// Mock system-specific modules
jest.mock('@primno/dpapi', () => ({
    unprotectData: jest.fn().mockResolvedValue(Buffer.from('test'))
}));

// Global test utilities
global.testUtils = {
    createMockConfig: () => ({
        app: { name: 'test', version: '1.0.0' },
        webhook: { url: 'http://test.com', timeout: 5000 },
        paths: { temp: '/tmp', output: './test-output' },
        modules: { enabled: { browsers: true, discord: true } }
    })
};