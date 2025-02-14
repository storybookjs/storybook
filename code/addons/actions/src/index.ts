import { definePreview } from 'storybook/internal/preview-api';
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import * as addonAnnotations from './preview';

export * from './constants';
export * from './models';
export * from './runtime';

export default (): ProjectAnnotations<Renderer> => definePreview(addonAnnotations);

export type { ActionsParameters } from './types';
