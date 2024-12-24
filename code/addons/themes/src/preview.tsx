import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { GLOBAL_KEY as KEY } from './constants';

export const initialGlobals: ProjectAnnotations<Renderer>['initialGlobals'] = {
  [KEY]: '',
};
