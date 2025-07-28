/**
 * Application Constants
 * Centralized constants used throughout the application
 */

// Application Information
const APP_INFO = {
    NAME: 'ShadowRecon',
    VERSION: '3.0.0',
    DESCRIPTION: 'Clean, modular, and efficient data collection tool'
};

// Default Configuration Values
const DEFAULTS = {
    WEBHOOK_TIMEOUT: 30000,
    MAX_UPLOAD_SIZE: 7 * 1024 * 1024, // 7MB
    LOG_LEVEL: 'INFO',
    TEMP_FOLDER_PREFIX: 'shadowrecon_',
    ZIP_COMPRESSION_LEVEL: 6
};

// File Extensions and Types
const FILE_TYPES = {
    SQLITE: '.sqlite',
    DB: '.db',
    JSON: '.json',
    LOG: '.log',
    ZIP: '.zip'
};

// Browser Data Types
const BROWSER_DATA_TYPES = {
    PASSWORDS: 'passwords',
    COOKIES: 'cookies',
    HISTORY: 'history',
    BOOKMARKS: 'bookmarks',
    AUTOFILLS: 'autofills',
    CARDS: 'cards',
    DOWNLOADS: 'downloads'
};

// Discord Client Types
const DISCORD_CLIENTS = {
    DISCORD: 'Discord',
    DISCORD_CANARY: 'Discord Canary',
    DISCORD_PTB: 'Discord PTB',
    DISCORD_DEVELOPMENT: 'Discord Development'
};

// Security Settings
const SECURITY = {
    ENCRYPTION_ALGORITHM: 'aes-256-cbc',
    TOKEN_VALIDATION_REGEX: /^[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}$/,
    MFA_TOKEN_REGEX: /^mfa\.[A-Za-z\d_-]{20,}$/,
    VM_DETECTION_INDICATORS: [
        'VMware',
        'VirtualBox',
        'QEMU',
        'Hyper-V',
        'Parallels'
    ]
};

// Error Codes
const ERROR_CODES = {
    CONFIG_INVALID: 'CONFIG_INVALID',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    NETWORK_ERROR: 'NETWORK_ERROR',
    DECRYPTION_FAILED: 'DECRYPTION_FAILED',
    WEBHOOK_FAILED: 'WEBHOOK_FAILED',
    MODULE_ERROR: 'MODULE_ERROR',
    SECURITY_ERROR: 'SECURITY_ERROR'
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
};

// Log Levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

module.exports = {
    APP_INFO,
    DEFAULTS,
    FILE_TYPES,
    BROWSER_DATA_TYPES,
    DISCORD_CLIENTS,
    SECURITY,
    ERROR_CODES,
    HTTP_STATUS,
    LOG_LEVELS
};