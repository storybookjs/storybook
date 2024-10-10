import ESM_COMPAT_ModuleA from 'node:module';
import { dirname } from 'node:path';

// @ts-expect-error (esm compat not 100% yet)
const require = ESM_COMPAT_ModuleA.createRequire(import.meta.url);

export const corePath = dirname(require.resolve('@storybook/core/package.json'));
