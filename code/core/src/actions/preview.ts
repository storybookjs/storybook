import { definePreviewAddon } from 'storybook/internal/csf';

import * as addArgs from './addArgs.ts';
import * as loaders from './loaders.ts';
import type { ActionsTypes } from './types.ts';

export type { ActionsTypes };

export default () =>
  definePreviewAddon<ActionsTypes>({
    ...addArgs,
    ...loaders,
  });
