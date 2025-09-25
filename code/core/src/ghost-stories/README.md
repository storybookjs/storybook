# Ghost Stories

Ghost Stories is an experimental Storybook feature that automatically generates virtual stories for existing component files in your repository. It analyzes your components' TypeScript interfaces and props to create interactive stories with realistic default values, allowing you to experiment with components that don't have stories yet.

## Features

- **🔍 Automatic Component Detection**: Finds React components in your codebase
- **📝 Prop Analysis**: Analyzes TypeScript interfaces and prop types
- **🎭 Virtual Story Generation**: Creates stories on-demand with fake data
- **🎛️ Interactive Controls**: Provides controls for all detected props
- **💾 Save Integration**: Works with existing save-from-controls feature
- **⚡ Hot Reload**: Updates when component files change
- **🎨 Vite Integration**: Seamless integration with Vite-based Storybook setups

## How It Works

1. **Component Scanning**: Scans your repository for component files (`.tsx`, `.jsx`, etc.)
2. **Interface Analysis**: Analyzes TypeScript interfaces and prop definitions
3. **Virtual Story Creation**: Generates virtual CSF files with realistic default values
4. **Sidebar Integration**: Shows virtual stories with "V:" prefix in the sidebar
5. **Interactive Controls**: Provides controls for all detected props
6. **Save Functionality**: Allows saving virtual stories as real story files

## Installation & Setup

### 1. Basic Setup

Add Ghost Stories to your `.storybook/main.ts`:

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  experimental_indexers: async (existingIndexers) => {
    const { createGhostStoriesIndexer } = await import('@storybook/core/ghost-stories');

    return [
      createGhostStoriesIndexer({
        enabled: true,
        titlePrefix: 'V:',
        includePatterns: ['../src/components/**/*.{tsx,jsx}'],
        excludePatterns: ['../src/**/*.stories.*', '../src/**/*.test.*'],
      }),
      ...existingIndexers,
    ];
  },
  viteFinal: async (config) => {
    const { ghostStoriesPlugin } = await import('@storybook/core/ghost-stories');
    config.plugins?.push(ghostStoriesPlugin());
    return config;
  },
};

