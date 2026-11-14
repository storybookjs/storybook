// A sandboxed shell, such as a coding agent's, fails `listen` and `connect` with `EPERM`. Every
// command reports that in the same words, so an agent asks for network access instead of editing
// code or starting a second Storybook.

export type BlockedNetwork = {
  operation: 'listen' | 'connect';
  code: 'EPERM' | 'EACCES';
  /** The system error in one line, for example `listen EPERM: operation not permitted ::1:63315`. */
  detail: string;
};

// A serialized error keeps only its message, such as `listen EPERM: operation not permitted
// ::1:63315` or `connect EPERM 127.0.0.1:6006 - Local (0.0.0.0:0)`. The port keeps out Unix
// sockets, which fail with the same codes for file permissions.
const BLOCKED_MESSAGE = /\b(listen|connect) (EPERM|EACCES)\b[^\n]*?:\d+\b[^\n]*/;

function isBlockedCode(code: unknown): code is BlockedNetwork['code'] {
  return code === 'EPERM' || code === 'EACCES';
}

/**
 * Recognize an error that means the operating system refused to open or connect to a TCP port,
 * also when it is a `cause`, inside an `AggregateError`, or serialized to its message.
 */
export function detectBlockedNetwork(error: unknown, depth = 0): BlockedNetwork | undefined {
  if (error == null || typeof error !== 'object' || depth > 5) {
    return undefined;
  }
  const { syscall, code, port, message, cause, errors } = error as Record<string, unknown>;
  const fromMessage = typeof message === 'string' ? BLOCKED_MESSAGE.exec(message) : null;
  if (
    (syscall === 'listen' || syscall === 'connect') &&
    isBlockedCode(code) &&
    typeof port === 'number'
  ) {
    return {
      operation: syscall,
      code,
      detail: fromMessage?.[0].trim() ?? `${syscall} ${code} port ${port}`,
    };
  }
  if (fromMessage) {
    return {
      operation: fromMessage[1] as BlockedNetwork['operation'],
      code: fromMessage[2] as BlockedNetwork['code'],
      detail: fromMessage[0].trim(),
    };
  }
  for (const nested of [cause, ...(Array.isArray(errors) ? errors : [])]) {
    const found = detectBlockedNetwork(nested, depth + 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

const NOT_THE_CODE = 'It is not caused by the code or the stories.';

/** Say, in the words every command uses, that the environment refused the port. */
export function describeBlockedNetwork({ operation, code }: BlockedNetwork): string {
  if (code === 'EACCES') {
    // Also what Windows answers for a port in a reserved range, and Unix for a port below 1024.
    return `The operating system refused it, as it does in a sandboxed shell such as a coding agent's sandbox, and for a port that is reserved or needs administrator rights. ${NOT_THE_CODE}`;
  }
  const what = operation === 'listen' ? 'listening on network ports' : 'connections to localhost';
  return `This environment does not allow ${what}, as sandboxed shells such as a coding agent's sandbox often do. ${NOT_THE_CODE}`;
}

/** What to do about a refused port, in the words every command uses. */
export const BLOCKED_NETWORK_REMEDY =
  'Run this same command again with network access: for a coding agent, that means outside its sandbox (ask the user to approve that if needed).';
