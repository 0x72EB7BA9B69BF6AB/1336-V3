/**
 * Discord Service Exports
 * Centralized exports for Discord-related services
 */

const { DiscordService } = require('./service');
const { DiscordBrowserService } = require('./browserService');

module.exports = {
    DiscordService,
    DiscordBrowserService
};