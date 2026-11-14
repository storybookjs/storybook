import { describe, expect, it } from 'vitest';

import { describeBlockedNetwork, detectBlockedNetwork } from './blocked-network.ts';

function systemError(message: string, fields: Record<string, unknown>) {
  return Object.assign(new Error(message), fields);
}

describe('detectBlockedNetwork', () => {
  it('recognizes a refused listen from its code and syscall', () => {
    expect(
      detectBlockedNetwork(
        systemError('listen EPERM: operation not permitted ::1:63315', {
          code: 'EPERM',
          syscall: 'listen',
          address: '::1',
          port: 63315,
        })
      )
    ).toEqual({
      operation: 'listen',
      code: 'EPERM',
      detail: 'listen EPERM: operation not permitted ::1:63315',
    });
  });

  it('recognizes a refused connect with EACCES', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect EACCES 127.0.0.1:6006 - Local (0.0.0.0:0)', {
          code: 'EACCES',
          syscall: 'connect',
          port: 6006,
        })
      )
    ).toEqual({
      operation: 'connect',
      code: 'EACCES',
      detail: 'connect EACCES 127.0.0.1:6006 - Local (0.0.0.0:0)',
    });
  });

  it('recognizes an error serialized over a channel, which keeps only its message', () => {
    expect(
      detectBlockedNetwork({
        name: 'Error',
        message: 'listen EPERM: operation not permitted ::1:63315',
        stack: 'Error: \n    at node:net:1918:21',
      })
    ).toEqual({
      operation: 'listen',
      code: 'EPERM',
      detail: 'listen EPERM: operation not permitted ::1:63315',
    });
  });

  it('looks through causes and the errors of a connect to localhost', () => {
    const perAddress = (address: string) =>
      systemError(`connect EPERM ${address}:6006`, {
        code: 'EPERM',
        syscall: 'connect',
        port: 6006,
      });
    const localhost = Object.assign(
      new AggregateError([perAddress('::1'), perAddress('127.0.0.1')], ''),
      {
        code: 'EPERM',
      }
    );

    expect(detectBlockedNetwork(new Error('disconnected', { cause: localhost }))).toMatchObject({
      operation: 'connect',
      detail: 'connect EPERM ::1:6006',
    });
  });

  it('leaves errors a sandbox does not cause alone', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect ECONNREFUSED 127.0.0.1:6006', {
          code: 'ECONNREFUSED',
          syscall: 'connect',
          port: 6006,
        })
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork(
        systemError('listen EADDRINUSE: address already in use :::6006', {
          code: 'EADDRINUSE',
          syscall: 'listen',
          port: 6006,
        })
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork(
        systemError("EPERM: operation not permitted, open '/x'", { code: 'EPERM', syscall: 'open' })
      )
    ).toBeUndefined();
    expect(detectBlockedNetwork('listen EPERM')).toBeUndefined();
    expect(detectBlockedNetwork(undefined)).toBeUndefined();
  });

  it('leaves Unix sockets alone, which fail with the same codes for file permissions', () => {
    expect(
      detectBlockedNetwork(
        systemError('connect EACCES /var/run/docker.sock', {
          code: 'EACCES',
          syscall: 'connect',
          address: '/var/run/docker.sock',
        })
      )
    ).toBeUndefined();
    expect(
      detectBlockedNetwork({ message: 'connect EACCES /var/run/docker.sock' })
    ).toBeUndefined();
  });
});

describe('describeBlockedNetwork', () => {
  it('names the sandbox for EPERM', () => {
    expect(
      describeBlockedNetwork({ operation: 'listen', code: 'EPERM', detail: '' })
    ).toMatchInlineSnapshot(
      `"This environment does not allow listening on network ports, as sandboxed shells such as a coding agent's sandbox often do. It is not caused by the code or the stories."`
    );
  });

  it('also names reserved and privileged ports for EACCES', () => {
    expect(
      describeBlockedNetwork({ operation: 'listen', code: 'EACCES', detail: '' })
    ).toMatchInlineSnapshot(
      `"The operating system refused it, as it does in a sandboxed shell such as a coding agent's sandbox, and for a port that is reserved or needs administrator rights. It is not caused by the code or the stories."`
    );
  });
});
