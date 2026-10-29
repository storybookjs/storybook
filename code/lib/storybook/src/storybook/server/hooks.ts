import {
  declareHooks,
  type Collect,
  type HookContext,
  type Notify,
  type Reduce,
} from '@storybook/core';
import type { Channel } from '@storybook/core/internal/channels';
import type { StorybookConfigRaw, ServerApp } from '@storybook/core/internal/types';
import type { RuntimeInstanceRecord } from './utils/runtime-instance-registry.ts';

/** Write a plugin's files into a static build's output directory. */
export type StaticOutputWriter = (output: {
  /** Absolute output directory of the static build. */
  outputDir: string;
}) => Promise<void>;

declare module '@storybook/core' {
  interface StorybookHooks {
    'server:security:extend': Reduce<
      (value: StorybookConfigRaw['security'], ctx?: HookContext) => StorybookConfigRaw['security']
    >;
    'server:app:extend': Reduce<(app: ServerApp, ctx?: HookContext) => ServerApp>;
    'server:channel:ready': Notify<(channel: Channel, ctx?: HookContext) => void>;
    'server:mcp:extend': Reduce<
      (value: RuntimeInstanceRecord['mcp']) => RuntimeInstanceRecord['mcp']
    >;
    'server:api:extend': Reduce<
      (
        api: Record<string, (...args: never[]) => unknown>,
        ctx?: HookContext
      ) => Record<string, (...args: never[]) => unknown>
    >;
    'server:static-output:collect': Collect<
      (writers: StaticOutputWriter[], ctx?: HookContext) => StaticOutputWriter[]
    >;
    /** Also declared by the Webpack builder; the product's `builder:babel:extend` default reads it. */
    'builder:babel-default:extend': Reduce<
      (config: Record<string, unknown> | undefined, ctx?: HookContext) => Record<string, unknown>
    >;
  }
}

declareHooks({
  'server:security:extend': 'reduce',
  'server:app:extend': 'reduce',
  'server:channel:ready': 'notify',
  'server:mcp:extend': 'reduce',
  'server:api:extend': 'reduce',
  'server:static-output:collect': 'collect',
  'builder:babel-default:extend': 'reduce',
});
