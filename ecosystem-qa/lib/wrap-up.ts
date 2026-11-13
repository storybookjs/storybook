import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { claudeSandboxSessionPath, transferClaudeSession } from '@ai-hero/sandcastle';
import { dirname, join } from 'pathe';

// What an agent that was stopped at the time limit has to print its answer, repairs included.
export const WRAP_UP_MINUTES = 10;

export const wrapUpPrompt = (minute: number): string =>
  [
    `The run reached minute ${minute}, its time limit, and was stopped. Every command and server you had running was ended.`,
    '',
    'Do not run any more commands and do not change files.',
    'Print the final answer now, in the form the instructions describe.',
    'Give every check you finished its state.',
    'Give every check you did not finish the state `skip` with the note `the run was stopped at its time limit`.',
    'Report a finding only for a check that you finished and that failed.',
  ].join('\n');

interface StoppedSession {
  // The Docker container of the sandbox.
  container: string;
  sessionId: string;
  // Where the agent worked and where its home is, as paths inside the sandbox.
  sandboxCwd: string;
  sandboxHome: string;
  // The repo directory on the host that the sandbox was created for.
  hostCwd: string;
  // Where Sandcastle expects the session of that repo directory on the host.
  hostFile: string;
}

// Copy the session of a Claude Code agent that was stopped in the middle of a turn out of its Docker
// sandbox, to where Sandcastle looks for a session it is asked to resume.
//
// Sandcastle copies a session out only when a turn ends, so without this an interrupted turn cannot
// be resumed, and what the agent found is lost with it.
export const saveStoppedClaudeSession = (session: StoppedSession): void => {
  const inSandbox = claudeSandboxSessionPath(
    session.sandboxCwd,
    session.sessionId,
    `${session.sandboxHome}/.claude/projects`
  );
  const scratch = mkdtempSync(join(tmpdir(), 'qa-session-'));
  try {
    const copy = join(scratch, 'session.jsonl');
    execFileSync('docker', ['cp', `${session.container}:${inSandbox}`, copy], { stdio: 'pipe' });
    mkdirSync(dirname(session.hostFile), { recursive: true });
    writeFileSync(
      session.hostFile,
      transferClaudeSession(readFileSync(copy, 'utf8'), session.sandboxCwd, session.hostCwd)
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};
