import type { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';

import type { GeneratorModule } from './types';

/**
 * Registry for managing Storybook project generators
 *
 * All new generators should use the GeneratorModule format with metadata + configure. Legacy
 * generators (not yet refactored) can still be registered with LegacyGeneratorMetadata.
 */
export class GeneratorRegistry {
  private generators: Map<ProjectType, GeneratorModule> = new Map();

  /** Register a generator for a specific project type */
  register(generator: GeneratorModule): void {
    const { metadata } = generator;
    if (this.generators.has(metadata.projectType)) {
      logger.warn(
        `Generator for project type ${metadata.projectType} is already registered. Overwriting.`
      );
    }

    this.generators.set(metadata.projectType, generator);
  }

  /** Get a generator for a specific project type */
  get(projectType: ProjectType): GeneratorModule | undefined {
    return this.generators.get(projectType);
  }
}

// Create and export a singleton instance
export const generatorRegistry = new GeneratorRegistry();
