/**
 * A small `node:child_process` wrapper that covers the part of execa Storybook relied on.
 *
 * The returned {@link Subprocess} is the spawned `ChildProcess` (streams, `kill()`, `on('exit')`,
 * IPC `send()`/`on('message')`) that can also be awaited for a {@link SubprocessResult}. Failures
 * reject with a {@link SubprocessError} that carries the same fields execa errors had (`exitCode`,
 * `stderr`, `shortMessage`, `code === 'ENOENT'`, ...), so error categorisation keeps working.
 */
import {
  ChildProcess,
  type SpawnOptions,
  type StdioOptions,
  spawn,
  spawnSync,
} from 'node:child_process';
// PATH entries are OS-native strings; pathe would rewrite their separators.
import { basename, delimiter, dirname } from 'node:path';
import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';

import crossSpawn from 'cross-spawn';
import { onExit } from 'signal-exit';

export interface SubprocessOptions {
  cwd?: string;
  /** Merged over `process.env` unless `extendEnv` is `false`. */
  env?: Record<string, string | undefined>;
  /** @default true */
  extendEnv?: boolean;
  /** @default 'pipe' */
  stdio?: StdioOptions;
  shell?: boolean | string;
  /** Kill the process with `killSignal` after this many milliseconds. */
  timeout?: number;
  /** @default 'SIGTERM' */
  killSignal?: NodeJS.Signals;
  /** Kill the process with `killSignal` when this signal aborts. */
  cancelSignal?: AbortSignal;
  /** When `false`, a failure resolves with the {@link SubprocessError} instead of rejecting. */
  reject?: boolean;
  /** Also collect stdout and stderr interleaved, in arrival order, into `result.all`. */
  all?: boolean;
  /**
   * Collect piped stdout/stderr into the result. Set to `false` for long-running processes whose
   * output is consumed through the streams.
   *
   * @default true
   */
  buffer?: boolean;
  /** Kill the process when the parent process exits. @default true */
  cleanup?: boolean;
  /** Open an IPC channel (`send()` / `on('message')`). */
  ipc?: boolean;
}

export interface SubprocessResult {
  /** The file and arguments joined with spaces. */
  command: string;
  /** Like `command`, with arguments quoted for display. */
  escapedCommand: string;
  cwd?: string;
  failed: boolean;
  timedOut: boolean;
  isCanceled: boolean;
  isTerminated: boolean;
  exitCode?: number;
  signal?: NodeJS.Signals;
  /** Collected stdout without its final newline; `undefined` when stdout is not piped. */
  stdout?: string;
  /** Collected stderr without its final newline; `undefined` when stderr is not piped. */
  stderr?: string;
  /** Interleaved stdout and stderr, only with the `all` option. */
  all?: string;
}

/** A spawned child process that can also be awaited for its result. */
export type Subprocess = ChildProcess & Promise<SubprocessResult>;

/** Error a failed {@link Subprocess} rejects with, shaped like an execa error. */
export class SubprocessError extends Error implements SubprocessResult {
  // Fields are assigned by `makeError`; `declare` keeps unset ones off the instance, like execa.
  /** `<reason>: <command>`, followed by the underlying error message if any. */
  declare shortMessage: string;
  /** Message of the underlying error (spawn error, abort reason), if any. */
  declare originalMessage?: string;
  /**
   * Code of the underlying error, such as `ENOENT` when the command does not exist. Numeric for a
   * `DOMException` abort reason.
   */
  declare code?: string | number;
  declare command: string;
  declare escapedCommand: string;
  declare cwd?: string;
  declare failed: true;
  declare timedOut: boolean;
  declare isCanceled: boolean;
  declare isTerminated: boolean;
  declare exitCode?: number;
  declare signal?: NodeJS.Signals;
  declare stdout?: string;
  declare stderr?: string;
  declare all?: string;
}
SubprocessError.prototype.name = 'SubprocessError';

const MAX_BUFFER = 100_000_000;
const FORCE_KILL_AFTER_MS = 5_000;

/**
 * Spawn `file` with `args` without a shell (unless `shell` is set).
 *
 * Windows `.cmd`/`.bat` shims are run through `cmd.exe` with escaped arguments by cross-spawn, as
 * execa did; Node refuses to spawn them directly.
 */
