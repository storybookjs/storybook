import { getProjectRoot } from 'storybook/internal/common';

import * as find from 'empathic/find';

/**
 * Nearest `tsconfig.json` at or above the Storybook config directory.
 *
 * Both builders and the Compodoc invocation need the same answer, and when they derived it
 * separately they disagreed: one bounded the walk at the project root and one did not, so a
 * monorepo could hand `storybook dev` and `storybook build` different tsconfigs. The bound belongs
 * here rather than at each call site.
 */
export const findTsconfigUp = (configDir: string): string | undefined =>
  find.up('tsconfig.json', { cwd: configDir, last: getProjectRoot() });
