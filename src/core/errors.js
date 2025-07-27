/**
 * Error Handling System
 * Provides centralized error handling and custom error types
 */

const { logger } = require('./logger');

/**
 * Base application error class
 */
class AppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Configuration error
 */
class ConfigError extends AppError {
    constructor(message, code = 'CONFIG_ERROR') {
        super(message, code, 400);
    }
}

/**
 * File system error
 */
class FileSystemError extends AppError {
    constructor(message, code = 'FILESYSTEM_ERROR') {
        super(message, code, 500);
    }
}

/**
 * Network error
 */
class NetworkError extends AppError {
    constructor(message, code = 'NETWORK_ERROR') {
        super(message, code, 500);
    }
}

/**
 * Module error
 */
class ModuleError extends AppError {
    constructor(message, module, code = 'MODULE_ERROR') {
        super(`[${module}] ${message}`, code, 500);
        this.module = module;
    }
}

/**
 * Security error
 */
class SecurityError extends AppError {
    constructor(message, code = 'SECURITY_ERROR') {
        super(message, code, 403);
    }
}

/**
 * Error handler class
 */
class ErrorHandler {
    /**
     * Handle error with logging and optional callback
     * @param {Error} error - Error to handle
     * @param {Function} callback - Optional callback function
     * @param {Object} context - Additional context information
     */
    static handle(error, callback = null, context = {}) {
        const errorInfo = {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            stack: error.stack,
            timestamp: new Date().toISOString(),
            context
        };

        if (error instanceof AppError) {
            logger.error(`Application Error [${error.code}]: ${error.message}`, errorInfo);
        } else {
            logger.error(`Unhandled Error: ${error.message}`, errorInfo);
        }

        if (callback && typeof callback === 'function') {
            try {
                callback(error, errorInfo);
            } catch (callbackError) {
                logger.error('Error in error callback:', callbackError.message);
            }
        }
    }

    /**
     * Wrap async function with error handling
     * @param {Function} fn - Async function to wrap
     * @param {Object} options - Options for error handling
     * @returns {Function} Wrapped function
     */
    static wrapAsync(fn, options = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handle(error, options.callback, options.context);
                
                if (options.rethrow !== false) {
                    throw error;
                }
                
                return options.defaultValue || null;
            }
        };
    }

    /**
     * Wrap sync function with error handling
     * @param {Function} fn - Function to wrap
     * @param {Object} options - Options for error handling
     * @returns {Function} Wrapped function
     */
    static wrapSync(fn, options = {}) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handle(error, options.callback, options.context);
                
                if (options.rethrow !== false) {
                    throw error;
                }
                
                return options.defaultValue || null;
            }
        };
    }

    /**
     * Create a safe version of a function that never throws
     * @param {Function} fn - Function to make safe
     * @param {*} defaultValue - Default value to return on error
     * @returns {Function} Safe function
     */
    static safe(fn, defaultValue = null) {
        return (...args) => {
            try {
                const result = fn(...args);
                if (result instanceof Promise) {
                    return result.catch(() => defaultValue);
                }
                return result;
            } catch (error) {
                return defaultValue;
            }
        };
    }

    /**
     * Set up global error handlers
     */
    static setupGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            // In production, you might want to exit gracefully
            // process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }
}

module.exports = {
    AppError,
    ConfigError,
    FileSystemError,
    NetworkError,
    ModuleError,
    SecurityError,
    ErrorHandler
};