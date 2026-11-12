import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { copyRedacted, redactSecrets, redactTree } from './redact.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(readdirSync).mockImplementation(memfs.readdirSync as typeof readdirSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
});

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

  it('leaves package names that merely contain sk- alone', () => {
    const names = 'react-mask-input-component-for-forms task-queue-worker-process-helper';

    expect(redactSecrets(names)).toBe(names);
    expect(redactSecrets(`OPENAI_API_KEY=sk-proj-${'k'.repeat(30)}`)).toBe(
      'OPENAI_API_KEY=[redacted]'
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
    vol.fromJSON({
      '/run/dev.log': `started with ${anthropicKey}\n`,
      '/run/debug.csv': `step,detail\ninstall,${anthropicKey}\n`,
    });
    memfs.writeFileSync('/run/shot.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    copyRedacted('/run/dev.log', '/run/out.log');
    copyRedacted('/run/shot.png', '/run/out.png');
    copyRedacted('/run/debug.csv', '/run/out.csv');

    expect(memfs.readFileSync('/run/out.log', 'utf8')).toBe('started with [redacted]\n');
    expect(memfs.readFileSync('/run/out.csv', 'utf8')).toBe('step,detail\ninstall,[redacted]\n');
    expect(memfs.readFileSync('/run/out.png')).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});

describe('redactTree', () => {
  it('redacts nested text files in place and leaves binaries and symlinks alone', () => {
    vol.fromJSON({
      '/run/agent-stream.jsonl': `{"env":"${anthropicKey}"}\n`,
      '/run/evidence/dev.log': `key ${anthropicKey}\n`,
    });
    memfs.writeFileSync('/run/evidence/shot.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]));
    memfs.symlinkSync('/run/evidence/dev.log', '/run/link.log');

    redactTree('/run');

    expect(memfs.readFileSync('/run/agent-stream.jsonl', 'utf8')).toBe('{"env":"[redacted]"}\n');
    expect(memfs.readFileSync('/run/evidence/dev.log', 'utf8')).toBe('key [redacted]\n');
    expect(memfs.readFileSync('/run/evidence/shot.png')).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0])
    );
    expect(memfs.lstatSync('/run/link.log').isSymbolicLink()).toBe(true);
  });
});
