import { definePreview } from 'storybook/internal/preview-api';

import './preview';

export { HIGHLIGHT, RESET_HIGHLIGHT } from './constants';
export type { HighlightParameters } from './types';

export default () => definePreview({});
