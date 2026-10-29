import { expect, it, vi } from 'vitest';

import type { Storybook } from 'storybook/internal/instance';

import vitest from './node.ts';
import { wireAiScoringChannels } from './node/ai-scoring.ts';
import { wireTestServerChannel } from './node/server-channel.ts';
import { registerTestServices } from './node/services.ts';
import { withCoverageStaticDir } from './node/static-dirs.ts';
import { createTestRunnerRuntime } from './node/test-run-responder.ts';

vi.mock('./node/server-channel.ts', () => ({ wireTestServerChannel: vi.fn() }));
vi.mock('./node/ai-scoring.ts', () => ({ wireAiScoringChannels: vi.fn() }));
vi.mock('./node/services.ts', () => ({ registerTestServices: vi.fn() }));
vi.mock('./node/test-run-responder.ts', () => ({
  createTestRunnerRuntime: vi.fn(() => ({ close: vi.fn() })),
}));
vi.mock('./node/static-dirs.ts', () => ({
  withCoverageStaticDir: vi.fn(async (values) => values),
}));

function setUp({ mode = 'dev', a11y = false }: { mode?: string; a11y?: boolean } = {}) {
  const hooks: [name: string, handler: (...args: any[]) => any, kind?: string][] = [];
  const storybook = {
    mode,
    hook: (name: string, handler: (...args: any[]) => any, kind?: string) =>
      hooks.push([name, handler, kind]),
    hasPlugin: (name: string) => a11y && name === '@storybook/addon-a11y',
  } as unknown as Storybook;
  vitest({ enableCrashReports: true }).setup(storybook);
  const handler = (name: string) => hooks.find(([hook]) => hook === name)![1];
  const runtime = vi.mocked(createTestRunnerRuntime).mock.results.at(-1)!.value;
  return { hooks, handler, storybook, runtime };
}

it('registers hooks in the order the preset applied them', () => {
  expect(setUp().hooks.map(([name, , kind]) => (kind ? `${name} (${kind})` : name)))
    .toMatchInlineSnapshot(`
    [
      "core:services:register",
      "server:channel:ready",
      "core:instance:close",
      "core:static-dirs:collect (reduce)",
    ]
  `);
});

it.each([
  { a11y: true, expected: true },
  { a11y: false, expected: false },
])('registers services with a11y present: $a11y', async ({ a11y, expected }) => {
  const { handler, storybook, runtime } = setUp({ a11y });
  await handler('core:services:register')();
  expect(registerTestServices).toHaveBeenLastCalledWith(storybook, expected, runtime);
});

it('wires the server channel with the addon options', async () => {
  const { handler, storybook, runtime } = setUp();
  const channel = {};
  await handler('server:channel:ready')(channel);
  expect(wireAiScoringChannels).toHaveBeenLastCalledWith(storybook, channel);
  expect(wireTestServerChannel).toHaveBeenLastCalledWith(
    storybook,
    channel,
    { enableCrashReports: true },
    runtime
  );
});

it('gives each instance its own runtime and closes it with that instance', async () => {
  const first = setUp();
  const second = setUp();

  await first.handler('core:instance:close')();

  expect(first.runtime).not.toBe(second.runtime);
  expect(first.runtime.close).toHaveBeenCalledOnce();
  expect(second.runtime.close).not.toHaveBeenCalled();
});

it.each([
  { mode: 'dev', ctx: undefined, expected: 'DEVELOPMENT' },
  { mode: 'build', ctx: undefined, expected: 'PRODUCTION' },
  { mode: 'build', ctx: { configType: 'DEVELOPMENT' }, expected: 'DEVELOPMENT' },
])('serves coverage for $mode with $ctx as $expected', async ({ mode, ctx, expected }) => {
  await setUp({ mode }).handler('core:static-dirs:collect')(['/public'], ctx);
  expect(withCoverageStaticDir).toHaveBeenLastCalledWith(['/public'], expected);
});
