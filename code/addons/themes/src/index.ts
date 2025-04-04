import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

export type { ThemesGlobals, ThemesParameters } from './types';

export default () => definePreview(addonAnnotations);

export * from './decorators';
