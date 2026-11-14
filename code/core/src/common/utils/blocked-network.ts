export type BlockedNetwork = {
  /** What was blocked: listening on a port or connecting to one. */
  operation: 'listen' | 'connect';
  /** The system error in one line, for example `listen EPERM: operation not permitted ::1:63315`. */
  detail: string;
};

// A serialized error keeps only its message, which Node spells `<syscall> <code> …`.
const BLOCKED_MESSAGE = /\b(listen|connect) (?:EPERM|EACCES)\b[^\n]*/;

/**
 * Recognize the error a sandbox, such as a coding agent's, gives for opening a port or connecting
 * to localhost, also as a `cause`, inside an `AggregateError`, or serialized to its message.
 */
export function detectBlockedNetwork(error: unknown, depth = 0): BlockedNetwork | undefined {
  if (error == null || typeof error !== 'object' || depth > 5) {
    return undefined;
  }
  const { syscall, code, message, cause, errors } = error as Record<string, unknown>;
  const match = typeof message === 'string' ? BLOCKED_MESSAGE.exec(message) : null;
  if ((syscall === 'listen' || syscall === 'connect') && (code === 'EPERM' || code === 'EACCES')) {
    return { operation: syscall, detail: match?.[0].trim() ?? `${syscall} ${code}` };
  }
  if (match) {
    return { operation: match[1] as BlockedNetwork['operation'], detail: match[0].trim() };
  }
  for (const nested of [cause, ...(Array.isArray(errors) ? errors : [])]) {
    const found = detectBlockedNetwork(nested, depth + 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Say that the sandbox blocked it, not the code. */
export function formatBlockedNetwork({ operation, detail }: BlockedNetwork): string {
  const what = operation === 'listen' ? 'opening a port' : 'connecting to localhost';
  return `The sandbox this command runs in blocked ${what} (\`${detail}\`); this is not a problem in the code.`;
}

export const ASK_TO_RUN_OUTSIDE_SANDBOX = 'ask the user to run this command outside the sandbox.';
