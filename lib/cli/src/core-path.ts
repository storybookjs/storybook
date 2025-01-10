import { dirname } from 'node:path';

export const corePath = dirname(require.resolve('@storybook/core/package.json'));
