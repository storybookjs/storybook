import { describe, expect, it } from 'vitest';

import { sanitizeFinding, sanitizeText } from './sanitize.ts';
import type { Finding } from './types.ts';

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  checkId: 'core.dev-server',
  title: 'Dev server fails',
  baseline: 'pass',
  expected: 'It starts',
  actual: 'It exits',
  reproSteps: ['yarn storybook'],
  evidence: { logs: [] },
  windowsOnly: false,
  ...overrides,
});

describe('sanitizeText', () => {
  it('renders HTML, mentions, issue references and external links inert', () => {
    expect(
      sanitizeText(
        'Hi <img src=x onerror=alert(1)> @valentinpalkovic please close #1, see https://evil.example/x and [docs](https://evil.example/docs)'
      )
    ).toBe('Hi  `@valentinpalkovic` please close `#1`, see (link removed) and docs (link removed)');
  });

  it('keeps links into storybookjs repositories', () => {
    const body =
      'See https://github.com/storybookjs/storybook/issues/1 and [tree](https://github.com/storybookjs/mealdrop/tree/abc) and https://raw.githubusercontent.com/storybookjs/storybook/qa-assets/a.png';

    expect(sanitizeText(body)).toBe(body);
  });

  it('leaves email addresses and backticked mentions alone', () => {
    expect(sanitizeText('mail ecosystem-qa@storybook.js.org or `@bot`')).toBe(
      'mail ecosystem-qa@storybook.js.org or `@bot`'
    );
  });
});

describe('sanitizeFinding', () => {
  it('cuts an over-long errorText with a marker and leaves its markup for the fence', () => {
    const errorText = `<b>${'x'.repeat(5000)}`;

    const { errorText: cut } = sanitizeFinding(finding({ errorText }));

    expect(cut).toHaveLength(4000 + ' [truncated]'.length);
    expect(cut?.startsWith('<b>')).toBe(true);
    expect(cut?.endsWith(' [truncated]')).toBe(true);
  });

  it('caps the prose fields and the number of repro steps', () => {
    const sanitized = sanitizeFinding(
      finding({
        title: 't'.repeat(200),
        actual: `<b>${'a'.repeat(600)}</b>`,
        reproSteps: Array.from({ length: 15 }, (_, index) => `step ${index + 1} @someone`),
      })
    );

    expect(sanitized.title).toBe(`${'t'.repeat(150)} [truncated]`);
    expect(sanitized.actual).toBe(`${'a'.repeat(500)} [truncated]`);
    expect(sanitized.reproSteps).toHaveLength(12);
    expect(sanitized.reproSteps[0]).toBe('step 1 `@someone`');
    expect(sanitized.reproSteps[11]).toBe('step 12 `@someone` [truncated]');
  });
});
