import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const TOOL = fileURLToPath(new URL('../tools/free-port.mjs', import.meta.url));

const LISTENER = `require('node:net').createServer().listen(Number(process.argv[1]), () => console.log('listening'));`;

const SUPERVISOR = `
const { spawn } = require('node:child_process');
let listener;
const start = () => {
  listener = spawn(process.execPath, ['-e', ${JSON.stringify(LISTENER)}, process.argv[1]], { stdio: 'inherit' });
  listener.on('exit', start);
};
process.on('SIGTERM', () => {
  listener.removeAllListeners('exit');
  listener.kill('SIGKILL');
  process.exit(0);
});
start();
`;

const started: ChildProcess[] = [];

afterEach(() => {
  for (const child of started.splice(0)) {
    child.stdout?.destroy();
    child.kill('SIGTERM');
  }
});

const freePort = () =>
  new Promise<number>((resolve) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

const startListening = (script: string, port: number) =>
  new Promise<void>((resolve) => {
    const child = spawn(process.execPath, ['-e', script, String(port)], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    started.push(child);
    child.stdout.once('data', () => resolve());
  });

const answers = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

const freeWithTool = (port: number, ...flags: string[]) =>
  spawnSync(process.execPath, [TOOL, String(port), ...flags], { encoding: 'utf8' });

describe('free-port', () => {
  it('stops the process that listens on the port, found by the port and not by a saved pid', async () => {
    const port = await freePort();
    await startListening(LISTENER, port);
    expect(await answers(port)).toBe(true);

    const result = freeWithTool(port);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Port ${port} is free.`);
    expect(await answers(port)).toBe(false);
  });

  it('exits non-zero with one line of reason when the port is taken again', async () => {
    const port = await freePort();
    await startListening(SUPERVISOR, port);

    const result = freeWithTool(port, '--wait-seconds=2');

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toMatch(
      new RegExp(
        `^Port ${port} still answers after 2 seconds\\. Processes that listen on it: \\d+\\.$`
      )
    );
  }, 15_000);
});
