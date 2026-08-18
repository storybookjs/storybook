import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readPackageJson = (packageDir: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '..', packageDir, 'package.json'), 'utf-8'));

describe('peerDependencies', () => {
  it('accepts every zone.js release @storybook/angular accepts', () => {
    expect(readPackageJson('.').peerDependencies['zone.js']).toBe(
      readPackageJson('../angular').peerDependencies['zone.js']
    );
  });
});
