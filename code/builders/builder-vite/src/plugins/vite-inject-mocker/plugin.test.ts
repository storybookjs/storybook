import { expect, it } from 'vitest';

import { getMockerRuntimeUrl } from './plugin.ts';

it.each([
  { command: 'build', expected: './vite-inject-mocker-entry.js' },
  { command: 'serve', expected: '/vite-inject-mocker-entry.js' },
] as const)('locates the mocker runtime for $command', ({ command, expected }) => {
  expect(getMockerRuntimeUrl(command)).toBe(expected);
});
