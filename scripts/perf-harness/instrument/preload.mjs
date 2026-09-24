// Loaded into the Storybook dev server with `node --import`. Node passes `--import` on to children
// that addon-vitest starts with execaNode (it defaults `nodeOptions` to `process.execArgv`), so the
// Vitest child runs this file too and serves its own numbers on the next port.
//
// Records per phase, and serves on http://127.0.0.1:$PERF_HARNESS_CONTROL_PORT:
// - CPU time of this process (process.cpuUsage), event-loop delay and utilization, heap after GC;
// - send and dispatch time of every `services:*` channel event (channel-hooks.js);
// - every IPC message to and from a child process, sized as it goes on the wire;
// - every spawned `git` process;
// - the status flood driver (/flood/start), which writes statuses through the project's own
//   `storybook/internal/core-server` without running Vitest.
import childProcess from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { Session } from 'node:inspector';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { basename, join } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import v8 from 'node:v8';
import vm from 'node:vm';
import { isMainThread } from 'node:worker_threads';

const basePort = Number(process.env.PERF_HARNESS_CONTROL_PORT);
const isVitestChild = process.env.VITEST_CHILD_PROCESS === 'true';
const role = isVitestChild ? 'vitest-child' : 'server';
const port = isVitestChild ? basePort + 1 : basePort;

