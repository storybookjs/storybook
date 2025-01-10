import { cache } from '@storybook/core/common';

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

export const getSessionId = async () => {
  const now = Date.now();
  if (!sessionId) {
    const session: Session | undefined = await cache.get('session');
    if (session && session.lastUsed >= now - SESSION_TIMEOUT) {
      sessionId = session.id;
    } else {
      sessionId = nanoid();
    }
  }
  await cache.set('session', { id: sessionId, lastUsed: now });
  return sessionId;
};
