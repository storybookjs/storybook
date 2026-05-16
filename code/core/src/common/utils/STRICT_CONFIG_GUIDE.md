# TypeScript Strict Mode Support for Storybook Config

This feature adds runtime validation and TypeScript strict mode support for Storybook configuration files.

## Overview

When enabled, Storybook will validate the configuration object loaded from `.storybook/main.ts` (or `.storybook/main.js`) to ensure it matches the expected `StorybookConfig` interface. This helps catch configuration errors early and improves the developer experience.

## Usage

### Option 1: Enable via Environment Variable

Set the `STORYBOOK_STRICT_CONFIG` environment variable to enable strict config validation:

```bash
STORYBOOK_STRICT_CONFIG=true storybook dev
```

### Option 2: Enable Programmatically

If you're using Storybook's API directly, pass the `strict` option when loading the config:

```typescript
import { loadMainConfig } from 'storybook/internal/common';

const config = await loadMainConfig({
  configDir: '.storybook',
  strict: true, // Enable strict validation
});
```

## Validation Features

The validation checks for:

1. **Required fields**: Ensures the `stories` field is present
2. **Type correctness**: Validates field types (e.g., `stories` must be string, array, or function)
3. **Object structure**: Validates nested objects like `framework`, `core`, `typescript`, etc.
4. **Array items**: Validates items in arrays like `addons` and `staticDirs`

### Strict Mode (Non-Strict by Default)

In strict mode (when `strict: true` is passed or `STORYBOOK_STRICT_CONFIG=true`), additional validation occurs:

- Detects unknown/typo'd configuration properties
- Suggests the closest known property if there's a typo

Example - this will fail in strict mode:

```typescript
// main.ts
export default {
  stories: ['./src/**/*.stories.ts'],
  framework: '@storybook/react-vite',
  framwork: '@storybook/react-vite', // ❌ Typo - will be caught in strict mode
};
```

## Error Messages

When validation fails, you'll see a detailed error message:

```
ConfigValidationError: Storybook config validation failed in .storybook/main.ts.

The following validation errors were found:
  - stories: The "stories" field is required in the Storybook config
  - unknownField: Unknown configuration property: "unknownField"

Please ensure your Storybook config matches the expected TypeScript types.
```

## Migration Guide

### For Existing Projects

1. If you want to enable strict validation immediately:
   ```bash
   STORYBOOK_STRICT_CONFIG=true storybook dev
   ```

2. Fix any validation errors that appear

3. Set the environment variable persistently in your build pipeline or `.env` file

### For New Projects

New projects should use `STORYBOOK_STRICT_CONFIG=true` from the start to catch configuration errors early.

## Backward Compatibility

By default, strict validation is **disabled** to ensure backward compatibility. Existing configurations will continue to work without changes. Enable it explicitly when you're ready to use stricter validation.

## Examples

### Valid Configuration (Minimal)

```typescript
// .storybook/main.ts
export default {
  stories: ['../src/**/*.stories.ts'],
  framework: '@storybook/react-vite',
};
```

### Valid Configuration (Complete)

```typescript
// .storybook/main.ts
export default {
  stories: ['../src/**/*.stories.ts'],
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  core: {
    builder: '@storybook/builder-vite',
  },
  staticDirs: ['../public'],
  typescript: {
    check: false,
    checkOptions: {},
  },
};
```

### Invalid Configuration Examples

```typescript
// ❌ Missing required 'stories' field
export default {
  framework: '@storybook/react-vite',
};

// ❌ Invalid 'stories' type
export default {
  stories: 123,
};

// ❌ Missing 'name' in addon object
export default {
  stories: ['../src/**/*.stories.ts'],
  addons: [{ options: {} }], // Missing 'name'
};
```
