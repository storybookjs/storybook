import { existsSync } from 'node:fs';

import { join } from 'pathe';

// Sandcastle gives the agent every variable of `.sandcastle/.env` in the directory it runs in, and
// for a name without a value the one of this process. A cloned repo must not decide either.
export const shipsSandcastleFiles = (cloneDir: string): boolean =>
  existsSync(join(cloneDir, '.sandcastle'));
