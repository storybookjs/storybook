import { declareHooks, type HookContext, type Notify, type Reduce } from '@storybook/core';
import type { Channel } from '@storybook/core/internal/channels';
import type { StorybookConfigRaw, ServerApp } from '@storybook/core/internal/types';
import type { RuntimeInstanceRecord } from './utils/runtime-instance-registry.ts';

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
  }
}

declareHooks({
  'server:security:extend': 'reduce',
  'server:app:extend': 'reduce',
  'server:channel:ready': 'notify',
  'server:mcp:extend': 'reduce',
  'server:api:extend': 'reduce',
});
