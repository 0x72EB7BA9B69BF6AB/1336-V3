/**
 * ShadowRecon Main Module Exports
 * Entry point for all application modules and components
 */

// Configuration
const config = require('./config/config');

// Core utilities and systems
const core = require('./core');

// Feature modules
const modules = require('./modules');

// External services
const services = require('./services');

// Main application
const { Application, main } = require('./main');

module.exports = {
    // Configuration
    config,
    
    // Core systems
    core,
    
    // Modules
    modules,
    
    // Services
    services,
    
    // Main application
    Application,
    main
};