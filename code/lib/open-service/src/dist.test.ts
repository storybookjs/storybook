import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '../dist');
const DIST_BUILT = existsSync(DIST);

const MODULE_SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
const FORBIDDEN_RE = /^(?:storybook|@storybook\/(?:ui|manager))(?:\/|$)/;

function forbiddenSpecifiers(): string[] {
  return readdirSync(DIST, { recursive: true, encoding: 'utf-8' })
    .filter((file) => /\.(?:js|d\.ts)$/.test(file))
    .flatMap((file) =>
      [...readFileSync(join(DIST, file), 'utf-8').matchAll(MODULE_SPECIFIER_RE)]
        .map((match) => match[1])
        .filter((specifier) => FORBIDDEN_RE.test(specifier))
        .map((specifier) => `${file}: ${specifier}`)
    );
}

describe('open-service dist', () => {
  // CI always builds before testing, so a missing dist there is the failure.
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DIST_BUILT).toBe(true);
  });

  it.runIf(DIST_BUILT)(
    'imports nothing from storybook, @storybook/ui or @storybook/manager',
    () => {
      expect(forbiddenSpecifiers()).toEqual([]);
    }
  );
});
