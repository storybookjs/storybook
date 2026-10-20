import { expect, it, vi } from 'vitest';

import type { ReactDocgenPlan } from '../../../renderers/react/src/docgen/engine.ts';
import { viteFinal } from './preset.ts';

const reactDocgenPlugin = { name: 'storybook:react-docgen-plugin' };
const loadPlugin = vi.fn(() => ({ reactDocgen: async () => reactDocgenPlugin }));
vi.mock('./plugins/react-docgen.ts', () => loadPlugin());

const runViteFinal = (
  builder: ReactDocgenPlan['builder'],
  config = { plugins: [{ name: 'app' }] }
) => viteFinal(config, { presets: { apply: async () => ({ builder }) } } as any);

it('leaves the config alone and never loads react-docgen when builder docgen is off', async () => {
  const config = { plugins: [{ name: 'app' }] };

  expect(await runViteFinal({ reactDocgen: false, reactDocgenTypescript: false }, config)).toBe(
    config
  );
  expect(loadPlugin).not.toHaveBeenCalled();
});

it('puts the react-docgen plugin first', async () => {
  expect(await runViteFinal({ reactDocgen: 'all', reactDocgenTypescript: false })).toEqual({
    plugins: [reactDocgenPlugin, { name: 'app' }],
  });
});
