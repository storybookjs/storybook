#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { connect } from 'node:net';

const [portArgument, ...flags] = process.argv.slice(2);
const port = Number(portArgument);
const waitFlag = flags.find((flag) => flag.startsWith('--wait-seconds='));
const waitSeconds = waitFlag ? Number(waitFlag.split('=')[1]) : 20;
if (!Number.isInteger(port) || port <= 0 || port > 65535 || !(waitSeconds >= 0)) {
  console.error('Usage: node free-port.mjs <port> [--wait-seconds=<n>]');
  process.exit(2);
}

const LISTEN = '0A';

// Reads the kernel's socket tables, so the Linux image needs neither lsof nor ss. Only the sockets
// of processes this user may inspect are found, which are the ones this user may stop.
const linuxListeners = () => {
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = new Set();
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let rows = [];
    try {
      rows = readFileSync(table, 'utf8').trim().split('\n').slice(1);
    } catch {
      continue;
    }
    for (const row of rows) {
      const [, local, , state, , , , , , inode] = row.trim().split(/\s+/);
      if (state === LISTEN && local?.endsWith(`:${hexPort}`)) {
        inodes.add(`socket:[${inode}]`);
      }
    }
  }
  if (inodes.size === 0) {
    return [];
  }
  const pids = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    try {
      const fds = readdirSync(`/proc/${entry}/fd`);
      if (fds.some((fd) => inodes.has(readlinkSafe(`/proc/${entry}/fd/${fd}`)))) {
        pids.push(Number(entry));
      }
    } catch {
      // Another user's process, or one that ended while we read.
    }
  }
  return pids;
};

const readlinkSafe = (path) => {
  try {
    return readlinkSync(path);
  } catch {
    return '';
  }
};

const macListeners = () =>
  spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout;

const windowsListeners = () =>
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess }`,
    ],
    { encoding: 'utf8' }
  ).stdout;

const listeners = () => {
  const found =
    process.platform === 'linux'
      ? linuxListeners()
      : (process.platform === 'win32' ? windowsListeners() : macListeners())
          .split(/\s+/)
          .filter((entry) => /^\d+$/.test(entry))
          .map(Number);
  // PID 0 is the System Idle process that Windows names for a socket whose owner has ended.
  return [...new Set(found)].filter((pid) => pid !== 0 && pid !== process.pid);
};

const answersOn = (host) =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });

const answers = async () => (await answersOn('127.0.0.1')) || (await answersOn('::1'));

const stop = (pid, signal) => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(pid, signal);
  } catch {
    // It ended on its own in the same moment.
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const found = listeners();
for (const pid of found) {
  stop(pid, 'SIGTERM');
}
const deadline = Date.now() + waitSeconds * 1000;
const killAt = Date.now() + 3000;
let killed = false;
while (await answers()) {
  if (Date.now() >= deadline) {
    const left = listeners();
    console.error(
      `Port ${port} still answers after ${waitSeconds} seconds. ` +
        (left.length > 0
          ? `Processes that listen on it: ${left.join(', ')}.`
          : 'No process of this user listens on it.')
    );
    process.exit(1);
  }
  if (!killed && Date.now() >= killAt) {
    killed = true;
    for (const pid of found) {
      stop(pid, 'SIGKILL');
    }
  }
  await sleep(250);
}
console.log(
  found.length > 0
    ? `Port ${port} is free. Stopped the processes that listened on it: ${found.join(', ')}.`
    : `Port ${port} is free. Nothing listened on it.`
);
