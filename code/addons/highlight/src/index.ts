import { definePreview } from 'storybook/preview-api';

import './preview';

export { HIGHLIGHT, RESET_HIGHLIGHT, SCROLL_INTO_VIEW } from './constants';
export type { HighlightParameters } from './types';

export default () => definePreview({});
