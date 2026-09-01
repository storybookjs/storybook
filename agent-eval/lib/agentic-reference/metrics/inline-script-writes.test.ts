import { describe, expect, it } from 'vitest';

import { detectInlineScriptWrites, inlineScriptWritesBySegment } from './inline-script-writes.ts';

describe('detectInlineScriptWrites', () => {
  describe('node -e', () => {
    it('finds a literal path passed to writeFileSync', () => {
      const result = detectInlineScriptWrites(
        `node -e "const fs=require('fs');fs.writeFileSync('src/a.tsx', out)"`
      );
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/a.tsx']);
    });

    it('resolves one level of variable indirection to a literal', () => {
      const result = detectInlineScriptWrites(
        `node -e "const fs=require('fs');const p='src/components/Header/Header.tsx';let s=fs.readFileSync(p,'utf8');s=s.replace('a','b');fs.writeFileSync(p,s)"`
      );
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/components/Header/Header.tsx']);
    });

    it('reports no write for a read-only script', () => {
      const result = detectInlineScriptWrites(
        `node -e "fetch('http://127.0.0.1:5173').then(r=>console.log('status',r.status))"`
      );
      expect(result).toEqual({ hasWrite: false, paths: [] });
    });
  });

  describe('python heredocs', () => {
    it('finds a write through a variable assigned from a literal', () => {
      const command = [
        `python3 - <<'EOF'`,
        `import re`,
        `p='src/components/Header/Header.tsx'`,
        `s=open(p).read()`,
        `s=s.replace("a","b")`,
        `open(p,'w').write(s)`,
        `EOF`,
      ].join('\n');
      const result = detectInlineScriptWrites(command);
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/components/Header/Header.tsx']);
    });

    it('finds a literal path opened for writing', () => {
      const command = `python3 - <<'EOF'\nopen('src/new.ts','w').write('x')\nEOF`;
      const result = detectInlineScriptWrites(command);
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/new.ts']);
    });

    it('does not treat a read-only open as a write', () => {
      const command = `python3 - <<'EOF'\nprint(open('src/a.ts').read())\nEOF`;
      expect(detectInlineScriptWrites(command)).toEqual({ hasWrite: false, paths: [] });
    });

    it('ignores a heredoc that feeds data into a script file', () => {
      // `python3 script.py <<'EOF'` runs script.py; the body is stdin data,
      // and write-looking text inside it must not count as an edit.
      const command = `python3 script.py <<'EOF'\nopen('src/a.ts','w')\nEOF`;
      expect(detectInlineScriptWrites(command)).toEqual({ hasWrite: false, paths: [] });
    });

    it('scans a bare-interpreter heredoc — stdin is executed without a dash too', () => {
      const command = `python3 <<'EOF'\nopen('src/a.ts','w').write('x')\nEOF`;
      const result = detectInlineScriptWrites(command);
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/a.ts']);
    });

    it('recognises pathlib write_text on a literal', () => {
      const command = `python3 -c "from pathlib import Path; Path('src/a.ts').write_text('x')"`;
      const result = detectInlineScriptWrites(command);
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/a.ts']);
    });

    it('recognises pathlib write_text on a variable inside Path()', () => {
      const command = `python3 -c "from pathlib import Path; p = 'src/a.ts'; Path(p).write_text('x')"`;
      const result = detectInlineScriptWrites(command);
      expect(result.hasWrite).toBe(true);
      expect(result.paths).toEqual(['src/a.ts']);
    });
  });

  it('keeps repeated writes to the same path — churn counts operations, not files', () => {
    const result = detectInlineScriptWrites(
      `node -e "fs.writeFileSync('src/a.ts', a); fs.appendFileSync('src/a.ts', b)"`
    );
    expect(result.paths).toEqual(['src/a.ts', 'src/a.ts']);
  });

  describe('non-interpreter commands', () => {
    it('ignores a cat heredoc — the redirect target is already counted elsewhere', () => {
      const command = `cat > src/new.tsx <<'EOF'\nconst a = 1\nEOF`;
      expect(detectInlineScriptWrites(command)).toEqual({ hasWrite: false, paths: [] });
    });

    it('ignores plain shell commands', () => {
      expect(detectInlineScriptWrites('grep -rn writeFileSync src')).toEqual({
        hasWrite: false,
        paths: [],
      });
    });
  });

  it('reports hasWrite without a path when the target cannot be resolved', () => {
    const result = detectInlineScriptWrites(
      `node -e "fs.writeFileSync(process.argv[1], data)" src/a.ts`
    );
    expect(result.hasWrite).toBe(true);
    expect(result.paths).toEqual([]);
  });

  describe('inlineScriptWritesBySegment', () => {
    it('attributes a write to its own segment, not to sibling interpreter calls', () => {
      const perSegment = inlineScriptWritesBySegment(
        `node -e "fs.writeFileSync('src/a.ts', s)" && node -e "console.log(1)"`
      );
      expect(perSegment).toEqual([
        { hasWrite: true, paths: ['src/a.ts'] },
        { hasWrite: false, paths: [] },
      ]);
    });

    it('aligns heredoc bodies with the segments that consume them', () => {
      const perSegment = inlineScriptWritesBySegment(
        `python3 - <<'EOF'\np='src/b.tsx'\nopen(p,'w').write(s)\nEOF\nnpx vitest run`
      );
      expect(perSegment).toEqual([
        { hasWrite: true, paths: ['src/b.tsx'] },
        { hasWrite: false, paths: [] },
      ]);
    });
  });
});
