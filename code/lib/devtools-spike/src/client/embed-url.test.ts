import { describe, expect, it } from 'vitest';

import { STORYBOOK_START_COMMAND, embedUrl } from './embed-url.ts';

describe('embedUrl', () => {
  it('navigates the story embed with client-enforced preview-web params', () => {
    expect(embedUrl('http://localhost:6006', 'button--primary')).toBe(
      'http://localhost:6006/iframe.html?id=button--primary&viewMode=story&embed=true'
    );
  });

  it('trims trailing slashes from the base URL', () => {
    expect(embedUrl('http://localhost:6006/', 'button--primary')).toBe(
      'http://localhost:6006/iframe.html?id=button--primary&viewMode=story&embed=true'
    );
  });

  it('encodes the story id', () => {
    expect(embedUrl('http://localhost:6006', 'a b--c&d')).toBe(
      'http://localhost:6006/iframe.html?id=a%20b--c%26d&viewMode=story&embed=true'
    );
  });
});

describe('STORYBOOK_START_COMMAND', () => {
  it('targets the spike embed host config', () => {
    expect(STORYBOOK_START_COMMAND).toContain('--config-dir code/lib/devtools-spike/.storybook');
    expect(STORYBOOK_START_COMMAND).toContain('--port 6006');
  });
});
