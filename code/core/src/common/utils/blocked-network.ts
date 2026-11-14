/**
 * Sandboxed shells, such as the ones coding agents run commands in, often refuse to open ports or to
 * connect to localhost. The operating system then fails `listen` or `connect` with `EPERM` (or
 * `EACCES`), which no code change can fix. Every command that meets such an error says so in the
 * same words, so an agent asks to re-run the command with network access instead of editing code
 * or starting a second Storybook.
 */

/** What the environment blocked. */
export type BlockedNetworkOperation = 'listen' | 'connect';

export type BlockedNetwork = {
  operation: BlockedNetworkOperation;
  /** The system error in one line, for example `listen EPERM: operation not permitted ::1:63315`. */
  detail: string;
};

const BLOCKED_CODES = new Set(['EPERM', 'EACCES']);

// Node spells these errors `<syscall> <code>`, as in `listen EPERM: operation not permitted ::1:63315`
// or `connect EPERM 127.0.0.1:6006 - Local (0.0.0.0:0)`. The message is all that survives an error
// serialized over a channel.
const BLOCKED_MESSAGE = /\b(listen|connect) (EPERM|EACCES)\b[^\n]*/;

/**
 * Recognizes an error that means the environment does not allow opening a port or connecting to
 * one, from its `syscall` and `code` or, for an error serialized without them, from its message.
 * Looks through `cause` chains and aggregate errors (a connect to `localhost` tries every address).
 */
export function detectBlockedNetwork(error: unknown, depth = 0): BlockedNetwork | undefined {
  if (error == null || typeof error !== 'object' || depth > 5) {
    return undefined;
  }
  const { syscall, code, message, cause, errors } = error as {
    syscall?: unknown;
    code?: unknown;
    message?: unknown;
    cause?: unknown;
    errors?: unknown;
  };
  if (
    (syscall === 'listen' || syscall === 'connect') &&
    typeof code === 'string' &&
    BLOCKED_CODES.has(code)
  ) {
    const fromMessage =
      typeof message === 'string' ? BLOCKED_MESSAGE.exec(message)?.[0] : undefined;
    return { operation: syscall, detail: (fromMessage ?? `${syscall} ${code}`).trim() };
  }
  if (typeof message === 'string') {
    const match = BLOCKED_MESSAGE.exec(message);
    if (match) {
      return { operation: match[1] as BlockedNetworkOperation, detail: match[0].trim() };
    }
  }
  for (const nested of [cause, ...(Array.isArray(errors) ? errors : [])]) {
    const found = detectBlockedNetwork(nested, depth + 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Why the error is the environment's, in the words every command uses. */
export const BLOCKED_NETWORK_CAUSE: Record<BlockedNetworkOperation, string> = {
  listen:
    "This environment does not allow listening on network ports, as sandboxed shells such as a coding agent's sandbox often do. It is not caused by the code or the stories.",
  connect:
    "This environment does not allow connections to localhost, as sandboxed shells such as a coding agent's sandbox often do. It is not caused by the code or the stories.",
};

/** What to do about it, in the words every command uses. */
export const BLOCKED_NETWORK_REMEDY =
  'Run this same command again with network access: for a coding agent, that means outside its sandbox (ask the user to approve that if needed).';
