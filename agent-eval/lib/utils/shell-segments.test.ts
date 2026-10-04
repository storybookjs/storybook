import { describe, expect, it } from 'vitest';

import { splitCommandSegments } from './shell-segments.ts';

describe('splitCommandSegments', () => {
  it('returns one segment for a plain command', () => {
    expect(splitCommandSegments('ls /workspace/src')).toEqual([
      { tokens: ['ls', '/workspace/src'], redirectTarget: null, piped: false },
    ]);
  });

  it('splits on &&, || and ;', () => {
    const segments = splitCommandSegments('ls a && cat b; grep c d');
    expect(segments.map((segment) => segment.tokens[0])).toEqual(['ls', 'cat', 'grep']);
    expect(segments.every((segment) => !segment.piped)).toBe(true);
  });

  it('marks segments downstream of a pipe', () => {
    const segments = splitCommandSegments('npx tsc --noEmit | tail -20');
    expect(segments).toHaveLength(2);
    expect(segments[0]?.piped).toBe(false);
    expect(segments[1]).toMatchObject({ tokens: ['tail', '-20'], piped: true });
  });

  it('only the segment immediately after a pipe is piped, not later ones', () => {
    const segments = splitCommandSegments('cat a | head -5; ls b');
    expect(segments.map((segment) => segment.piped)).toEqual([false, true, false]);
  });

  it('captures a redirect target given as a separate token', () => {
    expect(splitCommandSegments('cat > /tmp/out.txt')[0]?.redirectTarget).toBe('/tmp/out.txt');
  });

  it('captures a redirect target attached to the operator', () => {
    expect(splitCommandSegments('cat >/tmp/out.txt')[0]?.redirectTarget).toBe('/tmp/out.txt');
  });

  it('treats >> as a redirect too', () => {
    expect(splitCommandSegments('cat >> src/a.ts')[0]?.redirectTarget).toBe('src/a.ts');
  });

  it('does not treat 2>&1 as a file redirect', () => {
    const segments = splitCommandSegments('npx tsc 2>&1');
    expect(segments[0]?.redirectTarget).toBeNull();
    expect(segments[0]?.tokens).toEqual(['npx', 'tsc']);
  });

  it('does not treat stderr suppression as a write', () => {
    // Counting `2>/dev/null` as a write made every `grep ... 2>/dev/null` in a
    // real transcript read as an edit.
    const segments = splitCommandSegments('grep -rn "x" src 2>/dev/null');
    expect(segments[0]?.redirectTarget).toBeNull();
    expect(segments[0]?.tokens).toEqual(['grep', '-rn', 'x', 'src']);
  });

  it('does not treat a discard redirect as a write', () => {
    expect(splitCommandSegments('cat a.ts > /dev/null')[0]?.redirectTarget).toBeNull();
  });

  it('drops a stderr redirect target instead of reading it as an argument', () => {
    const segments = splitCommandSegments('npx tsc 2> errors.log');
    expect(segments[0]?.redirectTarget).toBeNull();
    expect(segments[0]?.tokens).toEqual(['npx', 'tsc']);
  });

  it('separates commands split across lines', () => {
    // Anything after a heredoc lands on its own line; without newline handling
    // it would be absorbed into the preceding command.
    const segments = splitCommandSegments('cat > a.ts <<EOF\nbody\nEOF\nnpx vitest run');
    expect(segments.map((segment) => segment.tokens[0])).toEqual(['cat', 'npx']);
  });

  it('rejoins backslash continuations into one command', () => {
    const segments = splitCommandSegments('npx vitest run \\\n  --config vitest.config.ts');
    expect(segments).toHaveLength(1);
    expect(segments[0]?.tokens).toEqual(['npx', 'vitest', 'run', '--config', 'vitest.config.ts']);
  });

  it('strips heredoc bodies so their contents are not parsed as commands', () => {
    const command =
      "cat > /tmp/t.tsx <<'EOF'\nimport { render } from 'x'\nrm -rf /\nEOF\nls /workspace";
    const segments = splitCommandSegments(command);
    expect(segments.some((segment) => segment.tokens[0] === 'rm')).toBe(false);
    expect(segments.some((segment) => segment.tokens[0] === 'ls')).toBe(true);
  });

  // `<<-` strips leading tabs from the terminator as well as the body, so a
  // column-0 anchor let the whole body through to be tokenised as commands.
  it('strips a <<- body whose terminator is tab-indented', () => {
    const segments = splitCommandSegments(
      'cat > file.sh <<-EOF\n\trm -rf /workspace/important\n\tEOF'
    );
    expect(segments).toHaveLength(1);
    expect(segments.some((segment) => segment.tokens.includes('rm'))).toBe(false);
  });

  it('still requires the terminator to own its line', () => {
    // `EOF` here is the tail of a body line, not the terminator, so the heredoc
    // is unterminated and nothing is stripped.
    const segments = splitCommandSegments('cat > file.sh <<EOF\necho not EOF');
    expect(segments.some((segment) => segment.tokens.includes('<<HEREDOC'))).toBe(false);
  });

  it('keeps a quoted sed expression as a single token', () => {
    const segments = splitCommandSegments("sed -i 's#a; b#c#' file.ts");
    expect(segments).toHaveLength(1);
    expect(segments[0]?.tokens).toEqual(['sed', '-i', 's#a; b#c#', 'file.ts']);
  });

  it('returns no segments for an empty command', () => {
    expect(splitCommandSegments('   ')).toEqual([]);
  });
});
