import * as v from 'valibot';

import type { Channel } from '../../../channels/main.ts';
import { defineService } from '../service-definition.ts';
import { SERVICE_ENTRY, entryStampKey, type EntryPayload } from '../service-channel.ts';
import { createServiceRuntime } from '../service-runtime.ts';
import { createReconciler, type LogWindow, type Reconciler } from '../service-sync.ts';
import { connectServiceToChannel } from '../service-transport.ts';
import { serviceRegistryApi } from '../service-registry.ts';
import type { NodeId, VirtualNetwork } from './network.ts';

export type SimState = {
  slots: Record<string, string>;
  nest: Record<string, Record<string, string>>;
};

export const simServiceDef = defineService({
  id: 'internal-fixture/osa-sim',
  description: 'Harness service for open-service sync simulation.',
  initialState: {
    slots: {} as Record<string, string>,
    nest: {} as Record<string, Record<string, string>>,
  } satisfies SimState,
  queries: {
    snapshot: {
      description: 'Full harness state.',
      input: v.void(),
      output: v.object({
        slots: v.record(v.string(), v.string()),
        nest: v.record(v.string(), v.record(v.string(), v.string())),
      }),
      handler: (_input, ctx) => ({
        slots: { ...ctx.self.state.slots },
        nest: Object.fromEntries(
          Object.entries(ctx.self.state.nest).map(([key, value]) => [key, { ...value }])
        ),
      }),
    },
  },
  commands: {
    setSlot: {
      description: 'Writes one slot.',
      input: v.object({ slot: v.string(), value: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.value;
        });
      },
    },
    setNested: {
      description: 'Writes a nested key. The parent object must already exist.',
      input: v.object({ parent: v.string(), key: v.string(), value: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.nest[input.parent][input.key] = input.value;
        });
      },
    },
    addParent: {
      description: 'Creates an empty nested parent object.',
      input: v.object({ parent: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.nest[input.parent] = {};
        });
      },
    },
    writeWaitWrite: {
      description: 'Writes a slot, waits holdMs, then writes the same slot again.',
      input: v.object({
        slot: v.string(),
        first: v.string(),
        second: v.string(),
        holdMs: v.number(),
      }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.first;
        });
        await new Promise<void>((resolve) => {
          setTimeout(resolve, input.holdMs);
        });
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.second;
        });
      },
    },
    writeThenThrow: {
      description: 'Writes a slot, waits holdMs, then throws before a second write.',
      input: v.object({ slot: v.string(), value: v.string(), holdMs: v.number() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.value;
        });
        await new Promise<void>((resolve) => {
          setTimeout(resolve, input.holdMs);
        });
        throw new Error(`writeThenThrow failed after writing ${input.slot}`);
      },
    },
    copyParent: {
      description: 'Assigns one nested parent to another key inside the same recipe.',
      input: v.object({ from: v.string(), to: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.nest[input.to] = state.nest[input.from];
        });
      },
    },
    writeChildThenReplaceParent: {
      description: 'Writes a nested key, then replaces its parent in the same recipe.',
      input: v.object({ parent: v.string(), key: v.string(), value: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.nest[input.parent][input.key] = input.value;
          state.nest[input.parent] = { only: input.value };
        });
      },
    },
    removeSlot: {
      description: 'Deletes a slot key.',
      input: v.object({ slot: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          delete state.slots[input.slot];
        });
      },
    },
    unsetSlot: {
      description: 'Assigns undefined to a slot key, which the recorder emits as a remove.',
      input: v.object({ slot: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          (state.slots as Record<string, string | undefined>)[input.slot] = undefined;
        });
      },
    },
    holdThenSetSlot: {
      description: 'Waits holdMs, then writes a slot. For overlapping local commands.',
      input: v.object({ slot: v.string(), value: v.string(), holdMs: v.number() }),
      output: v.void(),
      handler: async (input, ctx) => {
        if (input.holdMs > 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, input.holdMs);
          });
        }
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.value;
        });
      },
    },
  },
});

export type Replica = {
  id: NodeId;
  relay: boolean;
  runtimeId: string;
  reconciler: Reconciler;
  commands: ReturnType<typeof connectServiceToChannel>['commands'];
  queries: ReturnType<
    typeof createServiceRuntime<
      SimState,
      typeof simServiceDef.queries,
      typeof simServiceDef.commands
    >
  >['queries'];
  getState: () => SimState;
  disconnect: () => void;
  authored: EntryPayload['stamp'][];
  entryEmits: Map<string, number>;
  subscriberNotifications: number;
};

export function attachReplica(options: {
  network: VirtualNetwork;
  id: NodeId;
  relay: boolean;
  window?: Partial<LogWindow>;
}): Replica {
  const { network, id, relay, window } = options;
  const channel: Channel = network.channel(id);
  const runtimeId = id;
  const runtime = createServiceRuntime(simServiceDef, { registryApi: serviceRegistryApi });

  const reconciler = createReconciler({
    serviceId: simServiceDef.id,
    setState: (mutate) => runtime.applyLocal((state) => mutate(state as Record<string, unknown>)),
    window,
  });

  const commandNames = Object.keys(simServiceDef.commands);
  const { commands, disconnect } = connectServiceToChannel({
    serviceId: simServiceDef.id,
    ownRuntimeId: runtimeId,
    reconciler,
    getSnapshot: () => runtime.getStateSnapshot() as Record<string, unknown>,
    channel,
    relay,
    commands: runtime.commands as Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames: new Set(commandNames),
    commandNames,
    delegated: false,
    runtime,
  });

  const authored: Replica['authored'] = [];
  const entryEmits = new Map<string, number>();
  const originalEmit = channel.emit.bind(channel);
  channel.emit = ((eventName: string, ...args: unknown[]) => {
    if (eventName === SERVICE_ENTRY) {
      const payload = args[0] as EntryPayload;
      const key = entryStampKey(payload.stamp);
      entryEmits.set(key, (entryEmits.get(key) ?? 0) + 1);
      if (payload.stamp.runtimeId === runtimeId) {
        authored.push(payload.stamp);
      }
    }
    return originalEmit(eventName, ...args);
  }) as Channel['emit'];

  let subscriberNotifications = 0;
  runtime.queries.snapshot.subscribe(undefined, () => {
    subscriberNotifications += 1;
  });

  return {
    id,
    relay,
    runtimeId,
    reconciler,
    commands,
    queries: runtime.queries,
    getState: () => runtime.getStateSnapshot(),
    disconnect,
    authored,
    entryEmits,
    get subscriberNotifications() {
      return subscriberNotifications;
    },
  };
}
