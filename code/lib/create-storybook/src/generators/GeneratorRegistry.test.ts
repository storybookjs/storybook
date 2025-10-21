import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';

import { GeneratorRegistry } from './GeneratorRegistry';
import type { GeneratorModule } from './types';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('GeneratorRegistry', () => {
  let registry: GeneratorRegistry;
  let mockGeneratorModule: GeneratorModule;

  beforeEach(() => {
    registry = new GeneratorRegistry();
    mockGeneratorModule = {
      metadata: {
        projectType: ProjectType.REACT,
        renderer: 'react',
      },
      configure: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a generator for a project type', () => {
      registry.register(mockGeneratorModule);

      expect(registry.has(ProjectType.REACT)).toBe(true);
      expect(registry.get(ProjectType.REACT)).toBe(mockGeneratorModule.configure);
    });

    it('should register multiple generators', () => {
      const vueGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
        },
        configure: vi.fn(),
      };

      registry.register(mockGeneratorModule);
      registry.register(vueGeneratorModule);

      expect(registry.has(ProjectType.REACT)).toBe(true);
      expect(registry.has(ProjectType.VUE3)).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should warn when overwriting an existing generator', () => {
      const newGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT,
          renderer: 'react',
        },
        configure: vi.fn(),
      };

      // Mock logger.warn to prevent throwing in vitest-setup
      vi.mocked(logger.warn).mockImplementation(() => {});

      registry.register(mockGeneratorModule);
      registry.register(newGeneratorModule);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already registered. Overwriting')
      );
      expect(registry.get(ProjectType.REACT)).toBe(newGeneratorModule.configure);
    });

    it('should store metadata with generator', () => {
      const customGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT,
          renderer: 'react',
        },
        configure: vi.fn(),
      };

      registry.register(customGeneratorModule);

      expect(registry.getMetadata(ProjectType.REACT)).toEqual(customGeneratorModule.metadata);
    });
  });

  describe('get', () => {
    it('should return generator for registered project type', () => {
      registry.register(mockGeneratorModule);

      expect(registry.get(ProjectType.REACT)).toBe(mockGeneratorModule.configure);
    });

    it('should return undefined for unregistered project type', () => {
      expect(registry.get(ProjectType.VUE3)).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered project type', () => {
      registry.register(mockGeneratorModule);

      expect(registry.has(ProjectType.REACT)).toBe(true);
    });

    it('should return false for unregistered project type', () => {
      expect(registry.has(ProjectType.VUE3)).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered project type', () => {
      const angularGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.ANGULAR,
          renderer: 'angular',
        },
        configure: vi.fn(),
      };

      registry.register(angularGeneratorModule);

      expect(registry.getMetadata(ProjectType.ANGULAR)).toEqual(angularGeneratorModule.metadata);
    });

    it('should return undefined for unregistered project type', () => {
      expect(registry.getMetadata(ProjectType.VUE3)).toBeUndefined();
    });
  });

  describe('getRegisteredProjectTypes', () => {
    it('should return empty array when no generators registered', () => {
      expect(registry.getRegisteredProjectTypes()).toEqual([]);
    });

    it('should return all registered project types', () => {
      const vueGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
        },
        configure: vi.fn(),
      };
      const angularGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.ANGULAR,
          renderer: 'angular',
        },
        configure: vi.fn(),
      };

      registry.register(mockGeneratorModule);
      registry.register(vueGeneratorModule);
      registry.register(angularGeneratorModule);

      const types = registry.getRegisteredProjectTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain(ProjectType.REACT);
      expect(types).toContain(ProjectType.VUE3);
      expect(types).toContain(ProjectType.ANGULAR);
    });
  });

  describe('getAllGenerators', () => {
    it('should return empty map when no generators registered', () => {
      const generators = registry.getAllGenerators();

      expect(generators.size).toBe(0);
    });

    it('should return all generators as a map', () => {
      const vueGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
        },
        configure: vi.fn(),
      };

      registry.register(mockGeneratorModule);
      registry.register(vueGeneratorModule);

      const generators = registry.getAllGenerators();

      expect(generators.size).toBe(2);
      expect(generators.get(ProjectType.REACT)).toBe(mockGeneratorModule.configure);
      expect(generators.get(ProjectType.VUE3)).toBe(vueGeneratorModule.configure);
    });
  });

  describe('clear', () => {
    it('should remove all registered generators', () => {
      const vueGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
        },
        configure: vi.fn(),
      };

      registry.register(mockGeneratorModule);
      registry.register(vueGeneratorModule);

      expect(registry.size()).toBe(2);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.has(ProjectType.REACT)).toBe(false);
      expect(registry.has(ProjectType.VUE3)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count of registered generators', () => {
      const vueGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.VUE3,
          renderer: 'vue3',
        },
        configure: vi.fn(),
      };
      const angularGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.ANGULAR,
          renderer: 'angular',
        },
        configure: vi.fn(),
      };

      registry.register(mockGeneratorModule);
      expect(registry.size()).toBe(1);

      registry.register(vueGeneratorModule);
      expect(registry.size()).toBe(2);

      registry.register(angularGeneratorModule);
      expect(registry.size()).toBe(3);
    });
  });
});
