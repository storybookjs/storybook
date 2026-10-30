import { ManagerDocsError } from '../errors.ts';
import { storyFrameQuery } from '../preview-participant.ts';

export type SessionPlay = 'idle' | 'running' | 'paused' | 'done' | 'error';

export type SessionData = Record<string, unknown>;

export type Occupant = {
  instanceId: string;
  storyId: string;
  args: SessionData;
  argsFromIndex: boolean;
  globals: SessionData;
  play: SessionPlay;
  height: number | null;
  generation: number;
  search: string;
};

export type OccupantSpec = {
  instanceId: string;
  storyId: string;
  args: SessionData;
  argsFromIndex?: boolean;
  globals: SessionData;
};

export type IframeSession = {
  frameId: string;
  generation: number;
  channelAttached: boolean;
  occupant: Occupant | null;
};

export type SessionEvent = {
  instanceId: string;
  generation: number;
  args?: SessionData;
  globals?: SessionData;
  height?: number;
  play?: SessionPlay;
};

export type IframeHost = {
  sessions: IframeSession[];
};

/**
 * Create an empty iframe session. Nothing is attached and nothing is shown.
 */
export function createSession(frameId: string): IframeSession {
  return { frameId, generation: 1, channelAttached: false, occupant: null };
}

/**
 * Mark the session as a channel participant for its current generation.
 */
export function attachChannel(session: IframeSession): IframeSession {
  return { ...session, channelAttached: true };
}

/**
 * Drop the channel participant. In-flight events no longer match this generation after reset.
 */
export function detachChannel(session: IframeSession): IframeSession {
  return { ...session, channelAttached: false };
}

/**
 * Show one story in a session that is attached and empty.
 */
export function assignOccupant(session: IframeSession, spec: OccupantSpec): IframeSession {
  if (!session.channelAttached) {
    throw new ManagerDocsError(
      `Attach the channel on "${session.frameId}" before assigning an occupant.`
    );
  }
  if (session.occupant) {
    throw new ManagerDocsError(`Reset "${session.frameId}" before assigning a new occupant.`);
  }
  return {
    ...session,
    occupant: {
      instanceId: spec.instanceId,
      storyId: spec.storyId,
      args: structuredClone(spec.args),
      argsFromIndex: spec.argsFromIndex ?? false,
      globals: structuredClone(spec.globals),
      play: 'idle',
      height: null,
      generation: session.generation,
      search: storyFrameQuery(spec.storyId, spec.instanceId),
    },
  };
}

export function sessionFrameSearch(host: IframeHost, instanceId: string): string {
  const search = host.sessions.find((session) => session.occupant?.instanceId === instanceId)
    ?.occupant?.search;
  if (!search) {
    throw new ManagerDocsError(`No frame search for "${instanceId}".`);
  }
  return search;
}

/**
 * Replace the occupant's args. A different instance id is refused.
 */
export function updateArgs(
  session: IframeSession,
  instanceId: string,
  args: SessionData
): IframeSession {
  return updateOccupant(session, instanceId, {
    args: structuredClone(args),
    argsFromIndex: true,
  });
}

/**
 * Replace the occupant's globals overlay. A different instance id is refused.
 */
export function updateGlobals(
  session: IframeSession,
  instanceId: string,
  globals: SessionData
): IframeSession {
  return updateOccupant(session, instanceId, { globals: structuredClone(globals) });
}

/**
 * Record the occupant's measured height.
 */
export function setHeight(
  session: IframeSession,
  instanceId: string,
  height: number
): IframeSession {
  if (!Number.isFinite(height) || height < 0) {
    throw new ManagerDocsError(`Frame "${session.frameId}" cannot record a height of ${height}.`);
  }
  return updateOccupant(session, instanceId, { height });
}

/**
 * Record the occupant's play phase.
 */
export function setPlay(
  session: IframeSession,
  instanceId: string,
  play: SessionPlay
): IframeSession {
  return updateOccupant(session, instanceId, { play });
}

/**
 * Clear the occupant, detach the channel, and bump the generation so late events cannot apply.
 */
export function resetSession(session: IframeSession): IframeSession {
  return {
    frameId: session.frameId,
    generation: session.generation + 1,
    channelAttached: false,
    occupant: null,
  };
}

/**
 * Reset a session and show a new occupant. The next occupant does not inherit args, globals, or play.
 */
export function reuseSession(session: IframeSession, spec: OccupantSpec): IframeSession {
  return assignOccupant(attachChannel(resetSession(session)), spec);
}

/**
 * Apply an in-flight event only when the instance id and generation still match the occupant.
 */
export function applySessionEvent(
  session: IframeSession,
  event: SessionEvent
): { session: IframeSession; applied: boolean } {
  const occupant = session.occupant;
  if (
    !occupant ||
    occupant.instanceId !== event.instanceId ||
    occupant.generation !== event.generation
  ) {
    return { session, applied: false };
  }
  if (
    event.height !== undefined &&
    (typeof event.height !== 'number' || !Number.isFinite(event.height) || event.height < 0)
  ) {
    return { session, applied: false };
  }
  return {
    applied: true,
    session: {
      ...session,
      occupant: {
        ...occupant,
        ...(event.args ? { args: structuredClone(event.args) } : {}),
        ...(event.globals ? { globals: structuredClone(event.globals) } : {}),
        ...(event.height !== undefined ? { height: event.height } : {}),
        ...(event.play ? { play: event.play } : {}),
      },
    },
  };
}

/**
 * Create a host with no iframes.
 */
export function createIframeHost(): IframeHost {
  return { sessions: [] };
}

/**
 * Mount one new iframe for one instance. This does not recycle an existing frame.
 */
export function mountInstance(host: IframeHost, frameId: string, spec: OccupantSpec): IframeHost {
  if (host.sessions.some((session) => session.frameId === frameId)) {
    throw new ManagerDocsError(`Frame "${frameId}" is already mounted.`);
  }
  const session = assignOccupant(attachChannel(createSession(frameId)), spec);
  return { sessions: [...host.sessions, session] };
}

/**
 * Reset one existing frame and show a different instance in it.
 */
export function reuseInstance(host: IframeHost, frameId: string, spec: OccupantSpec): IframeHost {
  const index = host.sessions.findIndex((session) => session.frameId === frameId);
  if (index === -1) {
    throw new ManagerDocsError(`Frame "${frameId}" is not mounted.`);
  }
  const sessions = host.sessions.slice();
  sessions[index] = reuseSession(host.sessions[index], spec);
  return { sessions };
}

function updateOccupant(
  session: IframeSession,
  instanceId: string,
  patch: Partial<Pick<Occupant, 'args' | 'argsFromIndex' | 'globals' | 'height' | 'play'>>
): IframeSession {
  if (!session.occupant || session.occupant.instanceId !== instanceId) {
    throw new ManagerDocsError(`Frame "${session.frameId}" is not occupied by "${instanceId}".`);
  }
  return { ...session, occupant: { ...session.occupant, ...patch } };
}
