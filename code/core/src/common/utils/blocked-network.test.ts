import { describe, expect, it } from 'vitest';

import { detectBlockedNetwork } from './blocked-network.ts';

function systemError(message: string, code: string, syscall: string) {
  return Object.assign(new Error(message), { code, syscall });
}

describe('detectBlockedNetwork', () => {
  it('recognizes a refused listen from its code and syscall', () => {
    expect(
      detectBlockedNetwork(
        systemError('listen EPERM: operation not permitted ::1:63315', 'EPERM', 'listen')
      )
    ).toEqual({ operation: 'listen', detail: 'listen EPERM: operation not permitted ::1:63315' });
  });

  it('recognizes a refused connect, also with EACCES', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect EACCES 127.0.0.1:6006 - Local (0.0.0.0:0)', 'EACCES', 'connect')
      )
    ).toEqual({
      operation: 'connect',
      detail: 'connect EACCES 127.0.0.1:6006 - Local (0.0.0.0:0)',
    });
  });

  it('recognizes an error serialized over a channel, which keeps only its message', () => {
    expect(
      detectBlockedNetwork({
        name: 'Error',
        message: 'listen EPERM: operation not permitted ::1:63315',
        stack: 'Error: listen EPERM: operation not permitted ::1:63315\n    at node:net:1918:21',
      })
    ).toEqual({ operation: 'listen', detail: 'listen EPERM: operation not permitted ::1:63315' });
  });

  it('looks through causes and aggregate errors', () => {
    const blocked = systemError('connect EPERM ::1:6006', 'EPERM', 'connect');
    expect(
      detectBlockedNetwork(new Error('disconnected', { cause: new AggregateError([blocked]) }))
    ).toMatchObject({ operation: 'connect' });
  });

  it('leaves errors that a sandbox does not cause alone', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect ECONNREFUSED 127.0.0.1:6006', 'ECONNREFUSED', 'connect')
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork(systemError('listen EADDRINUSE :::6006', 'EADDRINUSE', 'listen'))
    ).toBeUndefined();
    // A permission error on a file is not about the network.
    expect(
      detectBlockedNetwork(
        systemError("EPERM: operation not permitted, open '/x'", 'EPERM', 'open')
      )
    ).toBeUndefined();
    expect(detectBlockedNetwork('listen EPERM')).toBeUndefined();
    expect(detectBlockedNetwork(undefined)).toBeUndefined();
  });
});
