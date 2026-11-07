import { readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { expect, it } from 'vitest';

const CODE = join(import.meta.dirname, '../../../code');

it('runs every sandbox E2E spec that writes sandbox files in the serial chromium-mutating project', () => {
  const config = readFileSync(join(CODE, 'playwright.config.ts'), 'utf8');
  const mutating = new RegExp(config.match(/const MUTATING_SPECS =\s*\/(.+)\/;/)![1]);
  const writing = readdirSync(join(CODE, 'e2e-sandbox'))
    .filter((file) => file.endsWith('.spec.ts'))
    .filter((file) =>
      /writeFile|fs\.(rm|unlink|rename|cp|appendFile)|outputFile/.test(
        readFileSync(join(CODE, 'e2e-sandbox', file), 'utf8')
      )
    );
  expect(writing.filter((file) => !mutating.test(file))).toEqual([]);
});
