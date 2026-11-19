import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const declarationsBuilt = existsSync(join(import.meta.dirname, '../dist/index.d.ts'));
const typescript = createRequire(import.meta.url).resolve('typescript/bin/tsc');

describe('published declarations', () => {
  it.runIf(process.env.CI)('are built before this suite runs', () => {
    expect(declarationsBuilt).toBe(true);
  });

  it.runIf(declarationsBuilt)(
    'type-check in a consumer with skipLibCheck disabled',
    () => {
      execFileSync(
        process.execPath,
        [
          typescript,
          '--ignoreConfig',
          '--module',
          'Node16',
          '--target',
          'ES2022',
          '--strict',
          '--skipLibCheck',
          'false',
          '--types',
          'node',
          '--noEmit',
          join(import.meta.dirname, 'fixtures/declarations-consumer.ts'),
        ],
        { stdio: 'pipe' }
      );
    },
    90_000
  );
});
