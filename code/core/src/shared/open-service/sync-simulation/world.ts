import { attachReplica, type Replica } from './replicas.ts';
import { VirtualNetwork, type NodeId } from './network.ts';

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
  disconnect: () => void;
};

export function createWorld(topology: Topology): World {
  const network = new VirtualNetwork(
    topology.nodes.map((node) => node.id),
    topology.edges
  );
  const replicas = topology.nodes.map((node) =>
    attachReplica({ network, id: node.id, relay: node.relay })
  );
  const byId = new Map(replicas.map((replica) => [replica.id, replica]));

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
    disconnect: () => {
      for (const replica of replicas) {
        replica.disconnect();
      }
    },
  };
}
