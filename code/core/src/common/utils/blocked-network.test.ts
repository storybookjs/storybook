import { describe, expect, it } from 'vitest';

import { detectBlockedNetwork } from './blocked-network.ts';

function systemError(message: string, code: string, syscall: string) {
  return Object.assign(new Error(message), { code, syscall });
}

describe('detectBlockedNetwork', () => {
  it('recognizes a blocked listen or connect', () => {
    expect(
      detectBlockedNetwork(
        systemError('listen EPERM: operation not permitted ::1:63315', 'EPERM', 'listen')
      )
    ).toEqual({ operation: 'listen', detail: 'listen EPERM: operation not permitted ::1:63315' });
    expect(
      detectBlockedNetwork(systemError('connect EPERM 127.0.0.1:6006', 'EPERM', 'connect'))
    ).toEqual({ operation: 'connect', detail: 'connect EPERM 127.0.0.1:6006' });
  });

  it('leaves EACCES alone, which reserved and privileged ports give outside any sandbox', () => {
    expect(
      detectBlockedNetwork(
        systemError('listen EACCES: permission denied ::1:63315', 'EACCES', 'listen')
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork({ message: 'listen EACCES: permission denied ::1:80' })
    ).toBeUndefined();
  });

  it('recognizes an error serialized over a channel, which keeps only its message', () => {
    expect(
      detectBlockedNetwork({
        name: 'Error',
        message: 'listen EPERM: operation not permitted ::1:63315',
      })
    ).toEqual({ operation: 'listen', detail: 'listen EPERM: operation not permitted ::1:63315' });
  });

  it('looks through causes and the errors of a connect to localhost', () => {
    const localhost = new AggregateError(
      [systemError('connect EPERM ::1:6006', 'EPERM', 'connect')],
      ''
    );
    expect(detectBlockedNetwork(new Error('disconnected', { cause: localhost }))).toEqual({
      operation: 'connect',
      detail: 'connect EPERM ::1:6006',
    });
  });

  it('leaves other errors alone', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect ECONNREFUSED 127.0.0.1:6006', 'ECONNREFUSED', 'connect')
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork(
        systemError("EPERM: operation not permitted, open '/x'", 'EPERM', 'open')
      )
    ).toBeUndefined();
    expect(detectBlockedNetwork(undefined)).toBeUndefined();
  });
});
