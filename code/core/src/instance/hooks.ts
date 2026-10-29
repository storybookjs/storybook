import type {
  CoreConfig,
  Options,
  Preset,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import { createHooks } from 'hookable';

import type { PreviewHooks } from '../preview/hooks.ts';
import type { ServiceHooks } from '../services/hooks.ts';
import type { IndexHooks } from '../story-index/hooks.ts';
import type { LegacyHooks } from './legacy-hooks.ts';
import type { Storybook } from './types.ts';

/** Pass each handler the previous handler's result. */
export type Reduce<T extends (...args: never[]) => unknown> = { kind: 'reduce'; handler: T };
/** Concatenate arrays returned by handlers, in registration order. */
export type Collect<T extends (...args: never[]) => unknown[]> = { kind: 'collect'; handler: T };
/** Await each handler without collecting its result. */
export type Notify<T extends (...args: never[]) => void> = { kind: 'notify'; handler: T };

/** Pass configuration context to hook handlers. */
export type HookContext = Partial<Options> & Record<string, unknown>;

/** Extend this interface in the package that owns a hook; core areas add theirs through `extends`. */
export interface StorybookHooks extends PreviewHooks, IndexHooks, ServiceHooks, LegacyHooks {
  'core:config:extend': Reduce<(value: CoreConfig | undefined, ctx?: HookContext) => CoreConfig>;
  /** @deprecated Use `core:config:extend`. Removed in Storybook 12. */
  'legacy:core:extend': Reduce<(value: CoreConfig | undefined, ctx?: HookContext) => CoreConfig>;
  'core:stories:collect': Collect<
    (value: StorybookConfigRaw['stories'], ctx?: HookContext) => StorybookConfigRaw['stories']
  >;
  'core:features:extend': Reduce<
    (
      value: StorybookConfigRaw['features'],
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['features']>
  >;
  'core:docs:extend': Reduce<
    (
      value: StorybookConfigRaw['docs'],
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['docs']>
  >;
  'core:tags:extend': Reduce<
    (
      value: StorybookConfigRaw['tags'],
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['tags']>
  >;
  'core:typescript:extend': Reduce<
    (
      value: StorybookConfigRaw['typescript'],
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['typescript']>
  >;
  'core:env:extend': Reduce<
    (value: StorybookConfigRaw['env'], ctx?: HookContext) => NonNullable<StorybookConfigRaw['env']>
  >;
  'core:build:extend': Reduce<
    (
      value: StorybookConfigRaw['build'],
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['build']>
  >;

  'core:framework:extend': Reduce<(value: Preset | undefined, ctx?: HookContext) => Preset>;
  'core:framework-options:extend': Reduce<
    (
      value: Record<string, unknown> | null | undefined,
      ctx?: HookContext
    ) => Record<string, unknown> | null
  >;

  'core:static-dirs:collect': Collect<
    (
      value: NonNullable<StorybookConfigRaw['staticDirs']>,
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['staticDirs']>
  >;
  /** Declared in core, as the docs toolset reads composed refs without the manager. */
  'manager:refs:extend': Reduce<
    (value: StorybookConfigRaw['refs'], ctx?: HookContext) => StorybookConfigRaw['refs']
  >;
  'core:instance:ready': Notify<(storybook: Storybook) => void>;
  'core:instance:close': Notify<(storybook: Storybook) => void>;
}

/** Read the combination strategy declared by a hook. */
export type HookKind<K extends keyof StorybookHooks> = StorybookHooks[K]['kind'];
/** Transform a list-seeded collection when adapting an accumulator-based preset. */
export type HookRegistrationKind<K extends keyof StorybookHooks> =
  | HookKind<K>
  | (HookKind<K> extends 'collect'
      ? HookArgs<K>[0] extends HookResult<K>
        ? 'reduce'
        : never
      : never);
/** Read the arguments accepted when calling a hook. */
export type HookArgs<K extends keyof StorybookHooks> = Parameters<StorybookHooks[K]['handler']>;
/** Read the resolved result of a hook call. */
export type HookResult<K extends keyof StorybookHooks> =
  HookKind<K> extends 'notify' ? void : ReturnType<StorybookHooks[K]['handler']>;
/** Allow synchronous or asynchronous handlers for a hook. */
export type HookHandler<K extends keyof StorybookHooks> = (
  ...args: HookArgs<K>
) => HookResult<K> | Promise<HookResult<K>>;

type RuntimeHandler = (...args: unknown[]) => unknown;
type Strategy = 'reduce' | 'collect' | 'notify';

export const LEGACY_HOOK_CALL = Symbol('legacy-hook-call');

/** Old hook names that still reach their renamed hook until Storybook 12. */
const HOOK_ALIASES: Record<string, string> = { 'legacy:core:extend': 'core:config:extend' };

const DECLARATIONS = Symbol.for('storybook.instance.hook-declarations');
/**
 * Process-wide on purpose: package-level name → strategy metadata, identical for every instance;
 * handlers and registration-time strategies stay on each instance's runtime.
 */
const DECLARED_KINDS = ((globalThis as Record<symbol, Map<string, Strategy>>)[DECLARATIONS] ??=
  new Map());

/** Register the runtime strategies alongside a package's hook types. */
export function declareHooks(declarations: { [K in keyof StorybookHooks]?: HookKind<K> }): void {
  for (const [name, kind] of Object.entries(declarations)) {
    validateName(name);
    const existing = DECLARED_KINDS.get(name);
    if (existing && existing !== kind) {
      throw new Error(`Hook "${name}" already uses "${existing}".`);
    }
    DECLARED_KINDS.set(name, kind);
  }
}

export function getHookKind(name: string): Strategy | undefined {
  return DECLARED_KINDS.get(name);
}

declareHooks({
  'core:config:extend': 'reduce',
  'core:stories:collect': 'collect',
  'core:features:extend': 'reduce',
  'core:docs:extend': 'reduce',
  'core:tags:extend': 'reduce',
  'core:typescript:extend': 'reduce',
  'core:env:extend': 'reduce',
  'core:build:extend': 'reduce',
  'core:framework:extend': 'reduce',
  'core:framework-options:extend': 'reduce',
  'core:static-dirs:collect': 'collect',
  'manager:refs:extend': 'reduce',
  'core:instance:ready': 'notify',
  'core:instance:close': 'notify',
});

export function createHookRuntime() {
  const hooks = createHooks<Record<string, (...args: unknown[]) => void>>();
  const strategies = new Map<string, Strategy>();
  const accumulatorHandlers = new WeakSet<RuntimeHandler>();
  const registrationOrders = new WeakMap<RuntimeHandler, number>();
  let registrationOrder = 0;

  function register(
    name: string,
    fn: RuntimeHandler,
    kind?: Strategy,
    order = registrationOrder
  ): RuntimeHandler {
    validateName(name);
    name = HOOK_ALIASES[name] ?? name;
    const declared = getHookKind(name);
    const existing = strategies.get(name) ?? declared;
    const strategy = kind ?? existing;
    if (!strategy) {
      throw new Error(`Declare a runtime combination strategy when registering hook "${name}".`);
    }
    if (existing && strategy !== existing) {
      throw new Error(`Hook "${name}" already uses "${existing}".`);
    }
    const handler: RuntimeHandler = (...args) => fn(...args);
    registrationOrders.set(handler, order);
    hooks.hook(name, handler as (...args: unknown[]) => void);
    strategies.set(name, strategy);
    return handler;
  }

  return {
    setRegistrationOrder(order: number): void {
      registrationOrder = order;
    },
    hook<K extends keyof StorybookHooks>(
      name: K,
      fn: HookHandler<K>,
      kind?: HookRegistrationKind<K>,
      stage?: 'override'
    ): void {
      name = (HOOK_ALIASES[name] ?? name) as K;
      const transform =
        (getHookKind(name) ?? strategies.get(name)) === 'collect' && kind === 'reduce';
      const handler = register(
        name,
        fn as RuntimeHandler,
        transform ? 'collect' : kind,
        stage === 'override' ? Number.MAX_SAFE_INTEGER : registrationOrder
      );
      if (transform) {
        accumulatorHandlers.add(handler);
      }
    },
    hookLegacy(
      name: string,
      fn: (...args: never[]) => unknown,
      kind: Strategy,
      order?: number
    ): void {
      const handler = register(name, fn as RuntimeHandler, kind, order);
      accumulatorHandlers.add(handler);
    },
    async callHook<K extends keyof StorybookHooks>(
      name: K,
      ...args: HookArgs<K>
    ): Promise<HookResult<K>> {
      name = (HOOK_ALIASES[name] ?? name) as K;
      const kind = strategies.get(name) ?? getHookKind(name);
      if (!kind) {
        throw new Error(`Unknown hook "${name}".`);
      }
      return hooks.callHookWith(
        async (handlers) => {
          const legacyCall = (args[1] as Record<symbol, unknown> | undefined)?.[LEGACY_HOOK_CALL];
          let result: unknown =
            kind === 'collect' && !legacyCall
              ? Array.isArray(args[0])
                ? [...args[0]]
                : []
              : args[0];
          const ordered = [...(handlers as RuntimeHandler[])].sort(
            (a, b) => registrationOrders.get(a)! - registrationOrders.get(b)!
          );
          for (const handler of ordered) {
            const accumulator = accumulatorHandlers.has(handler);
            const next = await handler(
              ...(kind === 'reduce' || (kind === 'collect' && accumulator)
                ? [result, ...args.slice(1)]
                : args)
            );
            if (kind === 'collect' && !accumulator) {
              result = [...(Array.isArray(result) ? result : []), ...(next as unknown[])];
            } else if (kind !== 'notify') {
              result = next;
            }
          }
          return (kind === 'notify' ? undefined : result) as HookResult<K>;
        },
        name,
        args
      );
    },
    /** Teardown must reach every handler, so dependants close first and failures are returned. */
    async callHookSettled<K extends keyof StorybookHooks>(
      name: K,
      ...args: HookArgs<K>
    ): Promise<unknown[]> {
      return hooks.callHookWith(
        async (handlers) => {
          const errors: unknown[] = [];
          const ordered = [...(handlers as RuntimeHandler[])]
            .sort((a, b) => registrationOrders.get(a)! - registrationOrders.get(b)!)
            .reverse();
          for (const handler of ordered) {
            try {
              await handler(...args);
            } catch (error) {
              errors.push(error);
            }
          }
          return errors;
        },
        name,
        args
      );
    },
    removeAllHooks(): void {
      hooks.removeAllHooks();
      strategies.clear();
    },
  };
}

function validateName(name: string): void {
  if (!/^[^:]+:[^:]+:[^:]+$/.test(name)) {
    throw new Error(`Hook names must follow owner:subject:verb: "${name}".`);
  }
}
