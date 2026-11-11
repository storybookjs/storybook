import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { ENTRY, finding, loaded, VERSION } from './fixtures.ts';
import { loadResults } from './results.ts';
import { Finding, type RunResultFile } from './schema.ts';

const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const record = (overrides: Partial<RunResultFile> = {}): RunResultFile => ({
  ...loaded('linux', 'claude', [finding()]).result,
  ...overrides,
});

const writeRun = (dir: string, result: RunResultFile = record()) =>
  write(join(dir, 'result.json'), JSON.stringify(result));

const load = (resultsDir: string) => {
  const warnings: string[] = [];
  const results = loadResults(resultsDir, {
    version: VERSION,
    catalog: [ENTRY],
    warn: (message) => warnings.push(message),
  });
  return { results, warnings };
};

const artifactRun = (resultsDir: string) =>
  join(resultsDir, 'qa-result-linux-claude/mealdrop/linux/claude');

describe('loadResults', () => {
  it('reads only the records the runner wrote, never one inside the evidence', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    writeRun(join(runDir, 'evidence'));
    writeRun(join(resultsDir, 'qa-result-linux-claude/elsewhere'));
    writeRun(join(resultsDir, 'mealdrop/macos/claude'), {
      ...record(),
      request: { ...record().request, os: 'macos' },
    });

    const { results } = load(resultsDir);

    expect(results.map((result) => result.resultPath)).toEqual([
      join(runDir, 'result.json'),
      join(resultsDir, 'mealdrop/macos/claude/result.json'),
    ]);
  });

  it('ignores a record that names another version or os than the place it was found', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    writeRun(artifactRun(resultsDir), {
      ...record(),
      request: { ...record().request, version: '11.0.0-beta.1', os: 'windows' },
    });

    const { results, warnings } = load(resultsDir);

    expect(results).toEqual([]);
    expect(warnings[0]).toMatch(/disagrees .* on os, version/);
  });

  it('takes the repository from the catalog and the head from the bundle, not from the record', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const runDir = artifactRun(resultsDir);
    const branch = `qa/sb-${VERSION}/linux-claude`;
    writeRun(runDir, {
      ...record(),
      request: {
        ...record().request,
        entry: { ...ENTRY, repo: 'attacker/target' },
      },
      headSha: 'f'.repeat(40),
    });
    write(
      join(runDir, 'cycle.bundle'),
      `# v2 git bundle\n-${'1'.repeat(40)} start\n${'2'.repeat(40)} refs/heads/${branch}\n${'3'.repeat(40)} refs/heads/main\n\nPACK`
    );

    const [result] = load(resultsDir).results;

    expect(result?.cycle).toEqual({
      repo: 'storybookjs/mealdrop',
      branch: `${branch}-${'2'.repeat(10)}`,
      startSha: '1'.repeat(40),
      headSha: '2'.repeat(40),
      bundle: join(runDir, 'cycle.bundle'),
    });
    expect(result?.result.request.entry.repo).toBe('storybookjs/mealdrop');
  });

  it('rejects a model id that could close the metadata fence in the issue body', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const base = record();
    writeRun(artifactRun(resultsDir), {
      ...base,
      request: { ...base.request, model: 'claude\n```\n@everyone' },
    });

    const { results, warnings } = load(resultsDir);

    expect(results).toHaveLength(0);
    expect(warnings).toContainEqual(expect.stringMatching(/not a valid result record/));
  });

  it('skips a truncated result.json and still collects the other runs', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    write(
      join(resultsDir, 'qa-result-linux-codex/mealdrop/linux/codex/result.json'),
      '{"request": {'
    );
    writeRun(artifactRun(resultsDir));

    const { results, warnings } = load(resultsDir);

    expect(results).toHaveLength(1);
    expect(warnings).toContainEqual(expect.stringMatching(/result\.json is unreadable/));
  });

  it('treats a bundle without the cycle branch as no commits', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'cycle.bundle'),
      `# v2 git bundle\n${'2'.repeat(40)} refs/heads/main\n\nPACK`
    );

    const { results, warnings } = load(resultsDir);

    expect(results[0]?.cycle).toMatchObject({ headSha: null, bundle: null });
    expect(warnings).toContainEqual(expect.stringMatching(/has no ref for/));
  });

  // Collect runs on Linux, and creating a symlink on Windows needs a privilege CI does not have.
  it.skipIf(process.platform === 'win32')(
    'keeps regular evidence files and drops missing ones, symlinks and escapes',
    () => {
      const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
      const outside = mkdtempSync(join(tmpdir(), 'qa-outside-'));
      write(join(outside, 'secret.log'), 'token');
      const runDir = artifactRun(resultsDir);
      const evidence = join(runDir, 'evidence');
      write(join(evidence, 'hmr-frames/01.png'), 'png');
      write(join(evidence, 'dev.log'), 'log');
      symlinkSync(join(outside, 'secret.log'), join(evidence, 'link.log'));
      symlinkSync(outside, join(evidence, 'escape'));
      writeRun(
        runDir,
        record({
          findings: [
            finding({
              evidence: {
                png: 'hmr-frames/01.png',
                gif: 'missing.gif',
                logs: ['dev.log', 'link.log', 'escape/secret.log'],
              },
            }),
          ],
        })
      );

      const { results, warnings } = load(resultsDir);

      expect(results[0]?.result.findings[0]?.evidence).toEqual({
        png: 'hmr-frames/01.png',
        logs: ['dev.log'],
      });
      expect(warnings).toEqual([
        expect.stringMatching(/missing\.gif .*does not exist/),
        expect.stringMatching(/link\.log .*is a symlink/),
        expect.stringMatching(/escape\/secret\.log .*outside the evidence directory/),
      ]);
    }
  );
});

describe('evidence names in a finding', () => {
  it.each(['../result.json', '/etc/passwd', '.env', 'a/../b.log', 'a/b/c.png', 'C:\\x.png'])(
    'rejects %s',
    (name) => {
      expect(Finding.safeParse(finding({ evidence: { logs: [name] } })).success).toBe(false);
    }
  );

  it('accepts a file name and one directory level', () => {
    expect(
      Finding.safeParse(finding({ evidence: { png: 'hmr-frames/01.png', logs: ['dev.log'] } }))
        .success
    ).toBe(true);
  });
});

describe('system info', () => {
  it('strips the colour codes and the box prefix the CLI prints', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'evidence/storybook-info.txt'),
      'yarn dlx noise\n\x1b[1mStorybook Environment Info:\x1b[22m\n\x1b[90m│\x1b[39m\n\x1b[90m│\x1b[39m  System:\n\x1b[90m│\x1b[39m  OS: Linux\n'
    );

    const { results } = load(resultsDir);

    expect(results[0]?.systemInfo).toBe('Storybook Environment Info:\n\nSystem:\nOS: Linux');
  });

  it('treats a capture without the report as no info', () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'qa-results-'));
    const runDir = artifactRun(resultsDir);
    writeRun(runDir);
    write(
      join(runDir, 'evidence/storybook-info.txt'),
      'yarn dlx noise\nEPERM: operation not permitted\n'
    );

    const { results } = load(resultsDir);

    expect(results[0]?.systemInfo).toBeUndefined();
  });
});
