/**
 * SQLite3 Wrapper with pkg compatibility
 * Handles loading of SQLite3 in both normal and packaged environments
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class SQLite3Wrapper {
    constructor() {
        this.sqlite3 = null;
        this.isLoaded = false;
        this.loadAttempted = false;
    }

    /**
     * Load SQLite3 module with fallback mechanisms
     * @returns {Object|null} SQLite3 module or null if failed
     */
    load() {
        if (this.loadAttempted) {
            return this.sqlite3;
        }

        this.loadAttempted = true;

        try {
            // Try normal loading first
            this.sqlite3 = require('sqlite3').verbose();
            this.isLoaded = true;
            logger.debug('SQLite3 loaded successfully (normal)');
            return this.sqlite3;
        } catch (error) {
            logger.debug('Normal SQLite3 loading failed:', error.message);
        }

        // If normal loading fails, try pkg-specific solutions
        if (this.isPkgEnvironment()) {
            logger.debug('PKG environment detected, attempting pkg-specific SQLite3 loading');
            
            try {
                // Method 1: Try to find the native module in pkg assets
                const nativeModulePath = this.findNativeModule();
                if (nativeModulePath) {
                    logger.debug(`Found native module at: ${nativeModulePath}`);
                    
                    // Create a mock bindings function that returns the correct path
                    const originalBindings = require.resolve('bindings');
                    delete require.cache[originalBindings];
                    
                    // Mock the bindings module to return our found path
                    require.cache[originalBindings] = {
                        exports: () => require(nativeModulePath)
                    };
                    
                    this.sqlite3 = require('sqlite3').verbose();
                    this.isLoaded = true;
                    logger.debug('SQLite3 loaded successfully (pkg method 1)');
                    return this.sqlite3;
                }
            } catch (error) {
                logger.debug('PKG method 1 failed:', error.message);
            }

            try {
                // Method 2: Try better-sqlite3 as fallback (if available)
                const betterSqlite3 = require('better-sqlite3');
                logger.debug('Using better-sqlite3 as fallback');
                
                // Create a compatibility wrapper for better-sqlite3
                this.sqlite3 = this.createBetterSqlite3Wrapper(betterSqlite3);
                this.isLoaded = true;
                return this.sqlite3;
            } catch (error) {
                logger.debug('better-sqlite3 fallback failed:', error.message);
            }
        }

        // If all methods fail, return null
        logger.warn('All SQLite3 loading methods failed. Browser data collection will be limited.');
        return null;
    }

    /**
     * Check if running in pkg environment
     * @returns {boolean} True if in pkg environment
     */
    isPkgEnvironment() {
        return typeof process.pkg !== 'undefined';
    }

    /**
     * Find the native SQLite3 module in pkg environment
     * @returns {string|null} Path to native module or null
     */
    findNativeModule() {
        if (!this.isPkgEnvironment()) {
            return null;
        }

        const executableDir = path.dirname(process.execPath);
        
        const possiblePaths = [
            // Locations relative to the executable (where we copy them during build)
            path.join(executableDir, 'node_sqlite3.node'),
            path.join(executableDir, 'assets', 'node_sqlite3.node'),
            path.join(executableDir, 'bindings', 'node_sqlite3.node'),
            
            // Standard pkg locations
            path.join(process.execPath, '..', 'node_sqlite3.node'),
            
            // Asset locations
            path.join(process.cwd(), 'node_sqlite3.node'),
            path.join(process.cwd(), 'assets', 'node_sqlite3.node'),
            
            // Snapshot locations (within the executable)
            '/snapshot/node_modules/sqlite3/build/Release/node_sqlite3.node',
            '/snapshot/node_modules/sqlite3/lib/binding/node-v' + process.versions.modules + '-' + process.platform + '-' + process.arch + '/node_sqlite3.node',
            
            // Additional locations where pkg might extract assets
            path.join(process.cwd(), 'sqlite3-bindings', 'node_sqlite3.node'),
            path.join(process.cwd(), 'sqlite3-bindings', 'Release', 'node_sqlite3.node')
        ];

        for (const testPath of possiblePaths) {
            try {
                if (fs.existsSync(testPath)) {
                    logger.debug(`Found native module at: ${testPath}`);
                    return testPath;
                }
            } catch (error) {
                // Ignore errors, continue searching
            }
        }

        logger.debug(`Searched for SQLite3 native module in ${possiblePaths.length} locations, none found`);
        return null;
    }

    /**
     * Create a wrapper for better-sqlite3 to make it compatible with sqlite3 API
     * @param {Object} betterSqlite3 - better-sqlite3 module
     * @returns {Object} Compatible wrapper
     */
    createBetterSqlite3Wrapper(betterSqlite3) {
        return {
            Database: class CompatibleDatabase {
                constructor(path, mode, callback) {
                    try {
                        this.db = new betterSqlite3(path, { readonly: true });
                        if (callback) callback(null);
                    } catch (error) {
                        if (callback) callback(error);
                        throw error;
                    }
                }

                each(sql, callback, complete) {
                    try {
                        const stmt = this.db.prepare(sql);
                        const rows = stmt.all();
                        
                        rows.forEach(row => {
                            callback(null, row);
                        });
                        
                        if (complete) complete(null, rows.length);
                    } catch (error) {
                        if (complete) complete(error, 0);
                    }
                }

                close(callback) {
                    try {
                        this.db.close();
                        if (callback) callback(null);
                    } catch (error) {
                        if (callback) callback(error);
                    }
                }
            },
            OPEN_READONLY: 'readonly'
        };
    }

    /**
     * Get the loaded SQLite3 instance
     * @returns {Object|null} SQLite3 instance or null
     */
    getInstance() {
        if (!this.loadAttempted) {
            return this.load();
        }
        return this.sqlite3;
    }

    /**
     * Check if SQLite3 is available
     * @returns {boolean} True if SQLite3 is loaded and available
     */
    isAvailable() {
        return this.isLoaded && this.sqlite3 !== null;
    }
}

// Create singleton instance
const sqlite3Wrapper = new SQLite3Wrapper();

module.exports = {
    sqlite3Wrapper,
    getSQLite3: () => sqlite3Wrapper.getInstance()
};