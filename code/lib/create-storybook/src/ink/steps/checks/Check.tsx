import type { ContextType } from 'react';

import type { State } from '..';
import type { AppContext } from '../../utils/context';
import type { CompatibilityResult } from './CompatibilityType';

export interface Check {
  condition: (
    context: ContextType<typeof AppContext>,
    state: State
  ) => Promise<CompatibilityResult>;
}
