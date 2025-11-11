import type { Framework } from '../../../bin/modernInputs';
import { supportedFrameworksNames } from '../../../bin/modernInputs';
import { type Check } from './Check';
import { CompatibilityType } from './CompatibilityType';

const FOUND_NEXTJS = `Found Next.js with test intent`;

export const SUPPORTED_FRAMEWORKS: Framework[] = [
  'react-vite',
  'vue3-vite',
  'html-vite',
  'preact-vite',
  'svelte-vite',
  'web-components-vite',
  'nextjs',
  'nextjs-vite',
  'sveltekit',
];

/**
 * When selecting framework nextjs & intent includes test, prompt for nextjs-vite. When selecting
 * another framework that doesn't support test addon, prompt for ignoring test intent.
 */
export const frameworkTest: Check = {
  condition: async (context, state) => {
    if (
      !state.features ||
      !state.features.includes('test') ||
      SUPPORTED_FRAMEWORKS.includes(state.framework)
    ) {
      return { type: CompatibilityType.COMPATIBLE };
    }
    return {
      type: CompatibilityType.INCOMPATIBLE,
      reasons:
        state.framework === 'nextjs'
          ? [FOUND_NEXTJS]
          : [`Found ${supportedFrameworksNames[state.framework]} with test intent`],
    };
  },
};
