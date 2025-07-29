const { ServiceManager } = require('../../src/core/serviceManager');

describe('ServiceManager', () => {
    let serviceManager;

    beforeEach(() => {
        serviceManager = new ServiceManager();
    });

    afterEach(async () => {
        if (serviceManager.initialized) {
            await serviceManager.cleanup();
        }
    });

    describe('Registration and Dependency Injection', () => {
        test('should register services without dependencies', () => {
            const mockService = { name: 'test' };
            serviceManager.register('test', () => mockService, []);

            expect(serviceManager.dependencies.has('test')).toBe(true);
        });

        test('should register services with dependencies', () => {
            serviceManager.register('serviceA', () => ({ name: 'A' }), []);
            serviceManager.register('serviceB', () => ({ name: 'B' }), ['serviceA']);

            expect(serviceManager.dependencies.has('serviceB')).toBe(true);
            expect(serviceManager.dependencies.get('serviceB').deps).toContain('serviceA');
        });

        test('should initialize services in dependency order', async () => {
            const initOrder = [];

            serviceManager.register(
                'serviceA',
                () => {
                    initOrder.push('A');
                    return { name: 'A' };
                },
                []
            );

            serviceManager.register(
                'serviceB',
                () => {
                    initOrder.push('B');
                    return { name: 'B' };
                },
                ['serviceA']
            );

            await serviceManager.initialize();

            expect(initOrder).toEqual(['A', 'B']);
            expect(serviceManager.initialized).toBe(true);
        });
    });

    describe('Service Access', () => {
        beforeEach(async () => {
            serviceManager.register('testService', () => ({ name: 'test', value: 42 }), []);
            await serviceManager.initialize();
        });

        test('should retrieve registered services', () => {
            const service = serviceManager.getService('testService');
            expect(service.name).toBe('test');
            expect(service.value).toBe(42);
        });

        test('should throw error for non-existent services', () => {
            expect(() => {
                serviceManager.getService('nonExistent');
            }).toThrow("Service 'nonExistent' not found");
        });

        test('should safely return null for missing services', () => {
            const service = serviceManager.getServiceSafely('nonExistent');
            expect(service).toBeNull();
        });

        test('should check service availability', () => {
            expect(serviceManager.hasService('testService')).toBe(true);
            expect(serviceManager.hasService('nonExistent')).toBe(false);
        });

        test('should list available services', () => {
            const services = serviceManager.getAvailableServices();
            expect(services).toContain('testService');
        });
    });

    describe('Health Checking', () => {
        test('should check service health', async () => {
            const healthyService = {
                name: 'healthy',
                healthCheck: async () => 'healthy'
            };

            serviceManager.register('healthyService', () => healthyService, []);
            await serviceManager.initialize();

            const health = await serviceManager.checkHealth();
            expect(health.overall).toBe('healthy');
            expect(health.services.healthyService).toBe('healthy');
        });

        test('should detect unhealthy services', async () => {
            const unhealthyService = {
                name: 'unhealthy',
                healthCheck: async () => {
                    throw new Error('Service down');
                }
            };

            serviceManager.register('unhealthyService', () => unhealthyService, []);
            await serviceManager.initialize();

            const health = await serviceManager.checkHealth();
            expect(health.overall).toBe('degraded');
            expect(health.services.unhealthyService).toContain('unhealthy');
        });
    });

    describe('Service Lifecycle', () => {
        test('should cleanup services', async () => {
            const cleanupMock = jest.fn();
            const service = {
                name: 'test',
                cleanup: cleanupMock
            };

            serviceManager.register('testService', () => service, []);
            await serviceManager.initialize();
            await serviceManager.cleanup();

            expect(cleanupMock).toHaveBeenCalled();
            expect(serviceManager.initialized).toBe(false);
        });

        test('should restart individual services', async () => {
            const initMock = jest.fn();
            const cleanupMock = jest.fn();

            serviceManager.register(
                'restartableService',
                () => ({
                    name: 'restartable',
                    initialize: initMock,
                    cleanup: cleanupMock
                }),
                []
            );

            await serviceManager.initialize();
            expect(initMock).toHaveBeenCalledTimes(1);

            await serviceManager.restartService('restartableService');

            expect(cleanupMock).toHaveBeenCalledTimes(1);
            expect(initMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        test('should throw error when accessing services before initialization', () => {
            expect(() => {
                serviceManager.getService('anyService');
            }).toThrow('Service manager not initialized');
        });

        test('should handle initialization errors gracefully', async () => {
            serviceManager.register(
                'failingService',
                () => {
                    throw new Error('Init failed');
                },
                []
            );

            await expect(serviceManager.initialize()).rejects.toThrow('Init failed');
        });
    });
});
