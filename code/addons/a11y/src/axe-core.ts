/**
 * We re-export axe-core to avoid having it bundled in twice into the `preview.ts` and `index.ts`
 * entrypoints.
 *
 * When using the runtime of `axe-core` you should import it via:
 *
 * ```ts
 * import axe from '@storybook/addon-a11y/axe-core';
 * ```
 *
 * When importing the types of `axe-core` you should import as such:
 *
 * ```ts
 * import type { AxeResults } from 'axe-core';
 * ```
 *
 * This is because `axe-core`'s types are externalized, due to the fact they use typescript
 * `namespace` declarations; which cannot be bundled by our type-bundler.
 */
import axe from 'axe-core';

export default axe;
