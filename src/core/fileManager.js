/**
 * Enhanced File Management System
 * Handles file operations, saving, and archiving with improved performance
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const SevenZip = require('node-7z');
const sevenBin = require('7zip-bin');
const CoreUtils = require('./utils');
const { logger } = require('./logger');
const { ErrorHandler, FileSystemError } = require('./errors');
const config = require('../config/config');

class FileManager {
    constructor() {
        this.tempDir = null;
        this.zipPath = null;
        this.initialized = false;
        this.fileOperationQueue = [];
        this.processing = false;
        this.stats = {
            filesProcessed: 0,
            totalSize: 0,
            errors: 0
        };
    }

    /**
     * Initialize file manager with temporary directory
     */
    async init() {
        try {
            const tempBase = config.get('paths.temp');
            this.tempDir = path.join(tempBase, 'Save-' + CoreUtils.generateId(10));
            this.zipPath = path.join(tempBase, 'Save-' + CoreUtils.generateId(10) + '.zip');

            // Clean up existing directories
            await this._cleanupExisting();

            // Create temp directory
            await fs.mkdir(this.tempDir, { recursive: true });

            this.initialized = true;
            this.stats = { filesProcessed: 0, totalSize: 0, errors: 0 };
            
            logger.info('File manager initialized', { 
                tempDir: this.tempDir, 
                zipPath: this.zipPath 
            });
        } catch (error) {
            throw new FileSystemError(`Failed to initialize file manager: ${error.message}`);
        }
    }

    /**
     * Clean up existing files and directories
     * @private
     */
    async _cleanupExisting() {
        const cleanupTasks = [];

        if (await CoreUtils.fileExists(this.tempDir)) {
            cleanupTasks.push(
                fs.rm(this.tempDir, { recursive: true, force: true })
                    .catch(error => logger.warn('Failed to cleanup temp dir:', error.message))
            );
        }

        if (await CoreUtils.fileExists(this.zipPath)) {
            cleanupTasks.push(
                fs.rm(this.zipPath)
                    .catch(error => logger.warn('Failed to cleanup zip file:', error.message))
            );
        }

        await Promise.all(cleanupTasks);
    }

    /**
     * Ensure file manager is initialized
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.init();
        }
    }

    /**
     * Save files from source directory to organized structure (async)
     * @param {string} sourcePath - Source directory path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     * @param {number} concurrency - Number of concurrent operations
     * @returns {Promise<Array<string>>} Array of saved file paths
     */
    async saveAsync(sourcePath, mainFolder, subFolder = '', concurrency = 10) {
        await this.ensureInitialized();

        try {
            if (!(await CoreUtils.fileExists(sourcePath))) {
                logger.warn(`Source path does not exist: ${sourcePath}`);
                return [];
            }

            const files = CoreUtils.recursiveRead(sourcePath);
            
            // Batch process files for better performance
            const copyTasks = files.map(file => ({
                source: path.join(sourcePath, file),
                target: path.join(this.tempDir, mainFolder, subFolder, file),
                relativePath: subFolder ? 
                    path.join(mainFolder, subFolder, file) : 
                    path.join(mainFolder, file)
            }));

            const results = await CoreUtils.batchProcess(
                copyTasks, 
                async (task) => {
                    const success = await this.copyFileAsync(task.source, task.target);
                    return success ? task.relativePath : null;
                }, 
                concurrency
            );

            const saved = results
                .filter(result => result.success && result.result)
                .map(result => result.result);

            logger.debug(`Saved ${saved.length} files from ${sourcePath} to ${mainFolder}/${subFolder}`);
            this.stats.filesProcessed += saved.length;
            
            return saved;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, subFolder });
            return [];
        }
    }

    /**
     * Save files from source directory to organized structure (sync version)
     * @param {string} sourcePath - Source directory path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     * @returns {Array<string>} Array of saved file paths
     */
    save(sourcePath, mainFolder, subFolder = '') {
        this.ensureInitialized();

        try {
            if (!fsSync.existsSync(sourcePath)) {
                logger.warn(`Source path does not exist: ${sourcePath}`);
                return [];
            }

            const files = CoreUtils.recursiveRead(sourcePath);
            const saved = [];

            for (const file of files) {
                const fullSourcePath = path.join(sourcePath, file);
                const relativePath = subFolder ? 
                    path.join(mainFolder, subFolder, file) : 
                    path.join(mainFolder, file);
                const savePath = path.join(this.tempDir, relativePath);

                if (this.copyFile(fullSourcePath, savePath)) {
                    saved.push(relativePath);
                }
            }

            logger.debug(`Saved ${saved.length} files from ${sourcePath} to ${mainFolder}/${subFolder}`);
            this.stats.filesProcessed += saved.length;
            return saved;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, subFolder });
            return [];
        }
    }

    /**
     * Save single file (async)
     * @param {string} sourcePath - Source file path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name in archive
     * @returns {Promise<boolean>} Success status
     */
    async saveSingleAsync(sourcePath, mainFolder, fileName = null) {
        await this.ensureInitialized();

        try {
            if (!(await CoreUtils.fileExists(sourcePath))) {
                logger.warn(`Source file does not exist: ${sourcePath}`);
                return false;
            }

            const targetFileName = fileName || CoreUtils.getFileName(sourcePath);
            const savePath = path.join(this.tempDir, mainFolder, targetFileName);

            const success = await this.copyFileAsync(sourcePath, savePath);
            if (success) {
                this.stats.filesProcessed++;
                const size = await CoreUtils.getFileSize(sourcePath);
                this.stats.totalSize += size;
            }
            
            return success;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save single file (legacy sync version)
     * @param {string} sourcePath - Source file path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name in archive
     */
    saveSingle(sourcePath, mainFolder, fileName = null) {
        this.ensureInitialized();

        try {
            if (!fsSync.existsSync(sourcePath)) {
                logger.warn(`Source file does not exist: ${sourcePath}`);
                return false;
            }

            const targetFileName = fileName || CoreUtils.getFileName(sourcePath);
            const savePath = path.join(this.tempDir, mainFolder, targetFileName);

            const success = this.copyFile(sourcePath, savePath);
            if (success) {
                this.stats.filesProcessed++;
            }
            
            return success;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save array of files or directories (async)
     * @param {Array<string>} sources - Array of source paths
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     * @param {number} concurrency - Number of concurrent operations
     * @returns {Promise<Array<string>>} Array of saved file paths
     */
    async saveArrayAsync(sources, mainFolder, subFolder = '', concurrency = 5) {
        await this.ensureInitialized();

        const processTasks = sources.map(async (source) => {
            try {
                if (!(await CoreUtils.fileExists(source))) {
                    return [];
                }

                const stat = await fs.lstat(source);
                if (stat.isDirectory()) {
                    return await this.saveAsync(source, mainFolder, subFolder, concurrency);
                } else {
                    const fileName = CoreUtils.getFileName(source);
                    const success = await this.saveSingleAsync(source, mainFolder, fileName);
                    const relativePath = subFolder ? 
                        path.join(mainFolder, subFolder, fileName) : 
                        path.join(mainFolder, fileName);
                    return success ? [relativePath] : [];
                }
            } catch (error) {
                this.stats.errors++;
                ErrorHandler.handle(error, null, { source, mainFolder, subFolder });
                return [];
            }
        });

        const results = await Promise.all(processTasks);
        const savedFiles = results.flat();

        logger.debug(`Saved ${savedFiles.length} files from array to ${mainFolder}/${subFolder}`);
        return savedFiles;
    }

    /**
     * Save array of files or directories (legacy sync version)
     * @param {Array<string>} sources - Array of source paths
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     */
    saveArray(sources, mainFolder, subFolder = '') {
        this.ensureInitialized();

        const savedFiles = [];

        for (const source of sources) {
            try {
                if (!fsSync.existsSync(source)) {
                    continue;
                }

                if (fsSync.lstatSync(source).isDirectory()) {
                    const files = this.save(source, mainFolder, subFolder);
                    savedFiles.push(...files);
                } else {
                    const fileName = CoreUtils.getFileName(source);
                    const relativePath = subFolder ? 
                        path.join(mainFolder, subFolder, fileName) : 
                        path.join(mainFolder, fileName);
                    const savePath = path.join(this.tempDir, relativePath);

                    if (this.copyFile(source, savePath)) {
                        savedFiles.push(relativePath);
                    }
                }
            } catch (error) {
                this.stats.errors++;
                ErrorHandler.handle(error, null, { source, mainFolder, subFolder });
            }
        }

        logger.debug(`Saved ${savedFiles.length} files from array to ${mainFolder}/${subFolder}`);
        return savedFiles;
    }

    /**
     * Save data as JSON file (async)
     * @param {Object} data - Data to save
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     * @returns {Promise<boolean>} Success status
     */
    async saveJsonAsync(data, mainFolder, fileName) {
        await this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);
            const jsonData = JSON.stringify(data, null, 2);

            await CoreUtils.createDirectoryRecursiveAsync(savePath);
            await fs.writeFile(savePath, jsonData);

            logger.debug(`Saved JSON data to ${mainFolder}/${fileName}`);
            this.stats.filesProcessed++;
            this.stats.totalSize += Buffer.byteLength(jsonData);
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save data as JSON file (legacy sync version)
     * @param {Object} data - Data to save
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     */
    saveJson(data, mainFolder, fileName) {
        this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);
            const jsonData = JSON.stringify(data, null, 2);

            CoreUtils.createDirectoryRecursive(savePath);
            fsSync.writeFileSync(savePath, jsonData);

            logger.debug(`Saved JSON data to ${mainFolder}/${fileName}`);
            this.stats.filesProcessed++;
            this.stats.totalSize += Buffer.byteLength(jsonData);
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save text data to file (async)
     * @param {string} text - Text content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     * @returns {Promise<boolean>} Success status
     */
    async saveTextAsync(text, mainFolder, fileName) {
        await this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            await CoreUtils.createDirectoryRecursiveAsync(savePath);
            await fs.writeFile(savePath, text);

            logger.debug(`Saved text data to ${mainFolder}/${fileName}`);
            this.stats.filesProcessed++;
            this.stats.totalSize += Buffer.byteLength(text);
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save text data to file (legacy sync version)
     * @param {string} text - Text content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     */
    saveText(text, mainFolder, fileName) {
        this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            CoreUtils.createDirectoryRecursive(savePath);
            fsSync.writeFileSync(savePath, text);

            logger.debug(`Saved text data to ${mainFolder}/${fileName}`);
            this.stats.filesProcessed++;
            this.stats.totalSize += Buffer.byteLength(text);
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save buffer data to file (async)
     * @param {Buffer} buffer - Buffer content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     * @returns {Promise<boolean>} Success status
     */
    async saveBufferAsync(buffer, mainFolder, fileName) {
        await this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            await CoreUtils.createDirectoryRecursiveAsync(savePath);
            await fs.writeFile(savePath, buffer);

            logger.debug(`Saved buffer data to ${mainFolder}/${fileName}`, {
                size: `${(buffer.length / 1024).toFixed(2)} KB`
            });
            this.stats.filesProcessed++;
            this.stats.totalSize += buffer.length;
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save buffer data to file (legacy sync version)
     * @param {Buffer} buffer - Buffer content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     */
    saveBuffer(buffer, mainFolder, fileName) {
        this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            CoreUtils.createDirectoryRecursive(savePath);
            fsSync.writeFileSync(savePath, buffer);

            logger.debug(`Saved buffer data to ${mainFolder}/${fileName}`, {
                size: `${(buffer.length / 1024).toFixed(2)} KB`
            });
            this.stats.filesProcessed++;
            this.stats.totalSize += buffer.length;
            return true;
        } catch (error) {
            this.stats.errors++;
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Copy file from source to destination (async)
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @returns {Promise<boolean>} True if successful
     */
    async copyFileAsync(sourcePath, destPath) {
        try {
            await CoreUtils.createDirectoryRecursiveAsync(destPath);
            await fs.copyFile(sourcePath, destPath);
            
            const size = await CoreUtils.getFileSize(destPath);
            this.stats.totalSize += size;
            
            return true;
        } catch (error) {
            logger.warn(`Failed to copy file ${sourcePath} to ${destPath}:`, error.message);
            return false;
        }
    }

    /**
     * Copy file from source to destination (legacy sync version)
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @returns {boolean} True if successful
     */
    copyFile(sourcePath, destPath) {
        try {
            CoreUtils.createDirectoryRecursive(destPath);
            fsSync.copyFileSync(sourcePath, destPath);
            
            const stats = fsSync.statSync(destPath);
            this.stats.totalSize += stats.size;
            
            return true;
        } catch (error) {
            logger.warn(`Failed to copy file ${sourcePath} to ${destPath}:`, error.message);
            return false;
        }
    }

    /**
     * Get file statistics
     * @returns {Object} File operation statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset file statistics
     */
    resetStats() {
        this.stats = {
            filesProcessed: 0,
            totalSize: 0,
            errors: 0
        };
    }

    /**
     * Create ZIP archive of all saved files
     * @param {string} password - Optional password for protection
     * @returns {Promise<string>} Path to ZIP file
     */
    async createZip(password = null) {
        this.ensureInitialized();

        if (password) {
            return this.createPasswordProtectedZip(password);
        } else {
            return this.createStandardZip();
        }
    }

    /**
     * Create standard ZIP archive without password
     * @returns {Promise<string>} Path to ZIP file
     */
    async createStandardZip() {
        return new Promise((resolve, reject) => {
            try {
                const output = fs.createWriteStream(this.zipPath);
                const archive = archiver('zip', {
                    zlib: { level: 9 }
                });

                output.on('close', () => {
                    logger.info(`Archive created: ${this.zipPath} (${archive.pointer()} bytes)`);
                    resolve(this.zipPath);
                });

                archive.on('error', (error) => {
                    reject(new FileSystemError(`Archive creation failed: ${error.message}`));
                });

                archive.pipe(output);
                archive.directory(this.tempDir, false);
                archive.finalize();
            } catch (error) {
                reject(new FileSystemError(`Failed to create archive: ${error.message}`));
            }
        });
    }

    /**
     * Create password-protected ZIP archive using 7-Zip
     * @param {string} password - Password for protection
     * @returns {Promise<string>} Path to ZIP file
     */
    async createPasswordProtectedZip(password) {
        return new Promise((resolve, reject) => {
            try {
                // Ensure the 7z binary has execute permissions
                this.ensureBinaryPermissions();
                
                // Use 7-Zip to create password-protected archive with proper binary path
                const sevenZip = SevenZip.add(this.zipPath, `${this.tempDir}${path.sep}*`, {
                    password: password,
                    recursive: true,
                    $bin: sevenBin.path7za // Use the 7z binary from 7zip-bin package
                });

                sevenZip.on('end', () => {
                    logger.info(`Password-protected archive created: ${this.zipPath}`);
                    resolve(this.zipPath);
                });

                sevenZip.on('error', (error) => {
                    reject(new FileSystemError(`Password-protected archive creation failed: ${error.message}`));
                });
            } catch (error) {
                reject(new FileSystemError(`Failed to create password-protected archive: ${error.message}`));
            }
        });
    }

    /**
     * Ensure the 7z binary has execute permissions
     */
    ensureBinaryPermissions() {
        try {
            if (process.platform !== 'win32') {
                // On Unix-like systems, ensure the binary is executable
                const binaryPath = sevenBin.path7za;
                if (fs.existsSync(binaryPath)) {
                    fs.chmodSync(binaryPath, '755');
                    logger.debug('7z binary permissions ensured', { path: binaryPath });
                }
            }
        } catch (error) {
            logger.warn('Failed to set binary permissions', error.message);
        }
    }

    /**
     * Get size of ZIP file in bytes
     * @returns {number} Size in bytes
     */
    getZipSize() {
        try {
            if (fs.existsSync(this.zipPath)) {
                return fs.statSync(this.zipPath).size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get size of ZIP file in MB
     * @returns {number} Size in MB
     */
    getZipSizeMB() {
        return this.getZipSize() / (1024 * 1024);
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        try {
            if (this.tempDir && fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
                logger.debug('Temporary directory cleaned up', { tempDir: this.tempDir });
            }

            if (this.zipPath && fs.existsSync(this.zipPath)) {
                fs.rmSync(this.zipPath);
                logger.debug('ZIP file cleaned up', { zipPath: this.zipPath });
            }
        } catch (error) {
            logger.warn('Failed to cleanup files', error.message);
        }
    }

    /**
     * Get temporary directory path
     * @returns {string} Temporary directory path
     */
    getTempDir() {
        return this.tempDir;
    }

    /**
     * Get ZIP file path
     * @returns {string} ZIP file path
     */
    getZipPath() {
        return this.zipPath;
    }
}

// Create and export singleton instance
const fileManager = new FileManager();

module.exports = {
    FileManager,
    fileManager
};