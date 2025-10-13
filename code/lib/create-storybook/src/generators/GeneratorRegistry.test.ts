import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';

import { GeneratorRegistry } from './GeneratorRegistry';
import type { Generator } from './types';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('GeneratorRegistry', () => {
  let registry: GeneratorRegistry;
  let mockGenerator: Generator;

  beforeEach(() => {
    registry = new GeneratorRegistry();
    mockGenerator = vi.fn();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a generator for a project type', () => {
      registry.register({ projectType: ProjectType.REACT }, mockGenerator);

      expect(registry.has(ProjectType.REACT)).toBe(true);
      expect(registry.get(ProjectType.REACT)).toBe(mockGenerator);
    });

    it('should register multiple generators', () => {
      const vueGenerator = vi.fn();

      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      registry.register({ projectType: ProjectType.VUE3 }, vueGenerator);

      expect(registry.has(ProjectType.REACT)).toBe(true);
      expect(registry.has(ProjectType.VUE3)).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should warn when overwriting an existing generator', () => {
      const newGenerator = vi.fn();

      // Mock logger.warn to prevent throwing in vitest-setup
      vi.mocked(logger.warn).mockImplementation(() => {});

      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      registry.register({ projectType: ProjectType.REACT }, newGenerator);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already registered. Overwriting')
      );
      expect(registry.get(ProjectType.REACT)).toBe(newGenerator);
    });

    it('should store metadata with generator', () => {
      const metadata = {
        projectType: ProjectType.REACT,
        supportedFeatures: ['docs', 'test', 'onboarding'],
      };

      registry.register(metadata, mockGenerator);

      expect(registry.getMetadata(ProjectType.REACT)).toEqual(metadata);
    });
  });

  describe('get', () => {
    it('should return generator for registered project type', () => {
      registry.register({ projectType: ProjectType.REACT }, mockGenerator);

      expect(registry.get(ProjectType.REACT)).toBe(mockGenerator);
    });

    it('should return undefined for unregistered project type', () => {
      expect(registry.get(ProjectType.VUE3)).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered project type', () => {
      registry.register({ projectType: ProjectType.REACT }, mockGenerator);

      expect(registry.has(ProjectType.REACT)).toBe(true);
    });

    it('should return false for unregistered project type', () => {
      expect(registry.has(ProjectType.VUE3)).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered project type', () => {
      const metadata = {
        projectType: ProjectType.ANGULAR,
        supportedFeatures: ['docs', 'onboarding'],
      };

      registry.register(metadata, mockGenerator);

      expect(registry.getMetadata(ProjectType.ANGULAR)).toEqual(metadata);
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
      const vueGenerator = vi.fn();
      const angularGenerator = vi.fn();

      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      registry.register({ projectType: ProjectType.VUE3 }, vueGenerator);
      registry.register({ projectType: ProjectType.ANGULAR }, angularGenerator);

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
      const vueGenerator = vi.fn();

      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      registry.register({ projectType: ProjectType.VUE3 }, vueGenerator);

      const generators = registry.getAllGenerators();

      expect(generators.size).toBe(2);
      expect(generators.get(ProjectType.REACT)).toBe(mockGenerator);
      expect(generators.get(ProjectType.VUE3)).toBe(vueGenerator);
    });
  });

  describe('clear', () => {
    it('should remove all registered generators', () => {
      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      registry.register({ projectType: ProjectType.VUE3 }, vi.fn());

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
      registry.register({ projectType: ProjectType.REACT }, mockGenerator);
      expect(registry.size()).toBe(1);

      registry.register({ projectType: ProjectType.VUE3 }, vi.fn());
      expect(registry.size()).toBe(2);

      registry.register({ projectType: ProjectType.ANGULAR }, vi.fn());
      expect(registry.size()).toBe(3);
    });
  });
});
