import { definePreviewAddon } from 'storybook/internal/csf';

import './preview';
import type { HighLightTypes } from './types';

export { HIGHLIGHT, RESET_HIGHLIGHT } from './constants';
export type { HighLightTypes };

export default () => definePreviewAddon<HighLightTypes>({});
