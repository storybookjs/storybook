import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { copyRedacted, redactSecrets } from './redact.ts';

const token = `github_pat_${'A1b2'.repeat(10)}`;
const anthropicKey = `sk-ant-api03-${'x'.repeat(40)}`;

describe('redactSecrets', () => {
  it('replaces provider keys, GitHub tokens and auth headers', () => {
    expect(
      redactSecrets(
        `key ${anthropicKey} token ${token} ghp_${'c'.repeat(36)} header AUTHORIZATION: basic abc Bearer ${'t'.repeat(30)}`
      )
    ).toBe(
      'key [redacted] token [redacted] [redacted] header AUTHORIZATION: basic [redacted] Bearer [redacted]'
    );
  });

  it('replaces a base64 run that decodes to a credential and keeps other runs', () => {
    const encoded = Buffer.from(`x-access-token:${token}`).toString('base64');
    const hash = 'a'.repeat(64);

    expect(redactSecrets(`basic ${encoded} sha ${hash}`)).toBe(`basic [redacted] sha ${hash}`);
  });

  it('leaves ordinary log text alone', () => {
    const text =
      'yarn install --immutable\n➤ YN0000: · Done with warnings in 2s 503ms\nsk-ant is a prefix';

    expect(redactSecrets(text)).toBe(text);
  });
});

describe('copyRedacted', () => {
  it('redacts text of any extension and copies binaries unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-redact-'));
    writeFileSync(join(dir, 'dev.log'), `started with ${anthropicKey}\n`);
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    writeFileSync(join(dir, 'debug.csv'), `step,detail\ninstall,${anthropicKey}\n`);

    copyRedacted(join(dir, 'dev.log'), join(dir, 'out.log'));
    copyRedacted(join(dir, 'shot.png'), join(dir, 'out.png'));
    copyRedacted(join(dir, 'debug.csv'), join(dir, 'out.csv'));

    expect(readFileSync(join(dir, 'out.log'), 'utf8')).toBe('started with [redacted]\n');
    expect(readFileSync(join(dir, 'out.csv'), 'utf8')).toBe('step,detail\ninstall,[redacted]\n');
    expect(readFileSync(join(dir, 'out.png'))).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});
