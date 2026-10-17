// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { addons } from 'storybook/preview-api';

vi.mock('storybook/preview-api', { spy: true });

beforeEach(() => {
  vi.resetModules();
  vi.mocked(addons.getChannel).mockReturnValue({
    on: vi.fn(),
  } as unknown as ReturnType<typeof addons.getChannel>);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('trims passing nodes with explicit result types and preserves every violation', async () => {
  const { run } = await import('./a11yRunner.ts');

  document.body.innerHTML =
    Array.from({ length: 20 }, (_, i) => `<button>Action ${i}</button>`).join('') +
    '<button></button><button></button><button></button>';

  const result = await run(
    { options: { runOnly: ['button-name'], resultTypes: ['violations', 'incomplete'] } },
    'buttons--example'
  );

  expect(result.passes[0].nodes).toHaveLength(1);
  expect(result.violations[0].nodes).toHaveLength(3);
});
