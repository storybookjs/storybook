# Ghost Stories Integration Example

This document shows how to integrate Ghost Stories into your Storybook configuration.

## Basic Integration

### 1. In your `.storybook/main.ts` file:

```typescript
import { configureGhostStories } from '@storybook/core/ghost-stories';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    // Your existing story patterns
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    // Your existing addons
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Enable Ghost Stories
  experimental_indexers: async (existingIndexers) => {
    const { createGhostStoriesIndexer } = await import('@storybook/core/ghost-stories');

    const ghostIndexer = createGhostStoriesIndexer({
      enabled: true,
      titlePrefix: 'V:',
      includePatterns: ['../src/components/**/*.{tsx,jsx}'],
      excludePatterns: ['../src/**/*.stories.*', '../src/**/*.test.*'],
    });

    return [ghostIndexer, ...existingIndexers];
  },
};

export default config;
```

### 2. For Vite-based frameworks, add the plugin to your Vite config:

```typescript
// In your framework configuration or main.ts
import { ghostStoriesPlugin } from '@storybook/core/ghost-stories';

// Add to your Vite config
viteFinal: async (config) => {
  config.plugins = config.plugins || [];
  config.plugins.push(ghostStoriesPlugin({ workingDir: process.cwd() }));
  return config;
},
```

## Advanced Configuration

### Custom Prop Type Mapping

```typescript
const ghostIndexer = createGhostStoriesIndexer({
  enabled: true,
  titlePrefix: 'V:',
  includePatterns: ['../src/components/**/*.{tsx,jsx}'],
  propTypeMapping: {
    CustomType: {
      name: 'CustomType',
      category: 'object',
      value: { customField: 'default' },
    },
    Theme: {
      name: 'Theme',
      category: 'union',
      options: ['light', 'dark'],
    },
  },
});
```

### Framework-Specific Integration

#### React with Vite

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    const { ghostStoriesPlugin } = await import('@storybook/core/ghost-stories');
    config.plugins?.push(ghostStoriesPlugin());
    return config;
  },
  experimental_indexers: async (existingIndexers) => {
    const { createGhostStoriesIndexer } = await import('@storybook/core/ghost-stories');
    return [
      createGhostStoriesIndexer({
        enabled: true,
        titlePrefix: 'V:',
        includePatterns: ['../src/components/**/*.{tsx,jsx}'],
      }),
      ...existingIndexers,
    ];
  },
};

export default config;
```

#### Vue with Vite

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  viteFinal: async (config) => {
    const { ghostStoriesPlugin } = await import('@storybook/core/ghost-stories');
    config.plugins?.push(ghostStoriesPlugin());
    return config;
  },
  experimental_indexers: async (existingIndexers) => {
    const { createGhostStoriesIndexer } = await import('@storybook/core/ghost-stories');
    return [
      createGhostStoriesIndexer({
        enabled: true,
        titlePrefix: 'V:',
        includePatterns: ['../src/components/**/*.vue'],
      }),
      ...existingIndexers,
    ];
  },
};

export default config;
```

## Usage

Once configured, Ghost Stories will automatically:

1. **Detect component files** in your specified directories
2. **Analyze component props** using TypeScript interfaces and type definitions
3. **Generate virtual stories** with prefixed titles (e.g., "V:Button")
4. **Create fake default values** for each prop type
5. **Enable controls** for all detected props
6. **Allow saving** via the existing save-from-controls feature

## Features

- **Automatic component detection** from TypeScript/JavaScript files
- **Prop analysis** with support for interfaces, types, and union types
- **Fake value generation** for different prop types
- **Virtual CSF generation** on-demand
- **Hot module replacement** when component files change
- **Integration with save-from-controls** for creating real stories

## Limitations

- Currently optimized for React components
- Basic TypeScript analysis (could be enhanced with TypeScript compiler API)
- Limited Vue/Svelte support (would need framework-specific analyzers)
- Requires Vite builder for virtual module support
