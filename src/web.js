/**
 * @fileoverview Web Application Launcher
 * @description Launches the web interface for language selection
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

const { logger } = require('./core/logger');
const { WebServer } = require('./services/web/server');
const { Application } = require('./main');

/**
 * Web Application Launcher Class
 * Manages the web interface and application lifecycle
 * @class WebLauncher
 */
class WebLauncher {
    /**
     * Creates an instance of WebLauncher
     * @constructor
     */
    constructor() {
        /** @type {WebServer} */
        this.webServer = new WebServer();
        /** @type {Application|null} */
        this.application = null;
        /** @type {boolean} */
        this.isRunning = false;
    }

    /**
     * Start the web launcher
     * @async
     * @returns {Promise<void>}
     */
    async start() {
        try {
            logger.info('Starting ShadowRecon Web Interface');
            
            // Start web server
            await this.webServer.initialize();
            this.isRunning = true;

            // Open browser automatically (optional)
            this.openBrowser();

            logger.info('Web interface is ready');
            logger.info(`Visit http://localhost:${this.webServer.port} to access the application`);

            // Keep the process alive
            this.keepAlive();
        } catch (error) {
            logger.error('Failed to start web launcher', error.message);
            throw error;
        }
    }

    /**
     * Open browser automatically
     */
    openBrowser() {
        try {
            const url = `http://localhost:${this.webServer.port}`;
            const { exec } = require('child_process');
            
            // Cross-platform browser opening
            let command;
            switch (process.platform) {
            case 'win32':
                command = `start ${url}`;
                break;
            case 'darwin':
                command = `open ${url}`;
                break;
            default:
                command = `xdg-open ${url}`;
            }

            exec(command, (error) => {
                if (error) {
                    logger.debug('Could not open browser automatically', error.message);
                } else {
                    logger.info('Browser opened automatically');
                }
            });
        } catch (error) {
            logger.debug('Browser auto-open failed', error.message);
        }
    }

    /**
     * Keep the process alive
     */
    keepAlive() {
        const checkInterval = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(checkInterval);
                return;
            }

            // Check if a language was selected and start the main application
            const selectedLanguage = this.webServer.getSelectedLanguage();
            if (selectedLanguage && !this.application) {
                logger.info(`Starting main application with language: ${selectedLanguage}`);
                this.startMainApplication(selectedLanguage);
            }
        }, 1000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            logger.info('Received SIGINT, shutting down gracefully');
            this.stop();
        });

        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM, shutting down gracefully');
            this.stop();
        });
    }

    /**
     * Start the main application with selected language
     * @param {string} language - Selected language code
     * @async
     */
    async startMainApplication(language) {
        try {
            if (this.application) {
                return; // Already running
            }

            logger.info('Initializing main application', { language });
            
            // Set language in configuration or environment
            process.env.SHADOWRECON_LANGUAGE = language;
            
            // Create and run main application
            this.application = new Application();
            await this.application.run();
            
            logger.info('Main application completed');
            
            // Optionally stop the web server after application completes
            // setTimeout(() => this.stop(), 5000);
        } catch (error) {
            logger.error('Main application failed', error.message);
        }
    }

    /**
     * Stop the web launcher
     * @async
     */
    async stop() {
        try {
            logger.info('Stopping web launcher');
            this.isRunning = false;

            // Stop web server
            if (this.webServer) {
                await this.webServer.stop();
            }

            // Cleanup main application if running
            if (this.application) {
                await this.application.cleanup();
            }

            logger.info('Web launcher stopped');
            process.exit(0);
        } catch (error) {
            logger.error('Error stopping web launcher', error.message);
            process.exit(1);
        }
    }
}

/**
 * Application entry point for web interface
 */
async function main() {
    const launcher = new WebLauncher();
    
    try {
        await launcher.start();
    } catch (error) {
        logger.error('Web launcher failed to start', error.message);
        process.exit(1);
    }
}

// Run application if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = {
    WebLauncher,
    main
};