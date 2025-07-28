/**
 * Webhook Management Utility
 * Command-line tool for managing encrypted webhooks
 */

const { encryptionUtils } = require('./src/core/encryption');
const fs = require('fs');
const path = require('path');

function showUsage() {
    console.log('Webhook Management Utility');
    console.log('Usage:');
    console.log('  node webhook-util.js encrypt <webhook_url>    - Encrypt a webhook URL');
    console.log('  node webhook-util.js decrypt <encrypted_data> - Decrypt an encrypted webhook');
    console.log('  node webhook-util.js show-config              - Show decrypted webhook from config.json');
    console.log('  node webhook-util.js encrypt-config           - Encrypt webhook in config.json');
    console.log('');
    console.log('Examples:');
    console.log('  node webhook-util.js encrypt "https://discord.com/api/webhooks/123/abc"');
    console.log('  node webhook-util.js decrypt "base64encodeddata..."');
    console.log('  node webhook-util.js show-config');
}

function encryptWebhook(url) {
    console.log('Encrypting webhook URL...');
    console.log('Original:', url);
    
    const encrypted = encryptionUtils.encryptWebhook(url);
    console.log('Encrypted:', encrypted);
    
    // Verify by decrypting
    const decrypted = encryptionUtils.decryptWebhook(encrypted);
    console.log('Verification (decrypted):', decrypted);
    console.log('Match:', url === decrypted);
}

function decryptWebhook(encryptedData) {
    console.log('Decrypting webhook data...');
    console.log('Encrypted:', encryptedData);
    
    const decrypted = encryptionUtils.decryptWebhook(encryptedData);
    console.log('Decrypted:', decrypted);
    
    if (encryptionUtils.isEncrypted(encryptedData)) {
        console.log('Data was properly encrypted');
    } else {
        console.log('Data was not encrypted or invalid format');
    }
}

function showConfig() {
    try {
        const configPath = './config.json';
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log('Configuration webhook information:');
        console.log('Raw value:', configData.webhook.url);
        console.log('Is encrypted:', encryptionUtils.isEncrypted(configData.webhook.url));
        console.log('Decrypted:', encryptionUtils.decryptWebhook(configData.webhook.url));
    } catch (error) {
        console.error('Error reading config:', error.message);
    }
}

function encryptConfig() {
    try {
        const configPath = './config.json';
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log('Current webhook:', configData.webhook.url);
        
        if (encryptionUtils.isEncrypted(configData.webhook.url)) {
            console.log('Webhook is already encrypted');
            return;
        }
        
        configData.webhook.url = encryptionUtils.encryptWebhook(configData.webhook.url);
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        
        console.log('Webhook encrypted and config updated');
        console.log('Encrypted webhook:', configData.webhook.url);
    } catch (error) {
        console.error('Error updating config:', error.message);
    }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
    showUsage();
    process.exit(1);
}

const command = args[0];

switch (command) {
    case 'encrypt':
        if (args.length !== 2) {
            console.error('Error: encrypt command requires a webhook URL');
            console.log('Usage: node webhook-util.js encrypt <webhook_url>');
            process.exit(1);
        }
        encryptWebhook(args[1]);
        break;
        
    case 'decrypt':
        if (args.length !== 2) {
            console.error('Error: decrypt command requires encrypted data');
            console.log('Usage: node webhook-util.js decrypt <encrypted_data>');
            process.exit(1);
        }
        decryptWebhook(args[1]);
        break;
        
    case 'show-config':
        showConfig();
        break;
        
    case 'encrypt-config':
        encryptConfig();
        break;
        
    default:
        console.error(`Error: Unknown command '${command}'`);
        showUsage();
        process.exit(1);
}