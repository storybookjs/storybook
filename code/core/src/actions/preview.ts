import { definePreview } from '../preview-api/modules/addons/definePreview';
import * as addArgs from './addArgs';
import * as loaders from './loaders';

export default () =>
  definePreview({
    ...addArgs,
    ...loaders,
  });
