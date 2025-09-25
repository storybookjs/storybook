import type { StorybookConfig } from 'storybook/internal/types';

import { createGhostStoriesIndexer } from './ghost-stories-indexer';
import type { GhostStoriesConfig } from './types';

/** Default Ghost Stories configuration */
export const DEFAULT_GHOST_STORIES_CONFIG: GhostStoriesConfig = {
  enabled: true,
  titlePrefix: 'V:',
  includePatterns: ['**/*.{tsx,jsx,ts,js}'],
  excludePatterns: [
    '**/*.stories.*',
    '**/*.test.*',
    '**/*.spec.*',
    '**/node_modules/**',
    '**/.storybook/**',
  ],
  propTypeMapping: {},
};

/** Configure Storybook to use Ghost Stories This function should be called in the main.ts file */
export function configureGhostStories(
  config: StorybookConfig,
  ghostConfig: Partial<GhostStoriesConfig> = {}
): StorybookConfig {
  const finalConfig = { ...DEFAULT_GHOST_STORIES_CONFIG, ...ghostConfig };

  if (!finalConfig.enabled) {
    return config;
  }

  // Add the Ghost Stories indexer to experimental_indexers
  const originalIndexers = config.experimental_indexers || (() => []);

  config.experimental_indexers = async (existingIndexers) => {
    const indexers = await originalIndexers(existingIndexers);

    // Add our Ghost Stories indexer
    const ghostIndexer = createGhostStoriesIndexer(finalConfig);
    indexers.unshift(ghostIndexer); // Add at the beginning to prioritize

    return indexers;
  };

  // Add stories configuration for component files if not already present
  if (!config.stories) {
    config.stories = [];
  }

  // Add component file patterns to stories if they don't exist
  const hasComponentPatterns = config.stories.some((entry) => {
    if (typeof entry === 'string') {
      return entry.includes('**/*.{tsx,jsx,ts,js}') && !entry.includes('.stories.');
    }
    return false;
  });

  if (!hasComponentPatterns) {
    config.stories.push({
      directory: '.',
      files: '**/*.{tsx,jsx,ts,js}',
      titlePrefix: '',
    });
  }

  return config;
}

/** Helper function to create a minimal Ghost Stories setup */
export function createGhostStoriesSetup(ghostConfig?: Partial<GhostStoriesConfig>) {
  return {
    configureGhostStories: (config: StorybookConfig) => configureGhostStories(config, ghostConfig),
  };
}

/** Validate Ghost Stories configuration */
export function validateGhostStoriesConfig(config: GhostStoriesConfig): string[] {
  const errors: string[] = [];

  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (typeof config.titlePrefix !== 'string') {
    errors.push('titlePrefix must be a string');
  }

  if (!Array.isArray(config.includePatterns)) {
    errors.push('includePatterns must be an array');
  }

  if (!Array.isArray(config.excludePatterns)) {
    errors.push('excludePatterns must be an array');
  }

  if (typeof config.propTypeMapping !== 'object' || config.propTypeMapping === null) {
    errors.push('propTypeMapping must be an object');
  }

  return errors;
}
