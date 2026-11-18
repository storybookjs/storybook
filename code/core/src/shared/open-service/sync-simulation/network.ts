import { Channel } from '../../../channels/main.ts';
import type { ChannelEvent, ChannelTransport } from '../../../channels/types.ts';

export type NodeId = string;

export type WireFrame = {
  from: NodeId;
  to: NodeId;
  type: string;
  bytes: number;
  payload: unknown;
};

type DirectedLink = {
  from: NodeId;
  to: NodeId;
  delayMs: number;
  availableAt: number;
  dropNext: number;
  duplicateNext: number;
  held: boolean;
};

type Delivery = {
  at: number;
  order: number;
  link: DirectedLink;
  event: ChannelEvent;
};

function directedKey(from: NodeId, to: NodeId): string {
  return `${from}->${to}`;
}

function undirectedKey(a: NodeId, b: NodeId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export class VirtualNetwork {
  readonly frames: WireFrame[] = [];
  private readonly channels = new Map<NodeId, Channel>();
  private readonly links = new Map<string, DirectedLink>();
  private readonly deliveries: Delivery[] = [];
  private now = 0;
  private order = 0;

  constructor(nodes: readonly NodeId[], edges: ReadonlyArray<readonly [NodeId, NodeId]>) {
    const incident = new Map<NodeId, NodeId[]>();
    for (const id of nodes) {
      incident.set(id, []);
    }
    for (const [left, right] of edges) {
      incident.get(left)?.push(right);
      incident.get(right)?.push(left);
      this.links.set(directedKey(left, right), this.createLink(left, right));
      this.links.set(directedKey(right, left), this.createLink(right, left));
    }

    for (const id of nodes) {
      const peers = incident.get(id) ?? [];
      const transports: ChannelTransport[] = peers.map((peer) => this.createTransport(id, peer));
      this.channels.set(id, new Channel({ transports }));
    }
  }

  channel(id: NodeId): Channel {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error(`Unknown network node ${id}`);
    }
    return channel;
  }

  setDelay(a: NodeId, b: NodeId, delayMs: number): void {
    const forward = this.links.get(directedKey(a, b));
    const back = this.links.get(directedKey(b, a));
    if (!forward || !back) {
      throw new Error(`No link ${undirectedKey(a, b)}`);
    }
    forward.delayMs = delayMs;
    back.delayMs = delayMs;
  }

  dropNext(from: NodeId, to: NodeId, count = 1): void {
    this.link(from, to).dropNext += count;
  }

  duplicateNext(from: NodeId, to: NodeId, count = 1): void {
    this.link(from, to).duplicateNext += count;
  }

  hold(from: NodeId, to: NodeId): void {
    this.link(from, to).held = true;
  }

  release(from: NodeId, to: NodeId): void {
    this.link(from, to).held = false;
  }

  drain(): void {
    let steps = 0;
    while (this.deliverNext()) {
      steps += 1;
      if (steps > 10_000) {
        throw new Error('VirtualNetwork drain exceeded 10000 steps');
      }
    }
  }

  drainDue(): void {
    let steps = 0;
    while (this.deliverDue()) {
      steps += 1;
      if (steps > 10_000) {
        throw new Error('VirtualNetwork drainDue exceeded 10000 steps');
      }
    }
  }

  private createLink(from: NodeId, to: NodeId): DirectedLink {
    return {
      from,
      to,
      delayMs: 0,
      availableAt: 0,
      dropNext: 0,
      duplicateNext: 0,
      held: false,
    };
  }

  private link(from: NodeId, to: NodeId): DirectedLink {
    const link = this.links.get(directedKey(from, to));
    if (!link) {
      throw new Error(`No directed link ${directedKey(from, to)}`);
    }
    return link;
  }

  private createTransport(from: NodeId, to: NodeId): ChannelTransport {
    return {
      setHandler: () => undefined,
      send: (event) => {
        this.enqueue(from, to, event);
      },
    };
  }

  private enqueue(from: NodeId, to: NodeId, event: ChannelEvent): void {
    const link = this.link(from, to);
    if (link.dropNext > 0) {
      link.dropNext -= 1;
      return;
    }
    const copies = 1 + link.duplicateNext;
    link.duplicateNext = 0;
    for (let index = 0; index < copies; index += 1) {
      const at = Math.max(this.now, link.availableAt) + link.delayMs;
      link.availableAt = at;
      this.deliveries.push({ at, order: this.order, link, event });
      this.order += 1;
    }
  }

  private deliverNext(): boolean {
    this.deliveries.sort((left, right) => left.at - right.at || left.order - right.order);
    const index = this.deliveries.findIndex((delivery) => !delivery.link.held);
    if (index < 0) {
      return false;
    }
    return this.deliverAt(index);
  }

  private deliverDue(): boolean {
    this.deliveries.sort((left, right) => left.at - right.at || left.order - right.order);
    const index = this.deliveries.findIndex(
      (delivery) => !delivery.link.held && delivery.at <= this.now
    );
    if (index < 0) {
      return false;
    }
    return this.deliverAt(index);
  }

  private deliverAt(index: number): true {
    const delivery = this.deliveries.splice(index, 1)[0];
    this.now = Math.max(this.now, delivery.at);
    this.frames.push({
      from: delivery.link.from,
      to: delivery.link.to,
      type: delivery.event.type,
      bytes: JSON.stringify(delivery.event).length,
      payload: delivery.event.args[0],
    });
    this.channels.get(delivery.link.to)?.receive(delivery.event);
    return true;
  }
}
