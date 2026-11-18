import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const dispatcher = join(import.meta.dirname, '../../dist/bin/dispatcher.js');
const dispatcherBuilt = existsSync(dispatcher);

describe('Storybook CLI dispatcher', () => {
  it.runIf(process.env.CI)('is built before CLI tests run', () => {
    expect(dispatcherBuilt).toBe(true);
  });

  it.runIf(dispatcherBuilt)(
    'directs users of the removed ai setup command to its replacements',
    () => {
      const result = spawnSync(process.execPath, [dispatcher, 'ai', 'setup'], {
        encoding: 'utf8',
        timeout: 5000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain('npx storybook skills setup');
      expect(output).toContain('npx storybook tools');
    }
  );
});
