import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const corePath = dirname(fileURLToPath(import.meta.resolve('@storybook/core/package.json')));
