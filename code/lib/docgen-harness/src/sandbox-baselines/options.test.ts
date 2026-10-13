import { describe, expect, it } from 'vitest';

import { parseBaselineRunOptions } from './options.ts';

describe('parseBaselineRunOptions', () => {
  it('reads a named template, the sandbox override, and the update flag', () => {
    expect(
      parseBaselineRunOptions([
        '--template',
        'angular-vite/default-ts',
        '--sandbox',
        '/tmp/sb',
        '-u',
      ])
    ).toEqual({
      template: 'angular-vite/default-ts',
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

it('reads capture and comparison flags', () => {
  expect(
    parseBaselineRunOptions([
      '--capture',
      'legacy',
      '--static',
      '/build',
      '--out',
      '/capture',
      '--snippet-timeout',
      '5000',
    ])
  ).toEqual({
    mode: 'capture',
    engine: 'legacy',
    staticDir: '/build',
    out: '/capture',
    snippetTimeout: 5000,
  });
  expect(
    parseBaselineRunOptions(['--compare', '/before', '/after', '--framework', 'vue3'])
  ).toEqual({
    mode: 'compare',
    before: '/before',
    after: '/after',
    framework: 'vue3',
    report: '.',
  });
});
it.each([
  ['--capture', 'server', '--compare'],
  ['--capture', 'legacy', '--template', 'vue3-vite/default-ts'],
  ['--compare', 'a', 'b', '-u'],
  ['--compare', 'a', '--framework', 'svelte'],
  ['--capture', 'legacy', '--static', 'a', '--out', 'b', '--snippet-timeout', '0'],
  ['--capture', 'unknown', '--static', 'a', '--out', 'b'],
])('rejects incompatible or incomplete capture flags %j', (...args) => {
  expect(() => parseBaselineRunOptions(args)).toThrow();
});

it.each([
  ['--capture='],
  ['--static='],
  ['--capture', 'server', '--static', 'a', '--out', 'b', '--report='],
  ['--compare', 'a', 'b', '--framework', 'svelte', '--snippet-timeout='],
])('rejects empty flags in the wrong mode %j', (...args) => {
  expect(() => parseBaselineRunOptions(args)).toThrow();
});