export default config;
```

### 2. Advanced Configuration

```typescript
createGhostStoriesIndexer({
  enabled: true,
  titlePrefix: 'V:',
  includePatterns: ['../src/components/**/*.{tsx,jsx}', '../src/ui/**/*.{tsx,jsx}'],
  excludePatterns: [
    '../src/**/*.stories.*',
    '../src/**/*.test.*',
    '../src/**/*.spec.*',
    '../src/utils/**',
  ],
  propTypeMapping: {
    // Custom prop type mappings
    Theme: {
      name: 'Theme',
      category: 'union',
      options: ['light', 'dark', 'auto'],
    },
    CustomType: {
      name: 'CustomType',
      category: 'object',
      value: { customField: 'default' },
    },
  },
});
```

## Component Requirements

For Ghost Stories to work properly, your components should:

### 1. Export Components with TypeScript Interfaces

```typescript
// ✅ Good - Clear interface definition
export interface ButtonProps {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, disabled, onClick }) => {
  return (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
};
```

### 2. Use Type Aliases

```typescript
// ✅ Good - Type alias works too
type ButtonProps = {
  label: string;
  disabled?: boolean;
};

export const Button: React.FC<ButtonProps> = ({ label, disabled }) => {
  return <button disabled={disabled}>{label}</button>;
};
```

### 3. Include JSDoc Comments

```typescript
// ✅ Good - JSDoc provides better descriptions
export interface ButtonProps {
  /** The text content of the button */
  label: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Callback fired when clicked */
  onClick?: () => void;
}
```

## Generated Fake Values

Ghost Stories automatically generates realistic default values based on prop types:

| Type       | Generated Value | Example                |
| ---------- | --------------- | ---------------------- |
| `string`   | `"Sample text"` | `label: "Sample text"` |
| `number`   | `42`            | `count: 42`            |
| `boolean`  | `false`         | `disabled: false`      |
| `array`    | `[]`            | `items: []`            |
| `function` | `() => {}`      | `onClick: () => {}`    |
| `union`    | First option    | `theme: "light"`       |
| `object`   | `{}`            | `config: {}`           |

## Usage Workflow

1. **Start Storybook**: Ghost Stories will automatically scan for components
2. **Browse Virtual Stories**: Look for stories with "V:" prefix in the sidebar
3. **Experiment with Controls**: Use the Controls panel to modify props
4. **Save as Real Story**: Click "Create new story" to save your changes
5. **Iterate**: Continue experimenting and saving different variations

## Example: Button Component

Given this component:

```typescript
export interface ButtonProps {
  label: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, disabled, size, variant, onClick }) => {
  // Component implementation
};
```

Ghost Stories will generate:

- **Story Title**: `V:Button`
- **Default Args**:
  ```typescript
  {
    label: "Sample text",
    disabled: false,
    size: "small", // First union option
    variant: "primary", // First union option
    onClick: () => {}
  }
  ```
- **Controls**: Text input for `label`, boolean for `disabled`, select for `size` and `variant`

## Limitations

### Current Limitations

- **Framework Support**: Currently optimized for React components
- **TypeScript Analysis**: Uses basic regex parsing (could be enhanced with TypeScript compiler API)
- **Vue/Svelte Support**: Limited support for non-React frameworks
- **Complex Types**: Limited support for deeply nested object types
- **Builder Support**: Requires Vite builder for virtual module support

### Planned Improvements

- [ ] Full TypeScript compiler API integration
- [ ] Enhanced Vue and Svelte support
- [ ] Better complex type handling
- [ ] Webpack builder support
- [ ] Custom prop analyzers per framework
- [ ] Story templates and presets

## Troubleshooting

### Ghost Stories Not Appearing

1. **Check Configuration**: Ensure `enabled: true` in your indexer config
2. **Verify File Patterns**: Make sure your `includePatterns` match your component files
3. **Check Component Format**: Ensure components follow the required format
4. **Review Console**: Look for errors in the browser console

### Controls Not Working

1. **Verify Vite Plugin**: Ensure `ghostStoriesPlugin()` is added to your Vite config
2. **Check Prop Types**: Ensure your TypeScript interfaces are properly defined
3. **Restart Storybook**: Try restarting your development server

### Save Functionality Issues

1. **Check Permissions**: Ensure Storybook has write permissions to your project
2. **Verify File Paths**: Check that the generated file paths are correct
3. **Review Save Logs**: Check the Storybook console for save-related errors

## Contributing

Ghost Stories is an experimental feature. Contributions are welcome!

### Development Setup

1. Clone the Storybook repository
2. Navigate to `code/core/src/ghost-stories`
3. Run tests: `yarn test ghost-stories`
4. Make your changes
5. Test with a local Storybook setup

### Areas for Contribution

- Enhanced TypeScript analysis
- Framework-specific analyzers
- Better fake value generation
- Performance optimizations
- Documentation improvements

## API Reference

### `createGhostStoriesIndexer(config)`

Creates a Ghost Stories indexer with the given configuration.

**Parameters:**

- `config.enabled`: Whether to enable Ghost Stories
- `config.titlePrefix`: Prefix for virtual story titles
- `config.includePatterns`: File patterns to include
- `config.excludePatterns`: File patterns to exclude
- `config.propTypeMapping`: Custom prop type mappings

### `ghostStoriesPlugin(options)`

Creates a Vite plugin for handling virtual modules.

**Parameters:**

- `options.workingDir`: Working directory for file resolution

### `analyzeComponentProps(content, componentName)`

Analyzes component props from file content.

**Parameters:**

- `content`: File content as string
- `componentName`: Name of the component to analyze

**Returns:** Array of `ComponentProp` objects

---

_Ghost Stories is an experimental feature. API and behavior may change in future versions._
