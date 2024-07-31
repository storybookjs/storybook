import { describe, it, expect } from 'vitest';
import { getStorybookConfiguration } from './get-storybook-configuration';

describe('getStorybookConfiguration', () => {
  it('handles short names', () => {
    const port = getStorybookConfiguration('start-storybook -p 9001', '-p', '--port');
    expect(port).toBe('9001');
  });
  it('handles long names', () => {
    const port = getStorybookConfiguration('start-storybook --port 9001', '-p', '--port');
    expect(port).toBe('9001');
  });
  it('handles equals', () => {
    const port = getStorybookConfiguration('start-storybook --port=9001', '-p', '--port');
    expect(port).toBe('9001');
  });
  it('handles double space', () => {
    const port = getStorybookConfiguration('start-storybook --port  9001', '-p', '--port');
    expect(port).toBe('9001');
  });
  it('handles complex scripts', () => {
    const port = getStorybookConfiguration(
      "node verify-node-version.js && concurrently --raw --kill-others 'yarn relay --watch' 'start-storybook -s ./public -p 9001'",
      '-p',
      '--port'
    );
    expect(port).toBe('9001');
  });
});
