import { createRequire } from 'node:module';

import { dirname, join } from 'pathe';

// The preview runtime must come from the builder's own `storybook` copy, not from the user's
// project root: in multi-version monorepos the root can hold a different version than the
// builder, and a bare specifier resolves from the root (SB-1981). Resolving via this module's
// own URL pins the base to this package — the same convention as the webpack builder's
// `import.meta.resolve('storybook/package.json')` and the mocker runtime plugin.
const builderRequire = createRequire(import.meta.url);
const corePath = dirname(builderRequire.resolve('storybook/package.json'));

/** Absolute path of the preview runtime inside the builder's own `storybook` copy. */
export const previewRuntimePath = join(corePath, 'dist', 'preview', 'runtime.js');
