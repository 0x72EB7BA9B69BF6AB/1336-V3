/**
 * Screenshot Capture Module
 * Provides cross-platform screenshot functionality
 */

const { logger } = require('../../core/logger');
const CoreUtils = require('../../core/utils');
const path = require('path');
const fs = require('fs');

class ScreenshotCapture {
    constructor() {
        this.platform = process.platform;
        this.outputDir = null;
    }

    /**
     * Set output directory for screenshots
     * @param {string} outputDir - Directory to save screenshots
     */
    setOutputDirectory(outputDir) {
        this.outputDir = outputDir;
        CoreUtils.createDirectoryRecursive(path.join(outputDir, 'dummy.txt'));
    }

    /**
     * Get screenshot command based on platform
     * @param {string} outputPath - Path to save screenshot
     * @returns {string|null} Screenshot command
     */
    getScreenshotCommand(outputPath) {
        switch (this.platform) {
            case 'win32':
                // Windows: Use PowerShell to take screenshot
                return `powershell -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $bounds = [Windows.Forms.Screen]::AllScreens | ForEach-Object {$_.Bounds}; $screenshot = New-Object Drawing.Bitmap($bounds.Width, $bounds.Height); $graphics = [Drawing.Graphics]::FromImage($screenshot); $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $screenshot.Size); $screenshot.Save('${outputPath}'); $screenshot.Dispose(); $graphics.Dispose()"`;
            
            case 'darwin':
                // macOS: Use screencapture
                return `screencapture -x "${outputPath}"`;
            
            case 'linux':
                // Linux: Try multiple screenshot tools in order of preference
                const tools = [
                    `gnome-screenshot -f "${outputPath}"`,
                    `scrot "${outputPath}"`,
                    `import -window root "${outputPath}"`,
                    `xwd -root | convert xwd:- "${outputPath}"`
                ];
                return tools; // Return array for Linux to try multiple options
            
            default:
                logger.warn('Unsupported platform for screenshots', { platform: this.platform });
                return null;
        }
    }

    /**
     * Take a screenshot
     * @returns {Promise<string|null>} Path to screenshot file or null if failed
     */
    async takeScreenshot() {
        try {
            if (!this.outputDir) {
                logger.error('Output directory not set for screenshots');
                return null;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `screenshot_${timestamp}.png`;
            const outputPath = path.join(this.outputDir, filename);

            logger.info('Taking screenshot', { outputPath });

            const commands = this.getScreenshotCommand(outputPath);
            if (!commands) {
                logger.warn('Screenshot not supported on this platform');
                return null;
            }

            let success = false;
            let lastError = null;

            // Handle single command or array of commands (for Linux)
            const commandList = Array.isArray(commands) ? commands : [commands];

            for (const command of commandList) {
                try {
                    const result = await CoreUtils.executeCommand(command, 15000);
                    
                    if (result.success) {
                        // Verify file was created
                        if (fs.existsSync(outputPath)) {
                            const stats = fs.statSync(outputPath);
                            if (stats.size > 0) {
                                success = true;
                                logger.info('Screenshot captured successfully', { 
                                    path: outputPath, 
                                    size: stats.size,
                                    command: command.split(' ')[0] // Log just the tool name for privacy
                                });
                                break;
                            }
                        }
                    }
                    lastError = result.error || 'Command succeeded but no file created';
                } catch (error) {
                    lastError = error.message;
                    continue;
                }
            }

            if (!success) {
                logger.warn('Failed to capture screenshot', { 
                    platform: this.platform,
                    error: lastError,
                    triedCommands: commandList.length
                });
                return null;
            }

            return outputPath;
        } catch (error) {
            logger.error('Screenshot capture error', error.message);
            return null;
        }
    }

    /**
     * Take multiple screenshots with delay
     * @param {number} count - Number of screenshots to take
     * @param {number} delayMs - Delay between screenshots in milliseconds
     * @returns {Promise<Array<string>>} Array of screenshot paths
     */
    async takeMultipleScreenshots(count = 1, delayMs = 1000) {
        const screenshots = [];
        
        for (let i = 0; i < count; i++) {
            if (i > 0) {
                await CoreUtils.sleep(delayMs);
            }
            
            const screenshot = await this.takeScreenshot();
            if (screenshot) {
                screenshots.push(screenshot);
            }
        }
        
        return screenshots;
    }

    /**
     * Get screenshot info without taking one (for testing)
     * @returns {Object} Screenshot capabilities info
     */
    getCapabilities() {
        const commands = this.getScreenshotCommand('/tmp/test.png');
        return {
            platform: this.platform,
            supported: commands !== null,
            availableCommands: Array.isArray(commands) ? commands.length : (commands ? 1 : 0)
        };
    }
}

module.exports = ScreenshotCapture;