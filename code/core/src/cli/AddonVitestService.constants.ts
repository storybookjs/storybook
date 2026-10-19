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
 * The `@types/node` optional peer range declared by the latest Vitest major (Vitest 5.0.0 dropped
 * `^20`). A project whose own `@types/node` range does not intersect this range (e.g.
 * create-next-app scaffolds pinning `@types/node@^20`) hard-fails npm's peer resolution for an
 * unpinned Vitest install, so those projects get VITEST_FALLBACK_SPECIFIER instead. Keep this in
 * sync with the latest Vitest major's peerDependencies.
 */
export const LATEST_VITEST_TYPES_NODE_PEER = '^22.0.0 || >=24.0.0';

/**
 * Vitest range installed when the project does not declare its own Vitest version AND its
 * `@types/node` range conflicts with LATEST_VITEST_TYPES_NODE_PEER. `^4` is the family
 * @storybook/addon-vitest's devDependencies are tested against. Keep this in sync with the
 * addon's supported majors.
 */
export const VITEST_FALLBACK_SPECIFIER = '^4';
