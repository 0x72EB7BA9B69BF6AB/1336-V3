const CoreUtils = require('../../src/core/utils');
const fs = require('fs');
const path = require('path');

describe('CoreUtils', () => {
    describe('generateId', () => {
        test('should generate ID of specified length', () => {
            const id = CoreUtils.generateId(10);
            expect(id).toHaveLength(10);
        });

        test('should generate unique IDs', () => {
            const id1 = CoreUtils.generateId(10);
            const id2 = CoreUtils.generateId(10);
            expect(id1).not.toBe(id2);
        });
    });

    describe('generatePassword', () => {
        test('should generate password of specified length', () => {
            const password = CoreUtils.generatePassword(16);
            expect(password).toHaveLength(16);
        });

        test('should generate different passwords', () => {
            const pass1 = CoreUtils.generatePassword(16);
            const pass2 = CoreUtils.generatePassword(16);
            expect(pass1).not.toBe(pass2);
        });
    });

    describe('getFileName', () => {
        test('should extract filename from Windows path', () => {
            const filename = CoreUtils.getFileName('C:\\Users\\test\\file.txt');
            expect(filename).toBe('file.txt');
        });

        test('should extract filename from Unix path', () => {
            const filename = CoreUtils.getFileName('/home/user/file.txt');
            expect(filename).toBe('file.txt');
        });
    });

    describe('generateHash', () => {
        test('should generate consistent hash for same input', () => {
            const data = 'test data';
            const hash1 = CoreUtils.generateHash(data);
            const hash2 = CoreUtils.generateHash(data);
            expect(hash1).toBe(hash2);
        });

        test('should generate different hashes for different inputs', () => {
            const hash1 = CoreUtils.generateHash('data1');
            const hash2 = CoreUtils.generateHash('data2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('sleep', () => {
        test('should delay execution', async () => {
            const start = Date.now();
            await CoreUtils.sleep(100);
            const duration = Date.now() - start;
            expect(duration).toBeGreaterThanOrEqual(90);
        });
    });

    describe('fileExists', () => {
        test('should return true for existing file', async () => {
            const exists = await CoreUtils.fileExists(__filename);
            expect(exists).toBe(true);
        });

        test('should return false for non-existing file', async () => {
            const exists = await CoreUtils.fileExists('/non/existent/file.txt');
            expect(exists).toBe(false);
        });
    });

    describe('batchProcess', () => {
        test('should process items with concurrency limit', async () => {
            const items = [1, 2, 3, 4, 5];
            const processor = async (item) => item * 2;
            
            const results = await CoreUtils.batchProcess(items, processor, 2);
            
            expect(results).toHaveLength(5);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.result).toBe(items[index] * 2);
            });
        });
    });

    describe('retry', () => {
        test('should succeed on first try', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await CoreUtils.retry(fn, 3);
            
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue('success');
                
            const result = await CoreUtils.retry(fn, 3, 10);
            
            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });
});