export function spawnSubprocess(
  file: string,
  args: readonly string[] = [],
  options: SubprocessOptions = {}
): Subprocess {
  const {
    killSignal = 'SIGTERM',
    cancelSignal,
    reject = true,
    all = false,
    buffer = true,
    cleanup = true,
    timeout,
  } = options;
  const context = createContext(file, args, options);

  let child: ChildProcess;
  try {
    const spawnArgs = toSpawnArguments(file, args, {
      ...getSpawnOptions(options),
      stdio: options.ipc ? withIpc(options.stdio) : options.stdio,
      ...(options.ipc && { serialization: 'advanced' }),
    });
    child = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.options);
  } catch (error) {
    // Invalid options throw synchronously; report them through the promise like other failures.
    const failure = makeError(context, { cause: error });
    return mergePromise(
      withEndedStreams(new ChildProcess()),
      reject ? Promise.reject(failure) : Promise.resolve(failure)
    );
  }

  const nativeKill = child.kill.bind(child);
  let forceKillTimer: NodeJS.Timeout | undefined;
  child.kill = (signal: NodeJS.Signals | number = killSignal) => {
    const killed = nativeKill(signal);
    // A process that ignores the signal is killed for real after a grace period.
    if (killed && signal === killSignal && !forceKillTimer) {
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          nativeKill('SIGKILL');
        }
      }, FORCE_KILL_AFTER_MS);
      forceKillTimer.unref();
    }
    return killed;
  };

  let terminationReason: 'timeout' | 'cancel' | undefined;
  let cause: unknown;

  const timeoutTimer =
    timeout !== undefined && timeout > 0
      ? setTimeout(() => {
          terminationReason ??= 'timeout';
          child.kill();
        }, timeout)
      : undefined;

  const onCancel = () => {
    if (!terminationReason) {
      terminationReason = 'cancel';
      cause = cancelSignal?.reason;
    }
    child.kill();
  };
  if (cancelSignal?.aborted) {
    onCancel();
  } else {
    cancelSignal?.addEventListener('abort', onCancel, { once: true });
  }

  if (cleanup) {
    trackForCleanup(child);
  }

  const stdout = buffer ? collect(child.stdout) : undefined;
  const stderr = buffer ? collect(child.stderr) : undefined;
  if (!buffer) {
    // A full pipe nobody reads would block the process forever.
    resumeIfUnread(child.stdout);
    resumeIfUnread(child.stderr);
  }
  const interleaved: Buffer[] | undefined = all ? [] : undefined;
  if (interleaved) {
    child.stdout?.on('data', (chunk: Buffer) => interleaved.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => interleaved.push(chunk));
  }
  const onMaxBuffer = (stream: 'stdout' | 'stderr') => {
    // Becomes the `cause` of the SubprocessError, like any other underlying error.
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    cause ??= new Error(`Command's ${stream} was larger than ${MAX_BUFFER} bytes`);
    child.kill();
  };
  stdout?.onOverflow(() => onMaxBuffer('stdout'));
  stderr?.onOverflow(() => onMaxBuffer('stderr'));

  const promise = new Promise<SubprocessResult>((resolve, rejectPromise) => {
    // Without an 'error' listener, a spawn failure (ENOENT) would crash the parent process.
    child.on('error', (error) => {
      cause ??= error;
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutTimer);
      clearTimeout(forceKillTimer);
      cancelSignal?.removeEventListener('abort', onCancel);
      untrackForCleanup(child);

      const output = {
        // A process that never spawned has no exit code (Node reports a negative errno).
        exitCode: child.pid === undefined || code === null ? undefined : code,
        signal: signal ?? undefined,
        stdout: stdout?.read(),
        stderr: stderr?.read(),
        all: interleaved && stripFinalNewline(decode(interleaved)),
      };

      if (cause === undefined && !terminationReason && output.exitCode === 0) {
        resolve({ ...context, ...output, ...SUCCESS_FLAGS });
        return;
      }

      const failure = makeError(context, {
        ...output,
        cause,
        timedOut: terminationReason === 'timeout',
        isCanceled: terminationReason === 'cancel',
        timeout,
      });
      if (reject) {
        rejectPromise(failure);
      } else {
        resolve(failure);
      }
    });
  });

  return mergePromise(child, promise);
}

/**
 * Run `scriptPath` with the current Node.js binary and its flags (except `--inspect*`), with an IPC
 * channel open, like execa's `execaNode`.
 */
export function spawnNodeSubprocess(
  scriptPath: string,
  args: readonly string[] = [],
  options: Omit<SubprocessOptions, 'shell' | 'ipc'> = {}
): Subprocess {
  const nodeOptions = process.execArgv.filter((option) => !option.startsWith('--inspect'));
  const env = options.extendEnv === false ? options.env : { ...process.env, ...options.env };
  return spawnSubprocess(process.execPath, [...nodeOptions, scriptPath, ...args], {
    ...options,
    env: withExecPathInPath(env ?? {}),
    extendEnv: false,
    ipc: true,
  });
}

