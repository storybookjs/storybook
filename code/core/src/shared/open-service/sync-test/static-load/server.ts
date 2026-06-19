import { registerService } from 'storybook/internal/common';

import { staticLoadSyncServiceDef, type StaticLoadDemoState } from './definition.ts';

export function registerStaticLoadSyncService() {
  return registerService(staticLoadSyncServiceDef, {
    commands: {
      computeEntry: {
        handler: async (input, ctx) => {
          ctx.self.setState((state: StaticLoadDemoState) => {
            state.entries[input.id] = `static-load:${input.id}`;
          });
        },
      },
      computeUnbacked: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state: StaticLoadDemoState) => {
            state.unbacked = 'static-load:unbacked';
          });
        },
      },
    },
  });
}
