/**
 * Encryption utilities for securing sensitive data like webhook URLs
 * Uses AES-256-GCM encryption with a system-derived key
 */

const crypto = require('crypto');
const os = require('os');

class EncryptionUtils {
    constructor() {
        // Generate a deterministic key based on system information
        // This ensures the same system can always decrypt its own data
        this.key = this.generateSystemKey();
    }

    /**
     * Generate encryption key based on system information
     * @returns {Buffer} 32-byte encryption key
     */
    generateSystemKey() {
        try {
            // Combine system information to create a unique but deterministic key
            const systemInfo = [
                os.hostname(),
                os.platform(),
                os.arch(),
                'ShadowRecon-V3', // Application identifier
                'webhook-encryption' // Purpose identifier
            ].join('|');

            // Hash the system info to create a 32-byte key
            return crypto.createHash('sha256').update(systemInfo).digest();
        } catch (error) {
            // Fallback to a hardcoded key if system info fails
            return crypto.createHash('sha256').update('ShadowRecon-V3-fallback-key').digest();
        }
    }

    /**
     * Encrypt a string using AES-256-GCM
     * @param {string} text - Text to encrypt
     * @returns {string} Base64 encoded encrypted data with format: iv:encryptedData:authTag
     */
    encrypt(text) {
        try {
            if (!text || typeof text !== 'string') {
                return text; // Return as-is if not a valid string
            }

            // Generate random IV for each encryption
            const iv = crypto.randomBytes(12); // 12 bytes for GCM

            // Create cipher
            const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

            // Encrypt the text
            let encrypted = cipher.update(text, 'utf8');
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            // Get authentication tag
            const authTag = cipher.getAuthTag();

            // Combine iv, encrypted data, and auth tag, then encode as base64
            const combined = Buffer.concat([iv, encrypted, authTag]);

            return combined.toString('base64');
        } catch (error) {
            console.warn('Encryption failed, returning original text:', error.message);
            return text; // Return original text if encryption fails
        }
    }

    /**
     * Decrypt a string using AES-256-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @returns {string} Decrypted text
     */
    decrypt(encryptedData) {
        try {
            if (!encryptedData || typeof encryptedData !== 'string') {
                return encryptedData; // Return as-is if not a valid string
            }

            // If the data doesn't look encrypted, return as-is
            if (!this.isEncrypted(encryptedData)) {
                return encryptedData;
            }

            // Decode from base64
            const combined = Buffer.from(encryptedData, 'base64');

            // Extract components (iv: 12 bytes, authTag: 16 bytes, rest: encrypted data)
            const iv = combined.slice(0, 12);
            const authTag = combined.slice(-16);
            const encrypted = combined.slice(12, -16);

            // Create decipher
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
            decipher.setAuthTag(authTag);

            // Decrypt the data
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.warn('Decryption failed, returning original data:', error.message);
            return encryptedData; // Return original data if decryption fails
        }
    }

    /**
     * Check if a string appears to be encrypted data
     * @param {string} data - Data to check
     * @returns {boolean} True if data appears encrypted
     */
    isEncrypted(data) {
        if (!data || typeof data !== 'string') {
            return false;
        }

        // Check if it's a valid base64 string with appropriate length
        try {
            const buffer = Buffer.from(data, 'base64');
            // Minimum length: 12 (iv) + 16 (authTag) + 1 (at least 1 byte of data) = 29
            if (buffer.length < 29) {
                return false;
            }

            // Check if the base64 string is properly encoded
            return buffer.toString('base64') === data;
        } catch (error) {
            return false;
        }
    }

    /**
     * Encrypt webhook URL if it's not already encrypted
     * @param {string} webhookUrl - Webhook URL to encrypt
     * @returns {string} Encrypted webhook URL
     */
    encryptWebhook(webhookUrl) {
        if (!webhookUrl || webhookUrl === '%WEBHOOK%') {
            return webhookUrl; // Don't encrypt placeholder or empty values
        }

        // Don't encrypt if already encrypted
        if (this.isEncrypted(webhookUrl)) {
            return webhookUrl;
        }

        return this.encrypt(webhookUrl);
    }

    /**
     * Decrypt webhook URL if it's encrypted
     * @param {string} webhookUrl - Potentially encrypted webhook URL
     * @returns {string} Decrypted webhook URL
     */
    decryptWebhook(webhookUrl) {
        if (!webhookUrl || webhookUrl === '%WEBHOOK%') {
            return webhookUrl; // Don't decrypt placeholder or empty values
        }

        return this.decrypt(webhookUrl);
    }
}

// Export singleton instance
const encryptionUtils = new EncryptionUtils();

module.exports = {
    EncryptionUtils,
    encryptionUtils
};
