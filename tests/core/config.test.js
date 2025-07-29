const config = require('../../src/config/config');

describe('Configuration Management', () => {
    test('should load default configuration', () => {
        expect(config.get('app.name')).toBeDefined();
        expect(config.get('app.version')).toBeDefined();
    });

    test('should validate configuration', () => {
        expect(config.validate()).toBe(true);
    });

    test('should handle nested config keys', () => {
        const appName = config.get('app.name');
        expect(typeof appName).toBe('string');
    });

    test('should return default value for missing keys', () => {
        const defaultValue = 'default';
        const result = config.get('nonexistent.key', defaultValue);
        expect(result).toBe(defaultValue);
    });

    test('should handle module enablement configuration', () => {
        const modules = config.get('modules.enabled');
        expect(typeof modules).toBe('object');
        expect(modules).toHaveProperty('browsers');
        expect(modules).toHaveProperty('discord');
    });
});
