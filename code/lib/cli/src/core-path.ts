import ESM_COMPAT_ModuleA from 'node:module';
import { dirname } from 'node:path';

const require = ESM_COMPAT_ModuleA.createRequire(import.meta.url);

export const corePath = dirname(require.resolve('@storybook/core/package.json'));
