import { attachReplica, type Replica } from './replicas.ts';
import { VirtualNetwork, type NodeId } from './network.ts';
import type { LogWindow } from '../service-sync.ts';

export type TopologyKind = 'dev-triangle' | 'production-fan' | 'two-tabs';

type Topology = {
  name: TopologyKind;
  nodes: Array<{ id: NodeId; relay: boolean }>;
  edges: Array<readonly [NodeId, NodeId]>;
};

export const topologies: Record<TopologyKind, Topology> = {
  'dev-triangle': {
    name: 'dev-triangle',
    nodes: [
      { id: 'server', relay: true },
      { id: 'manager', relay: true },
      { id: 'preview', relay: false },
    ],
    edges: [
      ['server', 'manager'],
      ['server', 'preview'],
      ['manager', 'preview'],
    ],
  },
  'production-fan': {
    name: 'production-fan',
    nodes: [
      { id: 'manager', relay: true },
      { id: 'p1', relay: false },
      { id: 'p2', relay: false },
    ],
    edges: [
      ['manager', 'p1'],
      ['manager', 'p2'],
    ],
  },
  'two-tabs': {
    name: 'two-tabs',
    nodes: [
      { id: 'server', relay: true },
      { id: 'ma', relay: true },
      { id: 'pa', relay: false },
      { id: 'mb', relay: true },
      { id: 'pb', relay: false },
    ],
    edges: [
      ['server', 'ma'],
      ['server', 'pa'],
      ['ma', 'pa'],
      ['server', 'mb'],
      ['server', 'pb'],
      ['mb', 'pb'],
    ],
  },
};

export type World = {
  topology: Topology;
  network: VirtualNetwork;
  replicas: Replica[];
  replica: (id: NodeId) => Replica;
  join: (id: NodeId, options?: { window?: Partial<LogWindow> }) => Replica;
  disconnect: () => void;
};

export function createWorld(
  topology: Topology,
  options?: { skip?: readonly NodeId[]; windows?: Partial<Record<NodeId, Partial<LogWindow>>> }
): World {
  const skipped = new Set(options?.skip ?? []);
  const windows = options?.windows ?? {};
  const network = new VirtualNetwork(
    topology.nodes.map((node) => node.id),
    topology.edges
  );
  const replicas: Replica[] = [];
  const byId = new Map<NodeId, Replica>();

  const join = (id: NodeId, extra?: { window?: Partial<LogWindow> }): Replica => {
    if (byId.has(id)) {
      throw new Error(`Replica ${id} is already joined`);
    }
    const node = topology.nodes.find((candidate) => candidate.id === id);
    if (!node) {
      throw new Error(`Unknown replica ${id}`);
    }
    const replica = attachReplica({
      network,
      id: node.id,
      relay: node.relay,
      window: extra?.window ?? windows[id],
    });
    replicas.push(replica);
    byId.set(id, replica);
    return replica;
  };

  for (const node of topology.nodes) {
    if (!skipped.has(node.id)) {
      join(node.id);
    }
  }

  return {
    topology,
    network,
    replicas,
    replica: (id) => {
      const replica = byId.get(id);
      if (!replica) {
        throw new Error(`Unknown replica ${id}`);
      }
      return replica;
    },
    join,
    disconnect: () => {
      for (const replica of replicas) {
        replica.disconnect();
      }
    },
  };
}
