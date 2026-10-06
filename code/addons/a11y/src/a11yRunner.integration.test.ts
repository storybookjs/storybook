// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

import { run } from './a11yRunner.ts';

vi.mock('storybook/preview-api', () => ({
  addons: { getChannel: () => ({ on: vi.fn() }) },
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllEnvs();
});

it('trims passing nodes only for standalone runs and preserves every violation', async () => {
  document.body.innerHTML =
    Array.from({ length: 20 }, (_, i) => `<button>Action ${i}</button>`).join('') +
    '<button></button><button></button><button></button>';
  const input = { options: { runOnly: ['button-name'] } };

  vi.stubEnv('VITEST_STORYBOOK', 'true');
  const interactive = await run(input, 'buttons--example');
  expect(interactive.passes[0].nodes).toHaveLength(20);
  expect(interactive.violations[0].nodes).toHaveLength(3);

  vi.stubEnv('VITEST_STORYBOOK', 'false');
  const standalone = await run(input, 'buttons--example');
  expect(standalone.passes[0].nodes).toHaveLength(1);
  expect(standalone.violations).toEqual(interactive.violations);
  expect(input.options).toEqual({ runOnly: ['button-name'] });

  const explicit = await run(
    { options: { ...input.options, resultTypes: ['passes', 'violations'] } },
    'buttons--example'
  );
  expect(explicit.passes).toEqual(interactive.passes);
  expect(explicit.violations).toEqual(interactive.violations);
});
