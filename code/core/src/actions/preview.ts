import { definePreview } from 'storybook/preview-api';

import * as addArgs from './addArgs';
import * as loaders from './loaders';

export default () =>
  definePreview({
    ...addArgs,
    ...loaders,
  });