/** Synchronous {@link spawnSubprocess}. Throws a {@link SubprocessError} on failure. */
export function spawnSubprocessSync(
  file: string,
  args: readonly string[] = [],
  options: Omit<SubprocessOptions, 'cancelSignal' | 'all' | 'buffer' | 'cleanup' | 'ipc'> = {}
): SubprocessResult {
  const { killSignal = 'SIGTERM', reject = true, timeout } = options;
  const context = createContext(file, args, options);
  const spawnArgs = toSpawnArguments(file, args, {
    ...getSpawnOptions(options),
    stdio: options.stdio,
  });
  const result = spawnSync(spawnArgs.command, spawnArgs.args, {
    ...spawnArgs.options,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout,
    killSignal,
  });

  const output = {
    exitCode: result.status ?? undefined,
    signal: result.signal ?? undefined,
    stdout: typeof result.stdout === 'string' ? stripFinalNewline(result.stdout) : undefined,
    stderr: typeof result.stderr === 'string' ? stripFinalNewline(result.stderr) : undefined,
  };
  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';

  if (!result.error && output.exitCode === 0) {
    return { ...context, ...output, ...SUCCESS_FLAGS };
  }

  const failure = makeError(context, {
    ...output,
    cause: timedOut ? undefined : result.error,
    timedOut,
    timeout,
  });
  if (reject) {
    throw failure;
  }
  return failure;
}

const SUCCESS_FLAGS = {
  failed: false,
  timedOut: false,
  isCanceled: false,
  isTerminated: false,
} as const;

type CommandContext = Pick<SubprocessResult, 'command' | 'escapedCommand' | 'cwd'>;

function createContext(
  file: string,
  args: readonly string[],
  { cwd }: SubprocessOptions
): CommandContext {
  return {
    command: [file, ...args].join(' '),
    escapedCommand: [file, ...args].map(quoteArgument).join(' '),
    cwd,
  };
}

function quoteArgument(argument: string) {
  if (/^[\w./-]+$/.test(argument)) {
    return argument;
  }
  return process.platform === 'win32'
    ? `"${argument.replaceAll('"', '""')}"`
    : `'${argument.replaceAll("'", "'\\''")}'`;
}

function getSpawnOptions({ cwd, env, extendEnv = true, shell }: SubprocessOptions): SpawnOptions {
  return {
    cwd,
    env: extendEnv ? { ...process.env, ...env } : env,
    shell,
    windowsHide: true,
  };
}

type CrossSpawnParse = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => { command: string; args: string[]; options: SpawnOptions };

/**
 * Resolve the file, arguments and options to hand to `spawn`, the way execa did.
 *
 * - With `shell`, the file and arguments are joined into a single command line, so Node does not warn
 *   about unescaped arguments (DEP0190).
 * - Without `shell`, cross-spawn's parser handles Windows: it resolves `PATHEXT`, and runs `.cmd`/`.bat`
 *   shims through `cmd.exe /d /s /c` with escaped arguments.
 */
function toSpawnArguments(file: string, args: readonly string[], options: SpawnOptions) {
  const [joinedFile, joinedArgs] =
    options.shell && args.length > 0 ? [[file, ...args].join(' '), []] : [file, args];
  // `_parse` is the parser behind cross-spawn's `spawn`; execa and tinyexec use it the same way.
  const parse = (crossSpawn as unknown as { _parse: CrossSpawnParse })._parse;
  const parsed = parse(joinedFile, joinedArgs, options);
  if (process.platform === 'win32' && basename(parsed.command, '.exe') === 'cmd') {
    // Don't echo the command line cmd.exe runs.
    parsed.args.unshift('/q');
  }
  return parsed;
}

function withIpc(stdio: StdioOptions = 'pipe'): StdioOptions {
  const fds = typeof stdio === 'string' ? [stdio, stdio, stdio] : [...stdio];
  return fds.includes('ipc') ? fds : [...fds, 'ipc'];
}

/** Put the running Node.js binary's directory first on PATH, so `node` in the child is the same one. */
function withExecPathInPath(env: Record<string, string | undefined>) {
  const pathKey =
    process.platform === 'win32'
      ? (Object.keys(env)
          .reverse()
          .find((key) => key.toUpperCase() === 'PATH') ?? 'Path')
      : 'PATH';
  const path = env[pathKey] ?? '';
  const execDir = dirname(process.execPath);
  if (path.split(delimiter).includes(execDir)) {
    return env;
  }
  return { ...env, [pathKey]: path === '' ? execDir : `${execDir}${delimiter}${path}` };
}

