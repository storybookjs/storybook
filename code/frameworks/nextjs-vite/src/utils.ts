import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolvePackageDir } from '@storybook/core/internal/common';

export const getNextjsVersion = (): string =>
  JSON.parse(readFileSync(join(resolvePackageDir('next'), 'package.json'), 'utf8')).version;
