// Instantiation multipliers over the owner-usage graph.
//
// mult(C) = Σ over C's usage sites: site weight × mult(site's owner). A key
// nothing uses keeps the floor of 1 — today's "count once" behavior for
// pages, story-only components, and dead code alike.
//
// Cycles cannot be unrolled statically, so strongly connected components are
// condensed: every member of an SCC shares the sum of the edges entering the
// SCC from outside (1 when nothing enters), and intra-SCC edges feed nothing
// back — recursion is counted at depth 1. Sharing overstates a member the
// entries skip (see multipliers.test.ts), but it is order-independent and
// never lets `A ↔ B, page → A` zero out B, which per-member sums would.

export interface UsageEdge {
  from: string;
  to: string;
  weight: number;
}

/** Multiplier for every key appearing in an edge; absent keys mean 1. */
export function solveMultipliers(edges: UsageEdge[]): Map<string, number> {
  const outgoing = new Map<string, UsageEdge[]>();
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    const from = outgoing.get(edge.from);
    if (from === undefined) outgoing.set(edge.from, [edge]);
    else from.push(edge);
  }

  // Tarjan. Recursive: the depth is the longest render chain in the app,
  // which is nowhere near stack limits.
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const sccs: string[][] = [];
  const connect = (v: string): void => {
    indices.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const edge of outgoing.get(v) ?? []) {
      if (!indices.has(edge.to)) {
        connect(edge.to);
        low.set(v, Math.min(low.get(v)!, low.get(edge.to)!));
      } else if (onStack.has(edge.to)) {
        low.set(v, Math.min(low.get(v)!, indices.get(edge.to)!));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        scc.push(member);
      } while (member !== v);
      sccs.push(scc);
    }
  };
  for (const node of nodes) {
    if (!indices.has(node)) connect(node);
  }

  const sccOf = new Map<string, number>();
  sccs.forEach((scc, id) => {
    for (const member of scc) sccOf.set(member, id);
  });

  // Tarjan emits an SCC only after everything reachable from it, so walking
  // the list backwards visits sources before their targets.
  const entering = new Map<number, number>();
  const multipliers = new Map<string, number>();
  for (let id = sccs.length - 1; id >= 0; id -= 1) {
    const value = entering.get(id) ?? 1;
    for (const member of sccs[id]!) {
      multipliers.set(member, value);
      for (const edge of outgoing.get(member) ?? []) {
        const target = sccOf.get(edge.to)!;
        if (target !== id) {
          entering.set(target, (entering.get(target) ?? 0) + edge.weight * value);
        }
      }
    }
  }
  return multipliers;
}
