import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { claudeSandboxSessionPath, transferClaudeSession } from '@ai-hero/sandcastle';
import { dirname, join } from 'pathe';

// What an agent that was stopped has to print its answer, repairs included.
export const WRAP_UP_MINUTES = 10;

// Why the runner stopped an agent in the middle of its work.
export interface Stop {
  // For the record of the run.
  record: string;
  // For the agent.
  told: string;
  // For a check the agent did not finish.
  note: string;
}

export const stopAtTimeLimit = (minute: number): Stop => ({
  record: `The run reached minute ${minute}, its time limit, and the agent was stopped.`,
  told: `The run reached minute ${minute}, its time limit, and was stopped.`,
  note: 'the run was stopped at its time limit',
});

export const stopAfterSilence = (minutes: number): Stop => ({
  record: `The agent printed nothing for ${minutes} minutes and was stopped.`,
  told: `You printed nothing for ${minutes} minutes, so the run was stopped.`,
  note: `the run was stopped after ${minutes} minutes without output`,
});

export const wrapUpPrompt = (stop: Stop): string =>
  [
    `${stop.told} Every command and server you had running was ended.`,
    '',
    'Do not run any more commands and do not change files.',
    'Print the final answer now, in the form the instructions describe.',
    'Give every check you finished its state.',
    `Give every check you did not finish the state \`skip\` with the note \`${stop.note}\`.`,
    'Report a finding only for a check that you finished and that failed.',
  ].join('\n');

// Give up on a call into a sandbox that does not come back. A Docker daemon that is short of memory
// answers nothing, and the call itself has no limit.
export const within = <Value>(
  seconds: number,
  what: string,
  work: Promise<Value>
): Promise<Value> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${what} did not finish within ${seconds} seconds.`)),
        seconds * 1000
      ).unref();
    }),
  ]);

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
    execFileSync('docker', ['cp', `${session.container}:${inSandbox}`, copy], {
      stdio: 'pipe',
      timeout: 60_000,
    });
    mkdirSync(dirname(session.hostFile), { recursive: true });
    writeFileSync(
      session.hostFile,
      transferClaudeSession(readFileSync(copy, 'utf8'), session.sandboxCwd, session.hostCwd)
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};
