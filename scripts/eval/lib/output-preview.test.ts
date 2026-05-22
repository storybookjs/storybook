import { describe, expect, it } from 'vitest';

import { trimNonChatOutput } from './output-preview.ts';

describe('trimNonChatOutput', () => {
  it('trims large non-chat output to a shorter head and tail preview', () => {
    const longOutput = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n');

    const trimmed = trimNonChatOutput(longOutput);

    expect(trimmed).toContain('line 1');
    expect(trimmed).toContain('line 20');
    expect(trimmed).toContain('… 8 more lines …');
    expect(trimmed).not.toContain('line 7');
  });

  it('leaves short output untouched', () => {
    expect(trimNonChatOutput('short output')).toBe('short output');
  });
});