function collect(stream: NodeJS.ReadableStream | null) {
  if (!stream) {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let overflow: (() => void) | undefined;
  stream.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BUFFER) {
      overflow?.();
      overflow = undefined;
      return;
    }
    chunks.push(chunk);
  });
  return {
    read: () => stripFinalNewline(decode(chunks)),
    onOverflow: (callback: () => void) => {
      overflow = callback;
    },
  };
}

function decode(chunks: Buffer[]) {
  return Buffer.concat(chunks).toString('utf8');
}

function stripFinalNewline(value: string) {
  if (value.endsWith('\r\n')) {
    return value.slice(0, -2);
  }
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

interface FailureDetails {
  cause?: unknown;
  exitCode?: number;
  signal?: NodeJS.Signals;
  stdout?: string;
  stderr?: string;
  all?: string;
  timedOut?: boolean;
  isCanceled?: boolean;
  timeout?: number;
}

function makeError(context: CommandContext, details: FailureDetails): SubprocessError {
  const {
    cause,
    exitCode,
    signal,
    stdout,
    stderr,
    all,
    timedOut = false,
    isCanceled = false,
  } = details;
  const code = (cause as { code?: string | number } | undefined)?.code;
  const originalMessage =
    cause === undefined
      ? undefined
      : stripVTControlCharacters(String((cause as Error | undefined)?.message ?? cause)) ||
        undefined;

  let reason: string;
  if (timedOut) {
    reason = `Command timed out after ${details.timeout} milliseconds`;
  } else if (isCanceled) {
    reason = 'Command was canceled';
  } else if (code !== undefined) {
    reason = `Command failed with ${code}`;
  } else if (signal !== undefined) {
    reason = `Command was killed with ${signal}`;
  } else if (exitCode !== undefined) {
    reason = `Command failed with exit code ${exitCode}`;
  } else {
    reason = 'Command failed';
  }

  const shortMessage = `${reason}: ${context.escapedCommand}${originalMessage ? `\n${originalMessage}` : ''}`;
  const message = [shortMessage, ...(all === undefined ? [stderr, stdout] : [all])]
    .filter((part): part is string => Boolean(part))
    .map((part) => stripVTControlCharacters(part))
    .join('\n\n');

  const error = new SubprocessError(message, cause === undefined ? undefined : { cause });
  const fields: Partial<SubprocessError> = {
    ...context,
    shortMessage,
    originalMessage,
    code,
    failed: true,
    timedOut,
    isCanceled,
    isTerminated: signal !== undefined,
    exitCode,
    signal,
    stdout,
    stderr,
    all,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      Object.assign(error, { [key]: value });
    }
  }
  return error;
}

/** Make `child` thenable with `promise`, keeping it a real `ChildProcess`. */
function mergePromise(child: ChildProcess, promise: Promise<SubprocessResult>): Subprocess {
  return Object.assign(child, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }) as unknown as Subprocess;
}

/** Stand-in streams for a process that could not be spawned, so callers can still attach to them. */
function withEndedStreams(child: ChildProcess) {
  const ended = () => new PassThrough().end();
  const [stdin, stdout, stderr] = [ended(), ended(), ended()];
  return Object.assign(child, { stdin, stdout, stderr, stdio: [stdin, stdout, stderr] });
}

/** Let output nobody listens to flow away, after giving the caller a tick to attach listeners. */
function resumeIfUnread(stream: NodeJS.ReadableStream | null) {
  setImmediate(() => {
    if (stream && (stream as { readableFlowing?: boolean | null }).readableFlowing === null) {
      stream.resume();
    }
  });
}

// Children spawned with `cleanup` are killed when the parent exits or is terminated by a signal,
// through signal-exit as execa did. signal-exit coordinates with its other copies in the process,
// so the parent still exits on SIGINT/SIGTERM when another library uses it too.
const removeExitHandlers = new WeakMap<ChildProcess, () => void>();

function trackForCleanup(child: ChildProcess) {
  if (child.pid === undefined) {
    return;
  }
  removeExitHandlers.set(
    child,
    onExit(() => {
      child.kill();
    })
  );
}

function untrackForCleanup(child: ChildProcess) {
  removeExitHandlers.get(child)?.();
  removeExitHandlers.delete(child);
}
