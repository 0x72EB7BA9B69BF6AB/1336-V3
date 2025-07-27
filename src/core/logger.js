/**
 * Logging System
 * Provides centralized logging with different levels and optional file output
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        this.currentLevel = options.level || this.levels.INFO;
        this.enableConsole = options.console !== false;
        this.enableFile = options.file || false;
        this.logFile = options.logFile || null;
        this.enableTimestamp = options.timestamp !== false;
    }

    /**
     * Log message with specified level
     * @param {number} level - Log level
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    log(level, message, ...args) {
        if (level > this.currentLevel) {
            return;
        }

        const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
        const levelName = levelNames[level] || 'UNKNOWN';
        
        let logMessage = `[${levelName}] ${message}`;
        
        if (this.enableTimestamp) {
            const timestamp = new Date().toISOString();
            logMessage = `${timestamp} ${logMessage}`;
        }

        if (args.length > 0) {
            logMessage += ' ' + args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
        }

        if (this.enableConsole) {
            const consoleMethod = level === this.levels.ERROR ? 'error' :
                                level === this.levels.WARN ? 'warn' : 'log';
            console[consoleMethod](logMessage);
        }

        if (this.enableFile && this.logFile) {
            this.writeToFile(logMessage);
        }
    }

    /**
     * Write message to log file
     * @param {string} message - Message to write
     */
    writeToFile(message) {
        try {
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.appendFileSync(this.logFile, message + '\n');
        } catch (error) {
            // Fail silently to avoid logging loops
        }
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        this.log(this.levels.ERROR, message, ...args);
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        this.log(this.levels.WARN, message, ...args);
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        this.log(this.levels.INFO, message, ...args);
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        this.log(this.levels.DEBUG, message, ...args);
    }

    /**
     * Set log level
     * @param {string|number} level - Log level name or number
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
        } else {
            this.currentLevel = level;
        }
    }
}

// Create default logger instance
const defaultLogger = new Logger({
    level: process.env.LOG_LEVEL === 'DEBUG' ? 3 : 2,
    console: true,
    file: false
});

module.exports = {
    Logger,
    logger: defaultLogger
};