/**
 * File Management System
 * Handles file operations, saving, and archiving
 */

const fs = require('fs');
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
    }

    /**
     * Initialize file manager with temporary directory
     */
    init() {
        try {
            const tempBase = config.get('paths.temp');
            this.tempDir = path.join(tempBase, 'Save-' + CoreUtils.generateId(10));
            this.zipPath = path.join(tempBase, 'Save-' + CoreUtils.generateId(10) + '.zip');

            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            }

            fs.mkdirSync(this.tempDir, { recursive: true });

            if (fs.existsSync(this.zipPath)) {
                fs.rmSync(this.zipPath);
            }

            this.initialized = true;
            logger.info('File manager initialized', { tempDir: this.tempDir, zipPath: this.zipPath });
        } catch (error) {
            throw new FileSystemError(`Failed to initialize file manager: ${error.message}`);
        }
    }

    /**
     * Ensure file manager is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            this.init();
        }
    }

    /**
     * Save files from source directory to organized structure
     * @param {string} sourcePath - Source directory path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     */
    save(sourcePath, mainFolder, subFolder = '') {
        this.ensureInitialized();

        try {
            if (!fs.existsSync(sourcePath)) {
                logger.warn(`Source path does not exist: ${sourcePath}`);
                return;
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
            return saved;
        } catch (error) {
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, subFolder });
            return [];
        }
    }

    /**
     * Save single file
     * @param {string} sourcePath - Source file path
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name in archive
     */
    saveSingle(sourcePath, mainFolder, fileName = null) {
        this.ensureInitialized();

        try {
            if (!fs.existsSync(sourcePath)) {
                logger.warn(`Source file does not exist: ${sourcePath}`);
                return false;
            }

            const targetFileName = fileName || CoreUtils.getFileName(sourcePath);
            const savePath = path.join(this.tempDir, mainFolder, targetFileName);

            return this.copyFile(sourcePath, savePath);
        } catch (error) {
            ErrorHandler.handle(error, null, { sourcePath, mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save array of files or directories
     * @param {Array<string>} sources - Array of source paths
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} subFolder - Sub folder name in archive
     */
    saveArray(sources, mainFolder, subFolder = '') {
        this.ensureInitialized();

        const savedFiles = [];

        for (const source of sources) {
            try {
                if (!fs.existsSync(source)) {
                    continue;
                }

                if (fs.lstatSync(source).isDirectory()) {
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
                ErrorHandler.handle(error, null, { source, mainFolder, subFolder });
            }
        }

        logger.debug(`Saved ${savedFiles.length} files from array to ${mainFolder}/${subFolder}`);
        return savedFiles;
    }

    /**
     * Save data as JSON file
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
            fs.writeFileSync(savePath, jsonData);

            logger.debug(`Saved JSON data to ${mainFolder}/${fileName}`);
            return true;
        } catch (error) {
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save text data to file
     * @param {string} text - Text content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     */
    saveText(text, mainFolder, fileName) {
        this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            CoreUtils.createDirectoryRecursive(savePath);
            fs.writeFileSync(savePath, text);

            logger.debug(`Saved text data to ${mainFolder}/${fileName}`);
            return true;
        } catch (error) {
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Save buffer data to file
     * @param {Buffer} buffer - Buffer content
     * @param {string} mainFolder - Main folder name in archive
     * @param {string} fileName - File name
     */
    saveBuffer(buffer, mainFolder, fileName) {
        this.ensureInitialized();

        try {
            const savePath = path.join(this.tempDir, mainFolder, fileName);

            CoreUtils.createDirectoryRecursive(savePath);
            fs.writeFileSync(savePath, buffer);

            logger.debug(`Saved buffer data to ${mainFolder}/${fileName}`, {
                size: `${(buffer.length / 1024).toFixed(2)} KB`
            });
            return true;
        } catch (error) {
            ErrorHandler.handle(error, null, { mainFolder, fileName });
            return false;
        }
    }

    /**
     * Copy file from source to destination
     * @param {string} sourcePath - Source file path
     * @param {string} destPath - Destination file path
     * @returns {boolean} True if successful
     */
    copyFile(sourcePath, destPath) {
        try {
            CoreUtils.createDirectoryRecursive(destPath);
            fs.copyFileSync(sourcePath, destPath);
            return true;
        } catch (error) {
            logger.debug(`Failed to copy file: ${sourcePath} -> ${destPath}`, error.message);
            return false;
        }
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