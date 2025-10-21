import type { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';

import type { GeneratorMetadata, GeneratorModule } from './types';

interface GeneratorEntry {
  generator: GeneratorModule | any;
  metadata: GeneratorMetadata;
}

/**
 * Registry for managing Storybook project generators
 *
 * All new generators should use the GeneratorModule format with metadata + configure. Legacy
 * generators (not yet refactored) can still be registered with LegacyGeneratorMetadata.
 */
export class GeneratorRegistry {
  private generators: Map<ProjectType, GeneratorEntry> = new Map();

  /** Register a generator for a specific project type */
  register({ metadata, configure }: GeneratorModule): void {
    if (this.generators.has(metadata.projectType)) {
      logger.warn(
        `Generator for project type ${metadata.projectType} is already registered. Overwriting.`
      );
    }

    this.generators.set(metadata.projectType, {
      generator: configure,
      metadata,
    });
  }

  /** Get a generator for a specific project type */
  get(projectType: ProjectType): GeneratorModule | any | undefined {
    return this.generators.get(projectType)?.generator;
  }

  /** Check if a generator is registered for a specific project type */
  has(projectType: ProjectType): boolean {
    return this.generators.has(projectType);
  }

  /** Get metadata for a specific project type */
  getMetadata(projectType: ProjectType): GeneratorMetadata | undefined {
    return this.generators.get(projectType)?.metadata;
  }

  /** Get all registered project types */
  getRegisteredProjectTypes(): ProjectType[] {
    return Array.from(this.generators.keys());
  }

  /** Get all generators as a map */
  getAllGenerators(): Map<ProjectType, GeneratorModule | any> {
    const map = new Map<ProjectType, GeneratorModule | any>();
    this.generators.forEach((entry, projectType) => {
      map.set(projectType, entry.generator);
    });
    return map;
  }

  /** Clear all registered generators */
  clear(): void {
    this.generators.clear();
  }

  /** Get the number of registered generators */
  size(): number {
    return this.generators.size;
  }
}

// Create and export a singleton instance
export const generatorRegistry = new GeneratorRegistry();

// Re-export types for convenience
export type { GeneratorMetadata, GeneratorModule };
