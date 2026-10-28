import '../preview/hooks.ts';
import '../story-index/hooks.ts';

import { describe, expect, it } from 'vitest';

import { createHookRuntime, declareHooks } from './hooks.ts';
import type { Collect, Notify, Reduce, StorybookHooks } from './index.ts';

declare module './hooks.ts' {
  interface StorybookHooks {
    'example:declared:extend': Reduce<(value: number) => number>;
    'example:number:transform': Reduce<(value: number, step: number) => number>;
    'example:files:collect': Collect<(prefix: string) => string[]>;
    'example:event:received': Notify<(value: string) => void>;
  }
}

describe('instance hooks', () => {
  it.each([
    { register: 'legacy:core:extend', call: 'core:config:extend' },
    { register: 'core:config:extend', call: 'legacy:core:extend' },
  ] as const)(
    'reaches one hook through the deprecated alias: $register → $call',
    async ({ register, call }) => {
      const hooks = createHookRuntime();
      hooks.hook(register as 'core:config:extend', (core) => ({ ...core, disableTelemetry: true }));
      hooks.hook('core:config:extend', (core) => ({ ...core, disableWhatsNewNotifications: true }));
      expect(await hooks.callHook(call as 'core:config:extend', {})).toMatchInlineSnapshot(`
      {
        "disableTelemetry": true,
        "disableWhatsNewNotifications": true,
      }
    `);
    }
  );
  it('transforms a collection accumulator between native and legacy contributions', async () => {
    const hooks = createHookRuntime();
    hooks.hook('preview:annotations:collect', () => ['first']);
    hooks.hook('preview:annotations:collect', async (value) => ['prepended', ...value], 'reduce');
    hooks.hookLegacy(
      'preview:annotations:collect',
      (value: string[]) => [...value, 'legacy'],
      'collect'
    );
    hooks.hook('preview:annotations:collect', () => ['last']);
    expect(await hooks.callHook('preview:annotations:collect', ['seed'])).toEqual([
      'prepended',
      'seed',
      'first',
      'legacy',
      'last',
    ]);
  });
  it('keeps override handlers after native and legacy handlers regardless of setup order', async () => {
    const hooks = createHookRuntime();
    hooks.setRegistrationOrder(1);
    hooks.hook('example:declared:extend', (value) => value * 10, 'reduce', 'override');
    hooks.hook('example:declared:extend', (value) => value + 1, 'reduce');
    hooks.hookLegacy('example:declared:extend', (value: number) => value + 2, 'reduce', 2);
    expect(await hooks.callHook('example:declared:extend', 0)).toBe(30);
  });

  it('uses declarations for the first registration and rejects conflicting strategies', async () => {
    declareHooks({ 'example:declared:extend': 'reduce' });
    const hooks = createHookRuntime();
    hooks.hook('example:declared:extend', (value) => value + 1);
    expect(await hooks.callHook('example:declared:extend', 1)).toBe(2);
    expect(() => hooks.hookLegacy('example:declared:extend', () => [], 'collect')).toThrow(
      'already uses "reduce"'
    );
  });

  it.each([
    { initial: 1, step: 2, expected: 8 },
    { initial: 3, step: 4, expected: 18 },
  ])('reduces $initial with step $step to $expected', async ({ initial, step, expected }) => {
    const hooks = createHookRuntime();
    hooks.hook('example:number:transform', (value, step) => value + step, 'reduce');
    hooks.hook('example:number:transform', async (value, step) => value * 2 + step);
    expect(await hooks.callHook('example:number:transform', initial, step)).toBe(expected);
  });

  it.each([false, true])(
    'concatenates sync and async results (async first: %s)',
    async (asyncFirst) => {
      const hooks = createHookRuntime();
      hooks.hook(
        'example:files:collect',
        (prefix) => (asyncFirst ? Promise.resolve([`${prefix}/a`]) : [`${prefix}/a`]),
        'collect'
      );
      hooks.hook('example:files:collect', async (prefix) => [`${prefix}/b`, `${prefix}/c`]);
      expect(await hooks.callHook('example:files:collect', 'src')).toMatchInlineSnapshot(`
      [
        "src/a",
        "src/b",
        "src/c",
      ]
    `);
    }
  );

  it('awaits notifications in order and returns no result', async () => {
    const hooks = createHookRuntime();
    const calls: string[] = [];
    hooks.hook(
      'example:event:received',
      async (value) => {
        await Promise.resolve();
        calls.push(`first:${value}`);
      },
      'notify'
    );
    hooks.hook('example:event:received', (value) => {
      calls.push(`second:${value}`);
    });
    expect({ result: await hooks.callHook('example:event:received', 'ready'), calls })
      .toMatchInlineSnapshot(`
      {
        "calls": [
          "first:ready",
          "second:ready",
        ],
        "result": undefined,
      }
    `);
  });

  it.each(['index:indexers:collect', 'preview:annotations:collect'] as const)(
    'provides an empty %s collection before any handlers register',
    async (name) => {
      expect(await createHookRuntime().callHook(name, [])).toMatchInlineSnapshot(`[]`);
    }
  );

  it.each(['example:files:collect', 'example:event:received'] as const)(
    'rejects calling %s before its strategy is registered',
    async (name) => {
      await expect(createHookRuntime().callHook(name, 'src')).rejects.toThrow(
        `Unknown hook "${name}".`
      );
    }
  );

  it.each(['example:files:collect', 'example:event:received'] as const)(
    'requires a strategy on the first registration of %s',
    (name) => {
      expect(() => createHookRuntime().hook(name, () => [])).toThrow(
        `Declare a runtime combination strategy when registering hook "${name}".`
      );
    }
  );

  it.each(['example', 'example:files', 'example:files:collect:extra', ':files:collect'])(
    'rejects the invalid name %s',
    (name) => {
      expect(() =>
        createHookRuntime().hook(name as keyof StorybookHooks, () => [], 'collect')
      ).toThrow(`Hook names must follow owner:subject:verb: "${name}".`);
    }
  );
});
