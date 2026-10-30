export type PoolSession = {
  frameId: string;
  occupantId: string | null;
};

export type PoolAssignment = {
  frameId: string;
  instanceId: string;
  reused: boolean;
};

export type ViewportPoolPlan = {
  assignments: PoolAssignment[];
  dropFrameIds: string[];
};

export function nextFrameId(frameIds: readonly string[]): string {
  const used = new Set(frameIds);
  let n = 1;
  while (used.has(`frame-${n}`)) {
    n += 1;
  }
  return `frame-${n}`;
}

export function planViewportPool(
  sessions: readonly PoolSession[],
  visible: readonly string[]
): ViewportPoolPlan {
  const visibleIds = unique(visible);
  const visibleSet = new Set(visibleIds);
  const assignments: PoolAssignment[] = [];
  const recyclable: PoolSession[] = [];
  const seated = new Set<string>();

  for (const session of sessions) {
    if (session.occupantId && visibleSet.has(session.occupantId)) {
      assignments.push({
        frameId: session.frameId,
        instanceId: session.occupantId,
        reused: false,
      });
      seated.add(session.occupantId);
    } else {
      recyclable.push(session);
    }
  }

  const knownIds = sessions.map((session) => session.frameId);

  for (const instanceId of visibleIds) {
    if (seated.has(instanceId)) {
      continue;
    }
    const spare = recyclable.shift();
    if (spare) {
      assignments.push({
        frameId: spare.frameId,
        instanceId,
        reused: spare.occupantId !== null,
      });
      knownIds.push(spare.frameId);
    } else {
      const frameId = nextFrameId(knownIds);
      knownIds.push(frameId);
      assignments.push({ frameId, instanceId, reused: false });
    }
  }

  return {
    assignments,
    dropFrameIds: recyclable.map((session) => session.frameId),
  };
}

function unique(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}
