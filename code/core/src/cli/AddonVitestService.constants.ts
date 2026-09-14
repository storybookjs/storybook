import { SupportedFramework } from '../types/index.ts';

export const SUPPORTED_FRAMEWORKS: readonly SupportedFramework[] = [
  SupportedFramework.ANGULAR_VITE,
  SupportedFramework.HTML_VITE,
  SupportedFramework.NEXTJS_VITE,
  SupportedFramework.PREACT_VITE,
  SupportedFramework.REACT_NATIVE_WEB_VITE,
  SupportedFramework.REACT_VITE,
  SupportedFramework.SOLID,
  SupportedFramework.SVELTE_VITE,
  SupportedFramework.SVELTEKIT,
  SupportedFramework.VUE3_VITE,
  SupportedFramework.WEB_COMPONENTS_VITE,
  SupportedFramework.TANSTACK_REACT,
];

/**
 * Vitest range installed when the project does not declare its own Vitest version. `^4` is the
 * family @storybook/addon-vitest's devDependencies are tested against; an unpinned install would
 * resolve the latest Vitest major, whose optional `@types/node` peer range can hard-fail npm
 * installs on projects pinning older `@types/node` (e.g. create-next-app scaffolds with
 * `@types/node@^20`). Keep this in sync with the addon's supported majors.
 */
export const DEFAULT_VITEST_SPECIFIER = '^4';
