export type BlockedNetwork = {
  /** What was blocked: listening on a port or connecting to one. */
  operation: 'listen' | 'connect';
  /** The system error in one line, for example `listen EPERM: operation not permitted ::1:63315`. */
  detail: string;
};

// Only `EPERM`: reserved and privileged ports give `EACCES` outside any sandbox.
const BLOCKED_MESSAGE = /\b(listen|connect) EPERM\b.*?(?= - Local \(|$)/m;

/**
 * Recognize the error of a system that refuses to open a port or to connect to localhost, as a
 * coding agent's sandbox does, also as a `cause`, inside an `AggregateError`, or serialized to its
 * message.
 */
export function detectBlockedNetwork(error: unknown): BlockedNetwork | undefined {
  return detect(error, 0);
}

function detect(error: unknown, depth: number): BlockedNetwork | undefined {
  if (error == null || typeof error !== 'object' || depth > 5) {
    return undefined;
  }
  const { syscall, code, message, cause, errors } = error as Record<string, unknown>;
  const match = typeof message === 'string' ? BLOCKED_MESSAGE.exec(message) : null;
  if ((syscall === 'listen' || syscall === 'connect') && code === 'EPERM') {
    return { operation: syscall, detail: match?.[0].trim() ?? `${syscall} EPERM` };
  }
  if (match) {
    return { operation: match[1] as BlockedNetwork['operation'], detail: match[0].trim() };
  }
  for (const nested of [cause, ...(Array.isArray(errors) ? errors : [])]) {
    const found = detect(nested, depth + 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function formatBlockedNetwork({ operation, detail }: BlockedNetwork): string {
  const what = operation === 'listen' ? 'opening a port' : 'opening a connection';
  return `the system did not permit ${what} (\`${detail}\`)`;
}

// `EPERM` proves a refusal, not a sandbox, so the sandbox is a condition. "Escalated permissions"
// is what coding agents call a run outside their sandbox.
export const RERUN_OUTSIDE_SANDBOX =
  'If this command runs in a sandbox, re-run it with escalated permissions, outside the sandbox.';
