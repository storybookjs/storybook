// Split a shell command into independently classifiable segments.
//
// Compound commands are the norm in agent transcripts: a single Bash call
// routinely chains exploration, an edit and a verification run. Classifying
// the call as a whole would attribute all of it to one bucket, so the tool
// taxonomy needs the parts.
//
// The pipe distinction is the subtle one. `;`, `&&` and `||` separate
// independent commands, but `|` does not: `npx tsc | tail -20` is one act of
// verification whose output is filtered, not verification plus exploration.
// Counting the `tail` as exploration would inflate a lower-is-better metric
// every time an agent trimmed noisy output — penalising the careful ones.
import { tokenizeShellCommand } from '../shell-parse.ts';

export interface ShellSegment {
  tokens: string[];
  /**
   * Path this segment redirects stdout into, or null. A write regardless of the
   * head binary, so churn and the taxonomy both key off it.
   */
  redirectTarget: string | null;
  /** This segment consumes the previous segment's stdout. */
  piped: boolean;
}

const SEPARATORS = new Set(['&&', '||', ';', '|']);

// Heredoc bodies are data, not commands. Left in place, a payload containing
// `rm -rf /` would be tokenised and classified as an edit.
//
// `<<-` strips leading tabs from the body *and* from the terminator, so the
// closing word may be indented. Anchoring it at column 0 let those bodies fall
// through and be tokenised — the exact failure this exists to prevent. Only
// tabs are allowed before the terminator, matching what the shell strips;
// accepting spaces would swallow a body line that merely ends in that word.
const HEREDOC = /<<-?\s*'?"?(\w+)'?"?[\s\S]*?^\t*\1$/gm;

function stripHeredocBodies(command: string): string {
  return command.replace(HEREDOC, '<<HEREDOC');
}

// Only a stdout redirect writes content worth counting. `2>&1` duplicates a
// descriptor, and `2>/dev/null` is stderr suppression — treating either as a
// write turned every `grep ... 2>/dev/null` in the captured run into an "edit".
const STDOUT_REDIRECT = /^1?>>?$/;
const STDOUT_REDIRECT_WITH_TARGET = /^1?>>?([^&>].*)$/;
/** Redirects here discard output; nothing is written. */
const DISCARD_TARGETS = new Set(['/dev/null', '/dev/stdout', '/dev/stderr']);

function redirectTargetOf(target: string | undefined): string | null {
  if (target === undefined || target === '') return null;
  const path = target.replace(/^['"]|['"]$/g, '');
  return DISCARD_TARGETS.has(path) ? null : path;
}

/**
 * A newline separates commands just as `;` does, but the tokenizer collapses it
 * into ordinary whitespace. Lines are therefore split before tokenising, so
 * that everything after a heredoc — or after any line break — starts a fresh
 * segment instead of being absorbed into the previous command.
 *
 * Backslash continuations are rejoined first: they are one command written
 * across several lines, not several commands.
 */
function commandLines(command: string): string[] {
  return command
    .replace(/\\\n/g, ' ')
    .split('\n')
    .filter((line) => line.trim() !== '');
}

export function splitCommandSegments(command: string): ShellSegment[] {
  const segments: ShellSegment[] = [];

  for (const line of commandLines(stripHeredocBodies(command))) {
    let current: string[] = [];
    let redirectTarget: string | null = null;
    // A line break ends any pipeline, so each line starts unpiped.
    let piped = false;
    // The previous token was a bare redirect operator, so this token is its
    // target. 'discard' distinguishes `2> file` — whose target must be dropped
    // rather than treated as an argument — from a real stdout write.
    let awaiting: 'stdout' | 'discard' | null = null;

    const flush = () => {
      if (current.length > 0) {
        segments.push({ tokens: current, redirectTarget, piped });
      }
      current = [];
      redirectTarget = null;
      awaiting = null;
    };

    for (const token of tokenizeShellCommand(line)) {
      if (SEPARATORS.has(token)) {
        flush();
        piped = token === '|';
        continue;
      }
      if (awaiting !== null) {
        if (awaiting === 'stdout') redirectTarget = redirectTargetOf(token);
        awaiting = null;
        continue;
      }
      if (STDOUT_REDIRECT.test(token)) {
        awaiting = 'stdout';
        continue;
      }
      // An attached form such as `>/tmp/out` survives tokenisation as one token.
      const attached = STDOUT_REDIRECT_WITH_TARGET.exec(token);
      if (attached) {
        redirectTarget = redirectTargetOf(attached[1]);
        continue;
      }
      // A non-stdout redirect (`2>`, `2>>`, `2>&1`) writes no content.
      if (/^\d>>?/.test(token)) {
        if (/^\d>>?$/.test(token)) awaiting = 'discard';
        continue;
      }
      current.push(token);
    }
    flush();
  }

  return segments;
}
