/**
 * Core Module Exports
 * Centralized exports for all core utilities and services
 */

const { logger, Logger } = require('./logger');
const { 
    ErrorHandler, 
    AppError, 
    ConfigError, 
    FileSystemError, 
    NetworkError, 
    ModuleError, 
    SecurityError 
} = require('./errors');
const { fileManager } = require('./fileManager');
const { stats } = require('./statistics');
const { TokenUtils } = require('./tokenUtils');
const { ConfigValidator } = require('./configValidator');
const CoreUtils = require('./utils');
const constants = require('./constants');

module.exports = {
    // Logging
    logger,
    Logger,
    
    // Error Handling
    ErrorHandler,
    AppError,
    ConfigError,
    FileSystemError,
    NetworkError,
    ModuleError,
    SecurityError,
    
    // File Management
    fileManager,
    
    // Statistics
    stats,
    
    // Utilities
    TokenUtils,
    CoreUtils,
    ConfigValidator,
    
    // Constants
    constants
};