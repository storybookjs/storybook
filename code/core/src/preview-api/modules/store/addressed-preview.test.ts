import { describe, expect, it, vi } from 'vitest';

import { ArgsStore } from './ArgsStore.ts';
import {
  acceptsAddressedUpdate,
  applyAddressedUpdate,
  createAddressedPreview,
  resetAddressedPreview,
  reuseAddressedPreview,
  type AddressedPreview,
} from './addressed-preview.ts';
import { GlobalsStore } from './GlobalsStore.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const storyId = 'button--primary';

function preview(
  instanceId: string | null,
  args: Record<string, unknown>,
  globals: Record<string, unknown>
): AddressedPreview {
  const argsStore = new ArgsStore();
  argsStore.setInitial({ id: storyId, initialArgs: args } as any);
  const globalsStore = new GlobalsStore({ globals, globalTypes: {} });
  return createAddressedPreview({
    instanceId,
    storyId,
    args: argsStore,
    globals: globalsStore,
  });
}

describe('addressed preview stores', () => {
  it('writes one instance into its store and leaves the other instance and the main canvas alone', () => {
    const initialArgs = { label: 'Hello' };
    const initialGlobals = { viewport: 'desktop' };
    const instanceA = preview('a', initialArgs, initialGlobals);
    const instanceB = preview('b', initialArgs, initialGlobals);
    const main = preview(null, initialArgs, initialGlobals);

    expect(
      applyAddressedUpdate(instanceA, {
        kind: 'args',
        instanceId: 'a',
        storyId,
        args: { label: 'Only A' },
      })
    ).toBe(true);
    expect(
      applyAddressedUpdate(instanceB, {
        kind: 'args',
        instanceId: 'a',
        storyId,
        args: { label: 'Only A' },
      })
    ).toBe(false);
    expect(
      applyAddressedUpdate(main, {
        kind: 'args',
        instanceId: 'a',
        storyId,
        args: { label: 'Only A' },
      })
    ).toBe(false);
    expect(
      applyAddressedUpdate(instanceA, {
        kind: 'globals',
        instanceId: 'a',
        globals: { viewport: 'mobile' },
      })
    ).toBe(true);

    expect(instanceA.args.get(storyId)).toEqual({ label: 'Only A' });
    expect(instanceA.globals.get()).toEqual({ viewport: 'mobile' });
    expect(instanceB.args.get(storyId)).toEqual(initialArgs);
    expect(instanceB.globals.get()).toEqual(initialGlobals);
    expect(main.args.get(storyId)).toEqual(initialArgs);
    expect(main.globals.get()).toEqual(initialGlobals);
    expect(acceptsAddressedUpdate(instanceA.instanceId, undefined)).toBe(false);
    expect(acceptsAddressedUpdate(main.instanceId, undefined)).toBe(true);
    expect(acceptsAddressedUpdate(main.instanceId, 'a')).toBe(false);
  });

  it('drops a reused iframe back to its own args and does not adopt the other instance', () => {
    const initialArgs = { label: 'Hello' };
    const initialGlobals = { viewport: 'desktop' };
    const instanceA = preview('a', initialArgs, initialGlobals);
    const instanceB = preview('b', initialArgs, initialGlobals);

    applyAddressedUpdate(instanceA, {
      kind: 'args',
      instanceId: 'a',
      storyId,
      generation: 1,
      args: { label: 'Only A' },
    });
    applyAddressedUpdate(instanceB, {
      kind: 'args',
      instanceId: 'b',
      storyId,
      args: { label: 'Only B' },
    });
    applyAddressedUpdate(instanceA, {
      kind: 'globals',
      instanceId: 'a',
      globals: { viewport: 'mobile' },
    });

    resetAddressedPreview(instanceA);
    expect(instanceA.args.get(storyId)).toEqual(initialArgs);
    expect(instanceA.globals.get()).toEqual(initialGlobals);
    expect(
      applyAddressedUpdate(instanceA, {
        kind: 'args',
        instanceId: 'a',
        storyId,
        generation: 1,
        args: { label: 'Only A' },
      })
    ).toBe(false);

    reuseAddressedPreview(instanceA, {
      instanceId: 'a2',
      storyId,
      args: initialArgs,
      globals: initialGlobals,
    });
    expect(
      applyAddressedUpdate(instanceA, {
        kind: 'args',
        instanceId: 'b',
        storyId,
        args: { label: 'Only B' },
      })
    ).toBe(false);
    expect(instanceA.args.get(storyId)).toEqual(initialArgs);
    expect(instanceA.globals.get()).toEqual(initialGlobals);
    expect(instanceB.args.get(storyId)).toEqual({ label: 'Only B' });
    expect(instanceB.globals.get()).toEqual(initialGlobals);
  });
});
