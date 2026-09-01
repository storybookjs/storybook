// Detect file writes made through inline interpreter scripts.
//
// Agents routinely edit files via `node -e "fs.writeFileSync(...)"` or
// `python3 - <<'EOF' ... EOF` heredocs instead of the structured edit tools.
// Those writes are invisible to both the churn tracker and the tool taxonomy:
// shell-segments deliberately strips heredoc bodies (they are data, not
// commands), and an inline `-e`/`-c` script is a single opaque token.
//
// This is a best-effort static scan, not an interpreter. It recognises the
// write idioms observed in real transcripts — a literal path in write
// position, or one level of variable indirection to a literal — and reports
// `hasWrite` even when no path could be extracted, so callers can still
// classify the act without knowing its target.
import { splitCommandSegments } from '../../utils/shell-segments.ts';

export interface InlineScriptWrites {
  /** The command runs an inline script that writes at least one file. */
  hasWrite: boolean;
  /** Raw path literals found in write position; unresolved targets are omitted. */
  paths: string[];
}

/** Binaries whose inline scripts these patterns understand. */
const INTERPRETERS = new Set(['node', 'python', 'python3']);
/** Flags that carry the script as their next argument, by interpreter. */
const SCRIPT_FLAGS = new Set(['-e', '--eval', '-c']);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function basename(token: string): string {
  return token.replace(/^.*\//, '');
}

/**
 * Same shape as the segment splitter's heredoc rule, but capturing the
 * invoking line's prefix and the body instead of discarding them.
 */
const HEREDOC_WITH_BODY =
  /^(?<prefix>[^\n]*?)<<-?\s*['"]?(?<term>\w+)['"]?[^\n]*\n(?<body>[\s\S]*?)^\t*\k<term>$/gm;

/**
 * Write idioms in write position. Each entry either captures a literal path
 * (`path` group) or an identifier (`ident` group) to resolve against a
 * single-assignment of a string literal elsewhere in the script.
 */
const WRITE_PATTERNS = [
  // fs.writeFileSync('src/a.tsx', ...) / writeFile / appendFileSync
  /\b(?:writeFileSync|writeFile|appendFileSync)\s*\(\s*(?:['"`](?<path>[^'"`]+)['"`]|(?<ident>[A-Za-z_$][\w$.[\]]*))/g,
  // open('src/a.ts', 'w') / open(p, 'a')
  /\bopen\s*\(\s*(?:['"](?<path>[^'"]+)['"]|(?<ident>[A-Za-z_]\w*))\s*,\s*['"][wax]\+?b?['"]/g,
  // Path('src/a.ts').write_text(...) / p.write_text(...)
  /(?:['"](?<path>[^'"]+)['"]\s*\)|\b(?<ident>[A-Za-z_]\w*))\s*\.write_text\s*\(/g,
  // Path(p).write_text(...) — the identifier sits inside the constructor, so
  // the pattern above (which needs it directly before `.write_text`) misses it.
  /\bPath\s*\(\s*(?<ident>[A-Za-z_]\w*)\s*\)\s*\.write_text\s*\(/g,
];

/** The string literal a script assigns to `ident`, or null. */
function resolveAssignment(script: string, ident: string): string | null {
  // `p='src/a.ts'` / `const p = "src/a.ts"` — the first assignment wins; a
  // second one means the variable is reused and the guess is unsafe.
  const assignment = new RegExp(
    `(?:^|[;\\s])(?:const\\s+|let\\s+|var\\s+)?${ident}\\s*=\\s*(['"\`])([^'"\`]+)\\1`,
    'g'
  );
  const matches = [...script.matchAll(assignment)];
  const literal = matches[0]?.[2];
  return matches.length === 1 && literal !== undefined ? literal : null;
}

function collectScriptWrites(script: string, into: InlineScriptWrites): void {
  for (const pattern of WRITE_PATTERNS) {
    for (const match of script.matchAll(pattern)) {
      into.hasWrite = true;
      const { path, ident } = match.groups ?? {};
      if (path !== undefined) {
        into.paths.push(path);
        continue;
      }
      // `Path(...)` in the ident slot is the pathlib constructor whose
      // argument the path group already handles, not a variable.
      if (ident === undefined || ident === 'Path') continue;
      const resolved = resolveAssignment(script, ident);
      if (resolved !== null) into.paths.push(resolved);
    }
  }
}

/**
 * Whether a heredoc's body is executed as code rather than read as data.
 *
 * `python3 - <<EOF` and bare `python3 <<EOF` both run the body from stdin;
 * `python3 script.py <<EOF` runs the script file and the body is mere input,
 * so write-looking text inside it must not count as an edit.
 */
function executesHeredocAsScript(prefix: string): boolean {
  // The heredoc attaches to the last command on the line: `cd x && python3 -`.
  const lastCommand = prefix.split(/&&|\|\||;|\|/).at(-1) ?? '';
  const tokens = lastCommand
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '' && !ENV_ASSIGNMENT.test(token));
  const head = tokens[0];
  if (head === undefined || !INTERPRETERS.has(basename(head))) return false;
  // Only flags and the lone stdin marker may follow: any positional argument
  // names a script file.
  return tokens
    .slice(1)
    .every((token) => token === '-' || (token.startsWith('-') && token.length > 1));
}

/**
 * Inline-script writes per shell segment, index-aligned with
 * splitCommandSegments(command) so a classifier walking segments can tell the
 * writing interpreter call from a read-only one chained after it.
 */
export function inlineScriptWritesBySegment(command: string): InlineScriptWrites[] {
  const segments = splitCommandSegments(command);
  const results = segments.map((): InlineScriptWrites => ({ hasWrite: false, paths: [] }));

  // Heredoc bodies in string order; segments consume them in the same order,
  // one per `<<HEREDOC` marker the stripper left behind.
  const heredocs = [...command.matchAll(HEREDOC_WITH_BODY)];
  let heredocIndex = 0;

  for (const [index, segment] of segments.entries()) {
    const into = results[index]!;
    const { tokens } = segment;

    // Flag scripts: `node -e '...'`, `python3 -c '...'`.
    const interpreterAt = tokens.findIndex((token) => INTERPRETERS.has(basename(token)));
    if (interpreterAt !== -1) {
      const flagAt = tokens.findIndex(
        (token, position) => position > interpreterAt && SCRIPT_FLAGS.has(token)
      );
      const script = flagAt === -1 ? undefined : tokens[flagAt + 1];
      if (script !== undefined) collectScriptWrites(script, into);
    }

    // Heredoc scripts: `python3 - <<'EOF' ... EOF`.
    for (const token of tokens) {
      if (token !== '<<HEREDOC') continue;
      const heredoc = heredocs[heredocIndex];
      heredocIndex += 1;
      if (heredoc === undefined) continue;
      const { prefix = '', body = '' } = heredoc.groups ?? {};
      if (executesHeredocAsScript(prefix)) collectScriptWrites(body, into);
    }
  }

  return results;
}

export function detectInlineScriptWrites(command: string): InlineScriptWrites {
  const found: InlineScriptWrites = { hasWrite: false, paths: [] };
  for (const segment of inlineScriptWritesBySegment(command)) {
    found.hasWrite ||= segment.hasWrite;
    // Duplicates stay: churn counts write operations, and two writes to one
    // file are two acts of editing.
    found.paths.push(...segment.paths);
  }
  return found;
}
