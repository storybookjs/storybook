# Vite Plugin for Virtual Stories

This Vite plugin enables the transformation of virtual story imports into actual story content, allowing Storybook to display components that don't have explicit story files.

## Overview

The plugin intercepts virtual imports with the format `virtual:virtual-stories--${relativePath}--${componentName}` and transforms them into proper story content using the same logic as the `getNewStoryFile` function.

## Usage

### Basic Setup

```typescript
import { virtualStoriesPlugin } from '@storybook/core-server/utils/vite-plugin-virtual-stories';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    virtualStoriesPlugin({
      storybookOptions: {
        configDir: '.storybook',
        framework: { name: '@storybook/react-vite', options: {} },
      },
    }),
  ],
});
```

### Integration with Storybook

The plugin is designed to work with the Ghost Stories indexer system. When a component file is indexed and a virtual story is created, the plugin will:

1. Parse the virtual import path to extract the component file path and component name
2. Read and parse the component file to determine export information
3. Generate appropriate story content using the same templates as `getNewStoryFile`
4. Return the generated story content as a module

### Virtual Import Format

Virtual imports follow this pattern:
```
virtual:virtual-stories--${relativePath}--${componentName}
```

Examples:
- `virtual:virtual-stories--src/Button.tsx--Button`
- `virtual:virtual-stories--src/components/MyComponent.tsx--MyComponent`
- `virtual:virtual-stories--src/utils/helper.ts--HelperFunction`

### Supported Story Formats

The plugin supports all the same story formats as the regular `getNewStoryFile` function:

- **TypeScript Stories**: Uses `getTypeScriptTemplateForNewStoryFile`
- **JavaScript Stories**: Uses `getJavaScriptTemplateForNewStoryFile`
- **CSF Factory Stories**: Uses `getCsfFactoryTemplateForNewStoryFile` when enabled

### Component Export Detection

The plugin automatically detects whether a component is exported as:
- **Default export**: `export default Component`
- **Named export**: `export { Component }`

This information is used to generate the correct import statement in the story file.

### Error Handling

The plugin includes robust error handling:
- Invalid import formats are ignored
- Missing component files are handled gracefully
- Parsing errors fall back to safe defaults
- All errors are logged for debugging

## Configuration Options

```typescript
interface VirtualStoriesPluginOptions {
  /** Storybook options for framework detection and configuration */
  storybookOptions: Options;
}
```

The `storybookOptions` should match your Storybook configuration to ensure proper framework detection and template generation.

## Examples

### Generated TypeScript Story

For a component file `src/Button.tsx` with a default export:

```typescript
// Input: virtual:virtual-stories--src/Button.tsx--Button
// Output:
import type { Meta, StoryObj } from '@storybook/react';

import Button from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

### Generated JavaScript Story

For a component file `src/Input.jsx` with a named export:

```typescript
// Input: virtual:virtual-stories--src/Input.jsx--Input
// Output:
import { Input } from './Input';

const meta = {
  component: Input,
};

export default meta;

export const Default = {};
```

## Testing

The plugin includes comprehensive tests covering:
- Virtual import parsing
- Component file reading and parsing
- Template generation for different formats
- Error handling scenarios
- Export type detection

Run tests with:
```bash
yarn test vite-plugin-virtual-stories
```

## Integration with Ghost Stories Indexer

This plugin works in conjunction with the Ghost Stories indexer system:

1. The indexer creates virtual story entries for components without existing stories
2. The plugin transforms these virtual imports into actual story content
3. Storybook can then display and interact with these virtual stories

The virtual stories appear in Storybook with the `virtual` tag and can be filtered or managed like regular stories.
