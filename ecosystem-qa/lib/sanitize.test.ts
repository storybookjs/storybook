import { describe, expect, it } from 'vitest';

import { sanitizeFinding, sanitizeTitle } from './sanitize.ts';
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

describe('sanitizeTitle', () => {
  it('renders HTML, mentions, issue references and external links inert', () => {
    expect(
      sanitizeTitle(
        'Hi <img src=x onerror=alert(1)> @valentinpalkovic close #1, see https://evil.example/x and [docs](https://evil.example/docs)'
      )
    ).toBe('Hi  `@valentinpalkovic` close `#1`, see (link removed) and docs (link removed)');
  });

  it('keeps links into storybookjs repositories', () => {
    const title =
      'See https://github.com/storybookjs/storybook/issues/1 and [tree](https://github.com/storybookjs/mealdrop/tree/abc)';

    expect(sanitizeTitle(title)).toBe(title);
  });

  it('removes scheme-less links and links that leave storybookjs through dot segments', () => {
    expect(
      sanitizeTitle(
        'see evil.example/x, www.evil.example, https://github.com/storybookjs/../evil/x and https://github.com/storybookjs/%2e%2e/evil'
      )
    ).toBe('see (link removed) (link removed) (link removed) and (link removed)');
    expect(sanitizeTitle('see github.com/storybookjs/storybook')).toBe(
      'see github.com/storybookjs/storybook'
    );
  });

  it('wraps a cross-repository reference and a scoped package whole', () => {
    expect(sanitizeTitle('Like storybookjs/storybook#1 in @storybook/react-vite')).toBe(
      'Like `storybookjs/storybook#1` in `@storybook/react-vite`'
    );
  });

  it('turns backticks into quotes so an unbalanced one cannot reopen a mention', () => {
    expect(sanitizeTitle('a ` @someone `b')).toBe("a ' `@someone` 'b");
  });

  it('leaves email addresses alone', () => {
    expect(sanitizeTitle('mail ecosystem-qa@storybook.js.org')).toBe(
      'mail ecosystem-qa@storybook.js.org'
    );
  });

  it('caps before it neutralises, so the marker and code spans come after the limit', () => {
    expect(sanitizeTitle('t'.repeat(150))).toBe('t'.repeat(150));
    expect(sanitizeTitle(`${'t'.repeat(144)} @user and more`)).toBe(
      `${'t'.repeat(144)} \`@user\` [truncated]`
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

  it('caps the prose fields, keeps the first twelve steps and leaves the title alone', () => {
    const sanitized = sanitizeFinding(
      finding({
        title: '@someone',
        actual: 'a'.repeat(600),
        reproSteps: Array.from({ length: 15 }, (_, index) =>
          index === 11 ? 's'.repeat(400) : `step ${index + 1}`
        ),
      })
    );

    expect(sanitized.title).toBe('@someone');
    expect(sanitized.actual).toBe(`${'a'.repeat(500)} [truncated]`);
    expect(sanitized.reproSteps).toHaveLength(12);
    expect(sanitized.reproSteps[11]).toBe(`${'s'.repeat(300)} [truncated]`);
  });
});
