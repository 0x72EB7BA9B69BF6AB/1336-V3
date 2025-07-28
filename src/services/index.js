/**
 * Services Exports
 * Centralized exports for all external services
 */

const { DiscordService } = require('./discord/service');
const { DiscordBrowserService } = require('./discord/browserService');
const { uploadService } = require('./upload/service');

module.exports = {
    // Discord Services
    DiscordService,
    DiscordBrowserService,
    
    // Upload Service
    uploadService
};