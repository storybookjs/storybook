import { describe, expect, it } from 'vitest';

import { parseBaselineRunOptions } from './options.ts';

describe('parseBaselineRunOptions', () => {
  it('reads a named template, the sandbox override, and the update flag', () => {
    expect(
      parseBaselineRunOptions([
        '--template',
        'angular-vite/docgen-server-ts',
        '--sandbox',
        '/tmp/sb',
        '-u',
      ])
    ).toEqual({
      template: 'angular-vite/docgen-server-ts',
      sandboxDir: '/tmp/sb',
      update: true,
    });
  });

  it('leaves the template absent when no flag is given, so the caller covers every template', () => {
    expect(parseBaselineRunOptions([])).toEqual({ update: false });
  });

  it('rejects an empty --template= rather than reading it as every template', () => {
    expect(() => parseBaselineRunOptions(['--template='])).toThrow(/invalid options/);
  });

  it('rejects an empty --sandbox=', () => {
    expect(() => parseBaselineRunOptions(['--sandbox='])).toThrow(/invalid options/);
  });

  it('rejects an unknown flag rather than ignoring it', () => {
    expect(() => parseBaselineRunOptions(['--templte', 'x'])).toThrow(/Unknown option/);
  });
});
