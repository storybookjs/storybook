import { getFeatures } from 'storybook/preview-api';

import { sourceDecorator } from './docgen/story-docs/source-decorator/sourceDecorator.ts';

const isDocgenServerEnabled = getFeatures().docgenServer;

export const decorators = isDocgenServerEnabled ? [] : [sourceDecorator];

export default { decorators };
