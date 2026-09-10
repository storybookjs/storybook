import * as v from 'valibot';

import type { Channel } from '../../../channels/main.ts';
import { defineService } from '../service-definition.ts';
import { SERVICE_ENTRY, type EntryPayload } from '../service-channel.ts';
import { createServiceRuntime } from '../service-runtime.ts';
import {
  createSnapshotReconciler,
  type LogWindow,
  type SnapshotReconciler,
} from '../service-sync.ts';
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
  reconciler: SnapshotReconciler;
  commands: ReturnType<typeof connectServiceToChannel>['commands'];
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
  const runtime = createServiceRuntime(
    simServiceDef,
    { registryApi: serviceRegistryApi },
    structuredClone(simServiceDef.initialState)
  );

  const reconciler = createSnapshotReconciler({
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, runtimeId },
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
      const key = `${payload.stamp.seq}:${payload.stamp.runtimeId}:${payload.stamp.counter}`;
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
    getState: () => runtime.getStateSnapshot(),
    disconnect,
    authored,
    entryEmits,
    get subscriberNotifications() {
      return subscriberNotifications;
    },
  };
}
