/**
 * @fileoverview Web Service Module
 * @description Web service integration for ShadowRecon
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

const { WebServer } = require('../../modules/web/server');
const { logger } = require('../../core/logger');

/**
 * Web Service class to integrate with service manager
 * @class WebService
 */
class WebService {
    /**
     * Creates an instance of WebService
     * @constructor
     */
    constructor() {
        /** @type {WebServer|null} */
        this.server = null;
        /** @type {boolean} */
        this.isInitialized = false;
    }

    /**
     * Initialize the web service
     * @async
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('Initializing web service');
            
            this.server = new WebServer();
            await this.server.initialize();
            
            this.isInitialized = true;
            logger.info('Web service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize web service', error.message);
            throw error;
        }
    }

    /**
     * Start the web service
     * @async
     * @returns {Promise<void>}
     */
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            await this.server.start();
            logger.info(`Web interface available at: ${this.server.getUrl()}`);
        } catch (error) {
            logger.error('Failed to start web service', error.message);
            throw error;
        }
    }

    /**
     * Stop the web service
     * @async
     * @returns {Promise<void>}
     */
    async stop() {
        try {
            if (this.server) {
                await this.server.stop();
                logger.info('Web service stopped');
            }
        } catch (error) {
            logger.error('Failed to stop web service', error.message);
            throw error;
        }
    }

    /**
     * Get the server URL
     * @returns {string|null}
     */
    getUrl() {
        return this.server ? this.server.getUrl() : null;
    }

    /**
     * Check if the service is running
     * @returns {boolean}
     */
    isRunning() {
        return this.isInitialized && this.server !== null;
    }

    /**
     * Get service status
     * @returns {Object}
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            running: this.isRunning(),
            url: this.getUrl()
        };
    }
}

module.exports = { WebService };