import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, it } from 'vitest';

it('keeps builder docgen when TypeScript cannot resolve', () => {
  const presetUrl = pathToFileURL(resolve(__dirname, 'preset.ts')).href;
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { registerHooks } from 'node:module';
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'typescript') throw new Error('TypeScript not installed');
        return nextResolve(specifier, context);
      }
    });
    const { isDocgenProviderEnabled } = await import(${JSON.stringify(presetUrl)});
    process.stdout.write(JSON.stringify(isDocgenProviderEnabled()));
  `,
    ],
    { encoding: 'utf8' }
  );

  expect(output).toBe('false');
});
