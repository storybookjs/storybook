// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { PANEL_ID } from 'storybook/internal/docs-tools';

import { addons } from 'storybook/manager-api';

import './manager.tsx';

vi.mock('storybook/manager-api', () => ({
  addons: {
    register: (_id: string, register: () => void) => register(),
    add: vi.fn(),
  },
  types: { PANEL: 'panel' },
}));

const panel = vi.mocked(addons.add).mock.calls.find(([id]) => id === PANEL_ID)?.[1];

if (!panel || !('disabled' in panel) || typeof panel.disabled !== 'function') {
  throw new Error('Expected the Code panel to register a disabled predicate');
}
const isDisabled = panel.disabled;

describe('Code panel registration', () => {
  it.each([
    {},
    { docs: {} },
    { docs: { source: { code: '<button>Example</button>' } } },
    { docs: { codePanel: undefined } },
    { docs: { codePanel: true } },
  ])('enables the panel for %j', (parameters) => {
    expect(isDisabled(parameters)).toBe(false);
  });

  it('preserves the explicit opt-out', () => {
    expect(isDisabled({ docs: { codePanel: false } })).toBe(true);
  });
});
