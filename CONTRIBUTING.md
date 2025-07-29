# Contributing Guidelines

Thank you for your interest in contributing to ShadowRecon! This document provides guidelines and information for contributors.

## 🚨 Important Notice

This project is intended for **educational purposes** and **authorized security testing only**. All contributions must align with this purpose and follow ethical guidelines.

## 🛠️ Development Setup

### Prerequisites
- Node.js 14.0.0 or higher
- npm 6.0.0 or higher
- Git for version control

### Getting Started
```bash
# Clone the repository
git clone https://github.com/0x72EB7BA9B69BF6AB/ShadowRecon.git
cd ShadowRecon

# Install dependencies
npm install

# Run validation to ensure everything works
npm run validate
```

## 📋 Development Standards

### Code Quality
- **ESLint**: All code must pass ESLint checks (`npm run lint:check`)
- **Prettier**: Code must be formatted with Prettier (`npm run format:check`)
- **Tests**: All tests must pass (`npm test`)
- **Coverage**: Maintain high test coverage for new features

### Code Style
- Use clear, descriptive variable and function names
- Add JSDoc comments for all public functions and classes
- Follow existing patterns and architectural decisions
- Keep functions focused and modular

### Testing Requirements
- Write unit tests for new functionality
- Update existing tests when modifying functionality
- Ensure all tests pass before submitting PR
- Add integration tests for new modules or services

## 🔄 Contribution Workflow

### 1. Fork & Branch
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR-USERNAME/ShadowRecon.git

# Create a feature branch
git checkout -b feature/your-feature-name
```

### 2. Development
```bash
# Make your changes
# Run tests frequently
npm run test:watch

# Validate your changes
npm run validate
```

### 3. Commit Guidelines
```bash
# Use clear, descriptive commit messages
git commit -m "feat: add new browser detection module"
git commit -m "fix: resolve async race condition in token collection"
git commit -m "docs: update API documentation for service manager"
```

### Commit Message Format
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

### 4. Pull Request
- Ensure all tests pass
- Update documentation if needed
- Add detailed description of changes
- Reference any related issues

## 🏗️ Architecture Guidelines

### Module Structure
```
src/modules/your-module/
├── index.js          # Main module export
├── collector.js      # Data collection logic
├── validator.js      # Data validation
└── __tests__/        # Module tests
    └── collector.test.js
```

### Service Integration
- Use the service manager for dependency injection
- Implement proper error handling
- Add structured logging
- Follow async/await patterns

### Configuration
- Add new config options to `src/config/config.js`
- Provide sensible defaults
- Document configuration options
- Validate configuration values

## 🧪 Testing Guidelines

### Unit Tests
```javascript
// Example test structure
describe('ModuleName', () => {
    beforeEach(() => {
        // Setup code
    });

    afterEach(() => {
        // Cleanup code
    });

    describe('functionName', () => {
        test('should handle normal case', () => {
            // Test implementation
        });

        test('should handle error case', () => {
            // Error handling test
        });
    });
});
```

### Integration Tests
- Test module interactions
- Verify service dependencies
- Test configuration handling
- Validate error propagation

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for all public APIs
- Include parameter types and return types
- Provide usage examples
- Document error conditions

### README Updates
- Update module table when adding new modules
- Add configuration examples
- Update build instructions if needed
- Keep feature lists current

## 🔒 Security Considerations

### Ethical Guidelines
- All contributions must be for educational or authorized testing purposes
- Do not enhance malicious capabilities
- Focus on code quality, structure, and maintainability
- Respect privacy and security of test environments

### Code Security
- Avoid hardcoded credentials or sensitive data
- Use secure coding practices
- Validate all inputs
- Handle errors gracefully without exposing sensitive information

## 🚫 What Not to Contribute

### Prohibited Contributions
- Features that enhance malicious capabilities
- Bypasses for security measures in unauthorized contexts
- Code that facilitates illegal activities
- Modifications that reduce security or add vulnerabilities

### Code Quality Issues
- Code without tests
- Code that doesn't follow style guidelines
- Breaking changes without proper deprecation
- Features without documentation

## 📞 Getting Help

### Before Contributing
- Review existing issues and PRs
- Check if your feature is already planned
- Discuss major changes in an issue first
- Ask questions if anything is unclear

### Communication
- Create issues for bugs or feature requests
- Use clear, descriptive titles
- Provide detailed reproduction steps for bugs
- Include system information when relevant

## 📋 Checklist

Before submitting your PR, ensure:

- [ ] Code follows style guidelines (`npm run lint:check`)
- [ ] Code is properly formatted (`npm run format:check`)
- [ ] All tests pass (`npm test`)
- [ ] New functionality has tests
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] Changes are focused and cohesive
- [ ] No breaking changes without deprecation notice

## 🙏 Recognition

Contributors will be recognized in:
- Project contributors list
- Release notes for their contributions
- Special thanks for significant contributions

Thank you for helping make ShadowRecon better while maintaining ethical standards!