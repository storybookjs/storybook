import { definePreviewAddon } from 'storybook/internal/csf';

import * as addArgs from './addArgs';
import * as loaders from './loaders';
import type { ActionsTypes } from './types';

export type { ActionsTypes };

export default () =>
  definePreviewAddon<ActionsTypes>({
    ...addArgs,
    ...loaders,
  });
