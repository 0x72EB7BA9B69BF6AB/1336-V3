/**
 * Screenshot Capture Module
 * Handles screenshot capture functionality at application launch
 */

const fs = require('fs');
const path = require('path');
const screenshot = require('screenshot-desktop');
const { logger } = require('../../core/logger');
const { ErrorHandler, ModuleError } = require('../../core/errors');
const { fileManager } = require('../../core/fileManager');

class ScreenshotCapture {
    constructor() {
        this.screenshotPath = null;
    }

    /**
     * Capture screenshot of the desktop
     * @returns {Promise<string|null>} Path to captured screenshot or null if failed
     */
    async captureScreenshot() {
        try {
            logger.info('Capturing desktop screenshot');

            // Check if we're in a headless environment
            if (!process.env.DISPLAY && process.platform === 'linux') {
                logger.warn('No display detected (headless environment) - creating placeholder screenshot');
                return await this.createPlaceholderScreenshot();
            }

            // Generate unique filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screenshot_${timestamp}.png`;
            
            // Create screenshots directory if it doesn't exist
            const screenshotDir = path.join(process.cwd(), 'screenshots');
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            
            const screenshotPath = path.join(screenshotDir, filename);

            // Capture screenshot
            const imgBuffer = await screenshot({ format: 'png' });
            
            // Save screenshot to file
            fs.writeFileSync(screenshotPath, imgBuffer);
            
            this.screenshotPath = screenshotPath;
            
            logger.info('Screenshot captured successfully', { 
                path: screenshotPath,
                size: `${(imgBuffer.length / 1024 / 1024).toFixed(2)} MB`
            });

            return screenshotPath;
        } catch (error) {
            ErrorHandler.handle(
                new ModuleError(`Screenshot capture failed: ${error.message}`, 'screenshot'),
                null,
                { error: error.message }
            );
            
            // Try to create a placeholder screenshot as fallback
            try {
                logger.info('Creating placeholder screenshot as fallback');
                return await this.createPlaceholderScreenshot();
            } catch (placeholderError) {
                logger.error('Failed to create placeholder screenshot', placeholderError.message);
                return null;
            }
        }
    }

    /**
     * Create a placeholder screenshot when real capture fails
     * @returns {Promise<string|null>} Path to placeholder screenshot
     */
    async createPlaceholderScreenshot() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screenshot_placeholder_${timestamp}.txt`;
            
            // Create screenshots directory if it doesn't exist
            const screenshotDir = path.join(process.cwd(), 'screenshots');
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            
            const screenshotPath = path.join(screenshotDir, filename);

            // Create placeholder content
            const placeholderContent = `Screenshot Capture Report
Generated: ${new Date().toISOString()}

Status: Screenshot capture not available
Environment: ${process.platform}
Display: ${process.env.DISPLAY || 'None detected'}

Reason: This system appears to be running in a headless environment
or the screenshot library dependencies are not available.

Technical Details:
- Platform: ${process.platform}
- Architecture: ${process.arch}
- Node Version: ${process.version}
- Working Directory: ${process.cwd()}

This placeholder file indicates that the screenshot module was executed
but could not capture an actual screenshot due to system limitations.
`;
            
            // Save placeholder file
            fs.writeFileSync(screenshotPath, placeholderContent);
            
            this.screenshotPath = screenshotPath;
            
            logger.info('Placeholder screenshot created', { 
                path: screenshotPath,
                size: `${(placeholderContent.length / 1024).toFixed(2)} KB`
            });

            return screenshotPath;
        } catch (error) {
            logger.error('Failed to create placeholder screenshot', error.message);
            return null;
        }
    }

    /**
     * Get the path of the last captured screenshot
     * @returns {string|null} Path to screenshot or null
     */
    getScreenshotPath() {
        return this.screenshotPath;
    }

    /**
     * Check if screenshot file exists
     * @returns {boolean} True if screenshot exists
     */
    screenshotExists() {
        return this.screenshotPath && fs.existsSync(this.screenshotPath);
    }

    /**
     * Get screenshot buffer for sending
     * @returns {Buffer|null} Screenshot buffer or null
     */
    getScreenshotBuffer() {
        try {
            if (this.screenshotExists()) {
                return fs.readFileSync(this.screenshotPath);
            }
            return null;
        } catch (error) {
            logger.error('Failed to read screenshot buffer', error.message);
            return null;
        }
    }

    /**
     * Cleanup screenshot files
     */
    cleanup() {
        try {
            if (this.screenshotPath && fs.existsSync(this.screenshotPath)) {
                fs.unlinkSync(this.screenshotPath);
                logger.debug('Screenshot file cleaned up', { path: this.screenshotPath });
            }
        } catch (error) {
            logger.debug('Failed to cleanup screenshot', error.message);
        }
    }
}

module.exports = {
    ScreenshotCapture
};