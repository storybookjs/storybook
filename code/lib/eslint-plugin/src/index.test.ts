import { describe, expect, it } from 'vitest';

import { name, version } from '../package.json';
import * as plugin from './index.ts';

describe('plugin meta', () => {
  it('exposes the package name and version', () => {
    expect(plugin.meta).toEqual({ name, version });
    expect(plugin.default.meta).toEqual({ name, version });
  });
});
