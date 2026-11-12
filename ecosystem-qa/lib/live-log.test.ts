import { describe, expect, it } from 'vitest';

import { liveLine } from './live-log.ts';

const anthropicKey = `sk-ant-api03-${'x'.repeat(40)}`;
const encodedKey = Buffer.from(anthropicKey).toString('base64');

describe('liveLine', () => {
  it('prints agent text without a key that was base64-encoded', () => {
    expect(liveLine({ type: 'text', message: `  the key is ${encodedKey}\n` })).toBe(
      'the key is [redacted]'
    );
  });

  it('prints a tool call on one line without the key in its arguments', () => {
    expect(
      liveLine({
        type: 'toolCall',
        name: 'Bash',
        formattedArgs: `echo ${anthropicKey}\n  | base64 # ${encodedKey}`,
      })
    ).toBe('▶ Bash(echo [redacted] | base64 # [redacted])');
  });

  it('cuts the arguments of a tool call at 300 characters', () => {
    const line = liveLine({ type: 'toolCall', name: 'Read', formattedArgs: 'a'.repeat(400) });

    expect(line).toBe(`▶ Read(${'a'.repeat(300)})`);
  });
});
