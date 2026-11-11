import { cache } from 'storybook/internal/common';

import { nanoid } from 'nanoid';

export const SESSION_TIMEOUT = 1000 * 60 * 60 * 2; // 2h

interface Session {
  id: string;
  lastUsed: number;
}

let sessionId: string | undefined;

export const resetSessionIdForTest = (val: string | undefined = undefined) => {
  sessionId = val;
};

// Synchronous so an event is fully built, and can be handed off on exit, without an await in between.
export const getSessionId = () => {
  const now = Date.now();
  if (!sessionId) {
    const session = cache.getSync<Session | undefined>('session');
    sessionId = session && session.lastUsed >= now - SESSION_TIMEOUT ? session.id : nanoid();
  }
  try {
    cache.setSync('session', { id: sessionId, lastUsed: now });
  } catch {
    // An unwritable cache must not cost the event; the session just restarts next time.
  }
  return sessionId;
};
