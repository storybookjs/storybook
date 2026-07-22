import { describe, expect, it } from 'vitest';

import { removeTomlSection } from './scripts/toml.ts';

describe('removeTomlSection', () => {
  it('removes a plugin section and keeps surrounding config', () => {
    const input = `[marketplaces.foo]
source = "a"

[plugins."storybook@storybook"]
enabled = true

[projects."/tmp"]
trust_level = "trusted"
`;

    expect(removeTomlSection(input, '[plugins."storybook@storybook"]')).toBe(
      `[marketplaces.foo]
source = "a"

[projects."/tmp"]
trust_level = "trusted"
`
    );
  });

  it('returns content unchanged when the section is missing', () => {
    const input = `[marketplaces.foo]
enabled = true
`;

    expect(removeTomlSection(input, '[plugins."storybook@storybook"]')).toBe(input);
  });

  it('normalizes CRLF line endings in the remaining config', () => {
    const input = `[plugins."storybook@storybook"]\r\nenabled = true\r\n\r\n[projects."/"]\r\nx = 1\r\n`;

    expect(removeTomlSection(input, '[plugins."storybook@storybook"]')).toBe(
      `[projects."/"]\nx = 1\n`
    );
  });
});
