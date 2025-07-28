/**
 * Upload Service Module
 * Handles file uploads to various services (GoFile, etc.)
 */

const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { logger } = require('../../core/logger');
const { ErrorHandler, NetworkError } = require('../../core/errors');
const config = require('../../config/config');

class UploadService {
    constructor() {
        this.services = {
            gofile: new GoFileUploader(),
            // Can add other upload services here
        };
        this.defaultService = config.get('upload.service', 'gofile');
        this.maxSize = config.get('upload.maxSize', 7 * 1024 * 1024); // 7MB
    }

    /**
     * Upload file using configured service with fallback handling
     * @param {string} filePath - Path to file to upload
     * @param {string} service - Service to use (optional)
     * @param {Object} metadata - Additional metadata (password, etc.)
     * @returns {Promise<Object>} Upload result with download URL and metadata
     */
    async upload(filePath, service = null, metadata = {}) {
        try {
            // Check if upload is enabled
            if (!config.get('upload.enabled', true)) {
                logger.info('Upload service is disabled - skipping upload');
                return null;
            }

            if (!fs.existsSync(filePath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }

            const fileSize = fs.statSync(filePath).size;
            logger.info('Starting file upload', {
                file: filePath,
                size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
                service: service || this.defaultService,
                hasPassword: !!metadata.password
            });

            const uploader = this.getUploader(service);
            const downloadUrl = await uploader.upload(filePath);

            const result = {
                downloadUrl: downloadUrl,
                ...metadata
            };

            logger.info('File upload completed', {
                file: filePath,
                downloadUrl: downloadUrl,
                hasPassword: !!metadata.password
            });

            return result;
        } catch (error) {
            logger.warn('Upload failed - continuing without upload', {
                error: error.message,
                file: filePath
            });
            // Don't throw error, just return null to indicate upload failed
            return null;
        }
    }

    /**
     * Get uploader instance for service
     * @param {string} service - Service name
     * @returns {Object} Uploader instance
     */
    getUploader(service = null) {
        const serviceName = service || this.defaultService;
        
        if (!this.services[serviceName]) {
            throw new Error(`Unknown upload service: ${serviceName}`);
        }

        return this.services[serviceName];
    }

    /**
     * Check if file should be uploaded based on size or name pattern
     * @param {string} filePath - Path to file
     * @returns {boolean} True if file should be uploaded
     */
    shouldUpload(filePath) {
        try {
            // Check if upload is enabled
            if (!config.get('upload.enabled', true)) {
                return false;
            }

            const fileName = require('path').basename(filePath).toLowerCase();
            
            // Always upload all ZIP files regardless of size
            if (fileName.endsWith('.zip')) {
                return true;
            }
            
            // Always upload save-* files regardless of size
            if (fileName.startsWith('save-')) {
                return true;
            }
            
            // For other files, check size limit
            const fileSize = fs.statSync(filePath).size;
            return fileSize > this.maxSize;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if file should be password protected
     * @param {string} filePath - Path to file
     * @returns {boolean} True if file should be password protected
     */
    shouldPasswordProtect(filePath) {
        try {
            const fileName = require('path').basename(filePath).toLowerCase();
            // Password protect save-* files
            return fileName.startsWith('save-');
        } catch (error) {
            return false;
        }
    }

    /**
     * Get file size in MB
     * @param {string} filePath - Path to file
     * @returns {number} File size in MB
     */
    getFileSizeMB(filePath) {
        try {
            const fileSize = fs.statSync(filePath).size;
            return fileSize / 1024 / 1024;
        } catch (error) {
            return 0;
        }
    }
}

/**
 * GoFile upload service implementation
 */
class GoFileUploader {
    constructor() {
        this.baseUrl = 'https://api.gofile.io';
        this.timeout = 60000; // 60 seconds
    }

    /**
     * Upload file to GoFile
     * @param {string} filePath - Path to file to upload
     * @returns {Promise<string>} Download URL
     */
    async upload(filePath) {
        try {
            // Get server
            const server = await this.getServer();
            
            // Upload file
            const downloadUrl = await this.uploadFile(filePath, server);
            
            return downloadUrl;
        } catch (error) {
            throw new Error(`GoFile upload failed: ${error.message}`);
        }
    }

    /**
     * Get available server for upload
     * @returns {Promise<string>} Server name
     */
    async getServer() {
        try {
            const response = await axios.get(`${this.baseUrl}/getServer`, {
                headers: {
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'referrer': 'https://gofile.io/uploadFiles',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
                    'dnt': '1',
                    'origin': 'https://gofile.io'
                },
                timeout: 10000
            });

            if (response.data.status !== 'ok') {
                throw new Error(`Failed to get server: ${JSON.stringify(response.data)}`);
            }

            logger.debug('GoFile server obtained', { server: response.data.data.server });
            return response.data.data.server;
        } catch (error) {
            throw new Error(`Failed to get GoFile server: ${error.message}`);
        }
    }

    /**
     * Upload file to specific server
     * @param {string} filePath - Path to file
     * @param {string} server - Server name
     * @returns {Promise<string>} Download URL
     */
    async uploadFile(filePath, server) {
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            const response = await axios.post(`https://${server}.gofile.io/uploadFile`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'referrer': 'https://gofile.io/uploadFiles'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: this.timeout
            });

            if (response.data.status !== 'ok') {
                throw new Error(`Upload failed: ${JSON.stringify(response.data)}`);
            }

            const downloadUrl = response.data.data.downloadPage;
            logger.debug('GoFile upload successful', { 
                downloadUrl: downloadUrl,
                fileId: response.data.data.fileId 
            });

            return downloadUrl;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('Upload timeout - file too large or connection too slow');
            }
            throw new Error(`File upload failed: ${error.message}`);
        }
    }
}

/**
 * Anonymous file upload service (example implementation)
 */
class AnonFileUploader {
    constructor() {
        this.baseUrl = 'https://api.anonfiles.com';
        this.timeout = 60000;
    }

    /**
     * Upload file to AnonFiles
     * @param {string} filePath - Path to file to upload
     * @returns {Promise<string>} Download URL
     */
    async upload(filePath) {
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            const response = await axios.post(`${this.baseUrl}/upload`, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: this.timeout
            });

            if (!response.data.status) {
                throw new Error(`Upload failed: ${JSON.stringify(response.data)}`);
            }

            return response.data.data.file.url.full;
        } catch (error) {
            throw new Error(`AnonFiles upload failed: ${error.message}`);
        }
    }
}

// Create and export singleton instance
const uploadService = new UploadService();

module.exports = {
    UploadService,
    GoFileUploader,
    AnonFileUploader,
    uploadService
};