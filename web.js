#!/usr/bin/env node

/**
 * @fileoverview Web Interface Launcher
 * @description Standalone launcher for the web interface
 * @version 3.0.0
 * @author ShadowRecon Team
 * @license MIT
 */

const { logger } = require('./src/core/logger');
const { WebService } = require('./src/services/web/service');

/**
 * Launch the web interface
 */
async function launchWebInterface() {
    let webService = null;
    
    try {
        logger.info('Starting ShadowRecon Web Interface');
        
        webService = new WebService();
        await webService.initialize();
        await webService.start();
        
        logger.info(`Web interface is running at: ${webService.getUrl()}`);
        logger.info('Press Ctrl+C to stop the server');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down web interface...');
            
            if (webService) {
                await webService.stop();
            }
            
            logger.info('Web interface stopped');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Shutting down web interface...');
            
            if (webService) {
                await webService.stop();
            }
            
            logger.info('Web interface stopped');
            process.exit(0);
        });
        
        // Keep the process alive
        process.stdin.resume();
        
    } catch (error) {
        logger.error('Failed to start web interface', error.message);
        
        if (webService) {
            try {
                await webService.stop();
            } catch (stopError) {
                logger.error('Failed to stop web service during cleanup', stopError.message);
            }
        }
        
        process.exit(1);
    }
}

// Launch if this file is executed directly
if (require.main === module) {
    launchWebInterface().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { launchWebInterface };