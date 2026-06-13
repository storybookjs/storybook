import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT = 'scripts/sustainability/assess-mvc.ts';

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(args: string[], envOverrides: Record<string, string | undefined> = {}): CliResult {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const { status, stdout, stderr }: SpawnSyncReturns<string> = spawnSync(
    'node',
    [SCRIPT, ...args],
    { encoding: 'utf8', env: env as NodeJS.ProcessEnv }
  );
  return { status, stdout: stdout ?? '', stderr: stderr ?? '' };
}

describe('assess-mvc CLI (subprocess)', () => {
  describe('--help', () => {
    it('exits 0 and prints usage', () => {
      const r = run(['--help']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('Usage:');
      expect(r.stdout).toContain('assess-mvc');
      expect(r.stdout).toContain('PR number or GitHub URL');
    });

    it('lists every documented flag', () => {
      const { stdout } = run(['--help']);
      for (const flag of [
        '--dry-run',
        '--no-dry-run',
        '--dismiss-previous',
        '--force',
        '--reassess',
        '--model',
        '--effort',
        '--verbose',
      ]) {
        expect(stdout, `expected --help to mention ${flag}`).toContain(flag);
      }
    });

    it('lists the model and effort choices', () => {
      const { stdout } = run(['--help']);
      for (const choice of ['sonnet-4.6', 'opus-4.6', 'haiku-4.5']) {
        expect(stdout, `expected --help to list model ${choice}`).toContain(choice);
      }
      for (const choice of ['low', 'medium', 'high', 'max']) {
        expect(stdout, `expected --help to list effort ${choice}`).toContain(choice);
      }
    });
  });

  describe('argument validation', () => {
    it('exits non-zero when the PR arg is missing entirely', () => {
      const r = run([]);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/missing required argument|argument/i);
    });

    it('exits 1 with a parse error on garbage input', () => {
      const r = run(['not-a-pr']);
      expect(r.status).toBe(1);
      expect(r.stderr.toLowerCase()).toMatch(/pr|parse/);
    });

    it('exits 1 when the PR URL is outside the storybookjs org', () => {
      const r = run(['https://github.com/example/foo/pull/1']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('storybookjs');
    });

    it('rejects an invalid --model choice', () => {
      const r = run(['12345', '--model', 'not-a-model']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('--model');
    });

    it('rejects an invalid --effort choice', () => {
      const r = run(['12345', '--effort', 'extreme']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('--effort');
    });
  });

  describe('missing token', () => {
    it('exits 1 and names the scopes when neither GH_TOKEN nor GITHUB_TOKEN is set', () => {
      const r = run(['12345'], { GH_TOKEN: undefined, GITHUB_TOKEN: undefined });
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/GH_TOKEN|GITHUB_TOKEN/);
      expect(r.stderr).toMatch(/pull_requests|issues|contents|members/);
    });
  });
});