if (isMainThread && basePort) {
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const now = performance.now.bind(performance);
  const epoch = () => performance.timeOrigin + now();

  const installChannelHooks = new Function(
    `${readFileSync(new URL('./channel-hooks.js', import.meta.url), 'utf8')}\nreturn installChannelHooks;`
  )();
  const hooks = { now, epoch, sends: [], dispatches: [], onDispatch: () => true };
  installChannelHooks(hooks);

  let clones = { count: 0, ms: 0 };
  const origClone = globalThis.structuredClone;
  globalThis.structuredClone = function structuredClone(value, options) {
    const t0 = now();
    try {
      return origClone(value, options);
    } finally {
      clones.count += 1;
      clones.ms += now() - t0;
    }
  };

  // --- IPC and process spawns ------------------------------------------------------------------

  // Size of an IPC message on the wire: V8 serializer bytes for `serialization: 'advanced'`, JSON
  // text plus the newline delimiter for 'json'.
  const ipcBytes = (message, serialization) => {
    try {
      return serialization === 'advanced'
        ? v8.serialize(message).length
        : Buffer.byteLength(JSON.stringify(message)) + 1;
    } catch {
      return 0;
    }
  };
  const ipcType = (message) => {
    const type = typeof message?.type === 'string' ? message.type : typeof message;
    const inner = message?.args?.[0]?.event?.type;
    return { type, subtype: typeof inner === 'string' ? inner : '' };
  };

  let ipc = [];
  let spawns = [];
  const serializationOf = new WeakMap();

  const recordSpawn = (file, args, sync) => {
    const command = basename(String(file ?? ''));
    const joined = (args ?? []).join(' ');
    // `exec('git …')` arrives as `/bin/sh -c "git …"`.
    const shellGit = /^(sh|bash|zsh|cmd\.exe)$/.test(command) && /(^|-c\s+|\s)git\s/.test(joined);
    const isGit = command === 'git' || command === 'git.exe' || shellGit;
    const argv = isGit && !shellGit ? (args ?? []).slice(1) : [];
    const subcommand = isGit
      ? ((shellGit
          ? /git\s+(\S+)/.exec(joined)?.[1]
          : argv.find((a) => !a.startsWith('-') && !a.includes('='))) ?? '')
      : '';
    spawns.push({ t: epoch(), command, git: isGit, subcommand, sync });
  };

  const { ChildProcess } = childProcess;
  // Node assigns `send` as an own property of each ChildProcess inside `spawn()` (setupChannel), so
  // wrap it on the instance after spawning. The child gets the serialization mode in an env var,
  // because Node deletes NODE_CHANNEL_SERIALIZATION_MODE before any `--import` runs.
  const origSpawn = ChildProcess.prototype.spawn;
  ChildProcess.prototype.spawn = function spawn(options) {
    recordSpawn(options?.file, options?.args, false);
    const serialization = options?.serialization ?? 'json';
    if (Array.isArray(options?.envPairs)) {
      options.envPairs.push(`PERF_HARNESS_IPC_SERIALIZATION=${serialization}`);
    }
    const result = origSpawn.apply(this, arguments);
    if (typeof this.send === 'function') {
      const send = this.send;
      const child = this;
      this.send = function (message) {
        ipc.push({
          t: epoch(),
          dir: 'to-child',
          pid: child.pid,
          ...ipcType(message),
          bytes: ipcBytes(message, serialization),
          serialization,
        });
        return send.apply(this, arguments);
      };
      serializationOf.set(this, serialization);
    }
    return result;
  };
  for (const name of ['spawnSync', 'execFileSync', 'execSync']) {
    const orig = childProcess[name];
    childProcess[name] = function (file, args) {
      if (name === 'execSync') {
        recordSpawn('sh', ['-c', String(file)], true);
      } else {
        recordSpawn(file, Array.isArray(args) ? [file, ...args] : [file], true);
      }
      return orig.apply(this, arguments);
    };
  }
  syncBuiltinESMExports();

  const origEmit = ChildProcess.prototype.emit;
  ChildProcess.prototype.emit = function emit(name, message) {
    if (name === 'message' && serializationOf.has(this)) {
      const serialization = serializationOf.get(this);
      ipc.push({
        t: epoch(),
        dir: 'from-child',
        pid: this.pid,
        ...ipcType(message),
        bytes: ipcBytes(message, serialization),
        serialization,
      });
    }
    return origEmit.apply(this, arguments);
  };
  // The child's own view of the same link, to cross-check the parent's numbers.
  if (isVitestChild && typeof process.send === 'function') {
    const serialization = process.env.PERF_HARNESS_IPC_SERIALIZATION ?? 'json';
    const send = process.send.bind(process);
    process.send = function (message, ...rest) {
      ipc.push({
        t: epoch(),
        dir: 'to-parent',
        ...ipcType(message),
        bytes: ipcBytes(message, serialization),
        serialization,
      });
      return send(message, ...rest);
    };
    process.prependListener('message', (message) => {
      ipc.push({
        t: epoch(),
        dir: 'from-parent',
        ...ipcType(message),
        bytes: ipcBytes(message, serialization),
        serialization,
      });
    });
  }

  // Server-side websocket errors and closes, to explain a client that sees code 1006.
  let wsEvents = [];
  try {
    const WebSocket = createRequire(join(process.cwd(), 'package.json'))('ws');
    const emit = WebSocket.prototype.emit;
    WebSocket.prototype.emit = function (name, ...args) {
      if (name === 'error') {
        wsEvents.push({
          t: epoch(),
          event: 'error',
          message: String(args[0]?.message ?? args[0]),
          code: args[0]?.code,
        });
      } else if (name === 'close') {
        wsEvents.push({
          t: epoch(),
          event: 'close',
          code: args[0],
          reason: String(args[1] ?? ''),
          bufferedAmount: this.bufferedAmount,
        });
      }
      return emit.call(this, name, ...args);
    };
  } catch {}

  // --- Status flood ----------------------------------------------------------------------------

  const flood = { running: false, ticks: [], error: null };
  const loadCoreServer = async () => {
    const require = createRequire(join(process.cwd(), 'package.json'));
    let path;
    try {
      path = require.resolve('storybook/internal/core-server');
    } catch {
      // Packages that only export an `import` condition cannot be resolved by require.
      const pkgDir = require.resolve('storybook/package.json').replace(/package\.json$/, '');
      const exp = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).exports[
        './internal/core-server'
      ];
      path = join(
        pkgDir,
        typeof exp === 'string' ? exp : (exp.import?.default ?? exp.import ?? exp.default)
      );
    }
    return import(pathToFileURL(path).href);
  };
  const floodStore = async (typeId) => (await loadCoreServer()).experimental_getStatusStore(typeId);
  // POST body: JSON array of story ids.
  async function startFlood(url, body) {
    const storyIds = JSON.parse(body || '[]');
    const perTick = Number(url.searchParams.get('n') ?? 50);
    const intervalMs = Number(url.searchParams.get('interval') ?? 500);
    const ticks = Number(url.searchParams.get('ticks') ?? 40);
    const typeId = url.searchParams.get('typeId') ?? 'bench/flood';
    const store = await floodStore(typeId);
    const values = ['status-value:success', 'status-value:warning', 'status-value:error'];
    flood.running = true;
    flood.ticks = [];
    flood.error = null;
    let tick = 0;
    const step = () => {
      if (tick >= ticks) {
        flood.running = false;
        return;
      }
      const value = values[tick % values.length];
      // Rotate through the story list so each tick touches a different window of stories.
      const offset = (tick * perTick) % Math.max(1, storyIds.length);
      const batch = [];
      for (let i = 0; i < perTick && i < storyIds.length; i += 1) {
        const storyId = storyIds[(offset + i) % storyIds.length];
        batch.push({ storyId, typeId, value, title: 'Flood', description: `tick ${tick}` });
      }
      const t0 = now();
      try {
        store.set(batch);
      } catch (error) {
        flood.error = String(error?.stack ?? error);
        flood.running = false;
        return;
      }
      flood.ticks.push({ t: epoch(), tick, setMs: now() - t0 });
      tick += 1;
      setTimeout(step, intervalMs);
    };
    step();
    return { started: true, typeId, perTick, intervalMs, ticks, stories: storyIds.length };
  }

  // --- Control server --------------------------------------------------------------------------

  const loopDelay = monitorEventLoopDelay({ resolution: 5 });
  loopDelay.enable();
  let elu = performance.eventLoopUtilization();
  let cpu = process.cpuUsage();

  const heap = () => {
    gc();
    gc();
    const { heapUsed, rss, external, arrayBuffers } = process.memoryUsage();
    return { heapUsed, rss, external, arrayBuffers };
  };

  const inspector = new Session();
  inspector.connect();
  const post = (method, params) =>
    new Promise((resolve, reject) =>
      inspector.post(method, params, (err, res) => (err ? reject(err) : resolve(res)))
    );

  const routes = {
    '/ping': () => ({ role, pid: process.pid }),
    '/cpu': () => {
      const { user, system } = process.cpuUsage();
      return { ms: (user + system) / 1000 };
    },
    '/profile/start': async () => {
      await post('Profiler.enable');
      await post('Profiler.setSamplingInterval', { interval: 200 });
      await post('Profiler.start');
      return { started: true };
    },
    '/profile/stop': async (url) => {
      const { profile } = await post('Profiler.stop');
      const file = url.searchParams.get('file');
      writeFileSync(file, JSON.stringify(profile));
      return { file };
    },
    '/flood/start': startFlood,
    '/flood/reset': async (url) => {
      (await floodStore(url.searchParams.get('typeId') ?? 'bench/flood')).unset();
      return { reset: true };
    },
    '/flood/status': () => ({
      running: flood.running,
      ticks: flood.ticks.length,
      error: flood.error,
    }),
    '/take': () => {
      const current = performance.eventLoopUtilization();
      const utilization = performance.eventLoopUtilization(current, elu);
      elu = current;
      const cpuDelta = process.cpuUsage(cpu);
      cpu = process.cpuUsage();
      const out = {
        runtime: role,
        pid: process.pid,
        cpu: { userMs: cpuDelta.user / 1000, systemMs: cpuDelta.system / 1000 },
        sends: hooks.sends,
        dispatches: hooks.dispatches,
        clones,
        wsEvents,
        ipc,
        spawns,
        floodTicks: flood.ticks,
        eventLoop: {
          maxDelayMs: loopDelay.max / 1e6,
          p99DelayMs: loopDelay.percentile(99) / 1e6,
          activeMs: utilization.active,
          utilization: utilization.utilization,
        },
      };
      hooks.sends = [];
      hooks.dispatches = [];
      clones = { count: 0, ms: 0 };
      wsEvents = [];
      ipc = [];
      spawns = [];
      flood.ticks = [];
      loopDelay.reset();
      return out;
    },
    '/heap': heap,
    '/snapshot': (url) => {
      heap();
      return { file: v8.writeHeapSnapshot(url.searchParams.get('file') ?? undefined) };
    },
  };

  createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = routes[url.pathname];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    new Promise((resolve) => req.on('end', resolve))
      .then(() => route(url, body))
      .then(
        (body) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(body));
        },
        (error) => {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: String(error?.stack ?? error) }));
        }
      );
  })
    .on('error', () => undefined)
    .listen(port, '127.0.0.1')
    .unref();
}
