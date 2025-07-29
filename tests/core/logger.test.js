const { logger } = require('../../src/core/logger');

describe('Logger', () => {
    let consoleSpy;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    test('should log info messages', () => {
        logger.info('Test message');
        expect(consoleSpy).toHaveBeenCalled();
    });

    test('should log error messages', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        logger.error('Error message');
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    test('should format messages with objects', () => {
        const testObject = { key: 'value' };
        logger.info('Test message', testObject);
        expect(consoleSpy).toHaveBeenCalled();
    });

    test('should respect log levels', () => {
        // Debug messages should not appear by default (INFO level)
        logger.debug('Debug message');
        expect(consoleSpy).not.toHaveBeenCalled();
    });
});
