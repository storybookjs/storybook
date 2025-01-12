import { deprecate } from 'storybook/internal/client-logger';

deprecate(
  "Import from '@storybook/addon-docs/blocks' is deprecated. Please import from '@storybook/blocks' instead."
);

export * from '@storybook/blocks';
