import { describe, expect, it } from 'vitest';

import goldenTranscript from '../__fixtures__/golden-run/transcript.json' with { type: 'json' };
import { computeChurn } from './churn.ts';

function edit(filePath: string) {
  return {
    type: 'tool_call',
    tool: { name: 'file_edit', originalName: 'Edit', args: { file_path: filePath } },
  };
}

function shell(command: string) {
  return { type: 'tool_call', tool: { name: 'shell', originalName: 'Bash', args: { command } } };
}

describe('computeChurn', () => {
  it('counts structured edits per file and strips the workspace prefix', () => {
    const churn = computeChurn([edit('/workspace/src/a.tsx'), edit('/workspace/src/a.tsx')]);
    expect(churn.perFile).toEqual({ 'src/a.tsx': 2 });
    expect(churn.filesEdited).toBe(1);
    expect(churn.maxEditsPerFile).toBe(2);
    expect(churn.meanEditsPerFile).toBe(2);
  });

  it('averages across several files', () => {
    const churn = computeChurn([
      edit('/workspace/a.ts'),
      edit('/workspace/a.ts'),
      edit('/workspace/b.ts'),
    ]);
    expect(churn.filesEdited).toBe(2);
    expect(churn.maxEditsPerFile).toBe(2);
    expect(churn.meanEditsPerFile).toBe(1.5);
  });

  it('strips the Docker sandbox workspace prefix — the root real runs use', () => {
    const churn = computeChurn([
      edit('/home/sandbox/workspace/src/components/Header/Header.tsx'),
      edit('/home/sandbox/workspace/src/components/Header/Header.tsx'),
    ]);
    expect(churn.perFile).toEqual({ 'src/components/Header/Header.tsx': 2 });
    expect(churn.filesEdited).toBe(1);
  });

  it('counts a write made through an inline node script', () => {
    const churn = computeChurn([
      shell(`node -e "const fs=require('fs');const p='src/a.tsx';fs.writeFileSync(p, s)"`),
    ]);
    expect(churn.perFile).toEqual({ 'src/a.tsx': 1 });
  });

  it('counts two inline writes to the same file as two edits', () => {
    const churn = computeChurn([
      shell(`node -e "fs.writeFileSync('src/a.ts', a); fs.appendFileSync('src/a.ts', b)"`),
    ]);
    expect(churn.perFile).toEqual({ 'src/a.ts': 2 });
  });

  it('counts a write made through a python heredoc', () => {
    const churn = computeChurn([
      shell(`python3 - <<'EOF'\np='src/b.tsx'\ns=open(p).read()\nopen(p,'w').write(s)\nEOF`),
    ]);
    expect(churn.perFile).toEqual({ 'src/b.tsx': 1 });
  });

  it('does not count a read-only inline script as churn', () => {
    const churn = computeChurn([shell(`python3 - <<'EOF'\nprint(open('src/a.ts').read())\nEOF`)]);
    expect(churn.perFile).toEqual({});
  });

  it('counts shell writes, which o11y.filesModified misses entirely', () => {
    const churn = computeChurn([shell("sed -i 's#a#b#' src/a.tsx")]);
    expect(churn.perFile).toEqual({ 'src/a.tsx': 1 });
  });

  it('counts a heredoc redirect as a write to its target', () => {
    const churn = computeChurn([shell("cat > src/new.tsx <<'EOF'\nconst a = 1\nEOF")]);
    expect(churn.perFile).toEqual({ 'src/new.tsx': 1 });
  });

  it('counts the destination of a copy, not the source', () => {
    const churn = computeChurn([shell('cp /tmp/scratch.tsx src/a.tsx')]);
    expect(churn.perFile).toEqual({ 'src/a.tsx': 1 });
  });

  it('ignores writes outside the workspace', () => {
    const churn = computeChurn([shell('cat > /tmp/scratch.tsx')]);
    expect(churn.perFile).toEqual({});
    expect(churn.filesEdited).toBe(0);
  });

  it('does not count stderr suppression as a write', () => {
    const churn = computeChurn([shell('grep -rn "x" src 2>/dev/null')]);
    expect(churn.perFile).toEqual({});
  });

  it('counts a removal as a write to that path', () => {
    const churn = computeChurn([shell('rm -f src/tmp.test.ts')]);
    expect(churn.perFile).toEqual({ 'src/tmp.test.ts': 1 });
  });

  it('carries edit history across a rename', () => {
    // Without rename tracking this splits into {a: 2, b: 1}: two files edited,
    // max 2. The agent worked on one file throughout.
    const churn = computeChurn([
      edit('/workspace/src/a.ts'),
      edit('/workspace/src/a.ts'),
      shell('mv src/a.ts src/b.ts'),
      edit('/workspace/src/b.ts'),
    ]);
    expect(churn.perFile).toEqual({ 'src/b.ts': 4 });
    expect(churn.filesEdited).toBe(1);
    expect(churn.maxEditsPerFile).toBe(4);
    expect(churn.renames).toEqual([{ from: 'src/a.ts', to: 'src/b.ts' }]);
  });

  it('follows a chain of renames to the final path', () => {
    const churn = computeChurn([
      edit('/workspace/a.ts'),
      shell('mv a.ts b.ts'),
      shell('mv b.ts c.ts'),
    ]);
    expect(churn.perFile).toEqual({ 'c.ts': 3 });
    expect(churn.renames).toEqual([
      { from: 'a.ts', to: 'b.ts' },
      { from: 'b.ts', to: 'c.ts' },
    ]);
  });

  it('treats git mv as a rename too', () => {
    const churn = computeChurn([edit('/workspace/a.ts'), shell('git mv a.ts b.ts')]);
    expect(churn.perFile).toEqual({ 'b.ts': 2 });
  });

  it('does not treat a copy as a rename: the source keeps its history', () => {
    const churn = computeChurn([edit('/workspace/a.ts'), shell('cp a.ts b.ts')]);
    expect(churn.perFile).toEqual({ 'a.ts': 1, 'b.ts': 1 });
    expect(churn.renames).toEqual([]);
  });

  it('moves several files into a directory', () => {
    const churn = computeChurn([
      edit('/workspace/a.ts'),
      edit('/workspace/b.ts'),
      shell('mv a.ts b.ts src/'),
    ]);
    expect(churn.perFile).toEqual({ 'src/a.ts': 2, 'src/b.ts': 2 });
  });

  it('keeps history under the source when a file is moved out of the workspace', () => {
    const churn = computeChurn([edit('/workspace/a.ts'), shell('mv a.ts /tmp/a.ts')]);
    expect(churn.perFile).toEqual({ 'a.ts': 1 });
    expect(churn.renames).toEqual([]);
  });

  it('counts a rename onto an existing file as merging both histories', () => {
    const churn = computeChurn([
      edit('/workspace/a.ts'),
      edit('/workspace/b.ts'),
      shell('mv a.ts b.ts'),
    ]);
    expect(churn.perFile).toEqual({ 'b.ts': 3 });
  });

  it('reports null rather than zero when nothing was edited', () => {
    const churn = computeChurn([]);
    expect(churn).toEqual({
      perFile: {},
      filesEdited: 0,
      maxEditsPerFile: null,
      meanEditsPerFile: null,
      renames: [],
    });
  });

  it('ignores non tool_call events', () => {
    expect(computeChurn([{ type: 'message', role: 'user', content: 'hi' }]).perFile).toEqual({});
  });

  it('reproduces the golden run exactly', () => {
    const churn = computeChurn(goldenTranscript.events);
    expect(churn.perFile['src/components/Footer/Footer.tsx']).toBe(3);
  });
});
