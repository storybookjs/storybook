import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

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
        renderer: SupportedRenderer.REACT,
      },
      configure: vi.fn(),
    };
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a generator for a project type', () => {
      registry.register(mockGeneratorModule);

      expect(registry.get(ProjectType.REACT)).toBe(mockGeneratorModule);
    });

    it('should warn when overwriting an existing generator', () => {
      const newGeneratorModule: GeneratorModule = {
        metadata: {
          projectType: ProjectType.REACT,
          renderer: SupportedRenderer.REACT,
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
      expect(registry.get(ProjectType.REACT)).toBe(newGeneratorModule);
    });
  });

  describe('get', () => {
    it('should return generator for registered project type', () => {
      registry.register(mockGeneratorModule);

      expect(registry.get(ProjectType.REACT)).toBe(mockGeneratorModule);
    });

    it('should return undefined for unregistered project type', () => {
      expect(registry.get(ProjectType.VUE3)).toBeUndefined();
    });
  });
});
