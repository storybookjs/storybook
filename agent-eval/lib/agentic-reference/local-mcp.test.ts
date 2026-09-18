import type { Sandbox } from '@vercel/agent-eval';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LOCAL_STORYBOOK_MCP_PORT,
  type ResolvedStorybookMcpPackage,
  type StorybookMcpPackageSpec,
  assertStorybookMcpPackageSpec,
  buildLocalMcpSetupScript,
  packageTarballUrl,
  resolveStorybookMcpPackage,
  setupLocalStorybookMcp,
} from './local-mcp.ts';

const SPEC: StorybookMcpPackageSpec = {
  repo: 'storybook-tmp/base-ui',
  packageName: '@storybook-tmp/baseui-mcp',
  branch: 'experiment/empty',
};

const SHA = 'a'.repeat(40);

const RESOLVED: ResolvedStorybookMcpPackage = { ...SPEC, sha: SHA };

/** A sandbox whose `bash` invocation returns a fixed CommandResult. */
function mockSandbox(result: { exitCode: number; stdout?: string; stderr?: string }) {
  const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '', ...result });
  const writeFiles = vi.fn().mockResolvedValue(undefined);
  // Reject like a missing file, which config readers treat as "start fresh".
  const readFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
  const sandbox = { runCommand, writeFiles, readFile } as unknown as Sandbox;
  return { sandbox, runCommand, writeFiles };
}

// Every field is interpolated into a bash script, so malformed means
// shell-unsafe as much as it means typo'd.
const MALFORMED: Array<[string, StorybookMcpPackageSpec]> = [
  ['a space in the repo', { ...SPEC, repo: 'a b/c' }],
  ['a repo without an owner', { ...SPEC, repo: 'base-ui' }],
  ['a shell substitution in the branch', { ...SPEC, branch: '$(id)' }],
  ['a quote in the package name', { ...SPEC, packageName: "a'b" }],
  ['a semicolon in the package name', { ...SPEC, packageName: 'a;rm' }],
];

describe('assertStorybookMcpPackageSpec', () => {
  it('accepts a well-formed spec', () => {
    expect(() => assertStorybookMcpPackageSpec(SPEC)).not.toThrow();
  });

  it.each(MALFORMED)('throws on %s', (_label, spec) => {
    expect(() => assertStorybookMcpPackageSpec(spec)).toThrow(/storybookMcpPackage/);
  });
});

describe('packageTarballUrl', () => {
  it('builds the sha-addressed long-form pkg.pr.new URL', () => {
    expect(packageTarballUrl(SPEC, SHA)).toBe(
      `https://pkg.pr.new/storybook-tmp/base-ui/@storybook-tmp/baseui-mcp@${SHA}`
    );
  });
});

describe('buildLocalMcpSetupScript', () => {
  it('embeds the tarball URL and port, and keeps plumbing outside the workspace', () => {
    const script = buildLocalMcpSetupScript(packageTarballUrl(SPEC, SHA), LOCAL_STORYBOOK_MCP_PORT);
    expect(script).toContain(`@storybook-tmp/baseui-mcp@${SHA}`);
    expect(script).toContain(`--port ${LOCAL_STORYBOOK_MCP_PORT}`);
    expect(script).toContain('$HOME/.storybook-mcp');
    expect(script).toContain('"method":"initialize"');
  });

  it('fetches and probes with node, never curl (the sandbox has no curl)', () => {
    const script = buildLocalMcpSetupScript(packageTarballUrl(SPEC, SHA), LOCAL_STORYBOOK_MCP_PORT);
    expect(script).not.toContain('curl');
    // Download and readiness probe both go through `node -e`.
    expect(script).toContain('node -e');
    expect(script).toContain('AbortSignal.timeout');
  });
});

describe('setupLocalStorybookMcp', () => {
  // A login shell (`bash -lc`) runs ~/.bash_logout on exit, whose
  // `clear_console` step fails in the ttyless sandbox exec and masks the
  // script's real exit code with a bare 1 and no output. The script must run in
  // a non-login shell so its own exit status survives.
  it('runs the setup script in a non-login shell', async () => {
    const { sandbox, runCommand } = mockSandbox({ exitCode: 0 });
    await setupLocalStorybookMcp(sandbox, RESOLVED, 'claude-code');

    expect(runCommand).toHaveBeenCalledWith('bash', expect.any(Array));
    const [command, args] = runCommand.mock.calls[0] as [string, string[]];
    expect(command).toBe('bash');
    expect(args[0]).toBe('-c');
    expect(args).not.toContain('-lc');
  });

  it('surfaces the exit code and both output streams when the script fails', async () => {
    const { sandbox } = mockSandbox({
      exitCode: 137,
      stdout: 'stdout-diagnostic',
      stderr: 'stderr-diagnostic',
    });

    const error = await setupLocalStorybookMcp(sandbox, RESOLVED, 'claude-code').catch((e) => e);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('exit code 137');
    expect(message).toContain('stderr-diagnostic');
    expect(message).toContain('stdout-diagnostic');
    expect(message).toContain(`${SPEC.packageName}@${SHA}`);
  });

  it('says so explicitly when a failing script produced no output', async () => {
    const { sandbox } = mockSandbox({ exitCode: 1 });
    const error = await setupLocalStorybookMcp(sandbox, RESOLVED, 'claude-code').catch((e) => e);
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toContain('exit code 1');
    expect(message).toMatch(/no output/i);
  });
});

describe('resolveStorybookMcpPackage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The module-level resolution cache is keyed by repo@branch and shared across
  // tests, so each test resolves its own branch name.
  it('resolves the branch head and records it for the run pin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sha: SHA }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const spec = { ...SPEC, branch: 'experiment/resolve-test' };
    await expect(resolveStorybookMcpPackage(spec)).resolves.toEqual({ ...spec, sha: SHA });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/storybook-tmp/base-ui/commits/experiment%2Fresolve-test',
      expect.anything()
    );
  });

  it('caches per repo@branch so every run of an experiment pins the same sha', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ sha: SHA }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const spec = { ...SPEC, branch: 'experiment/cache-test' };
    await resolveStorybookMcpPackage(spec);
    await resolveStorybookMcpPackage(spec);
    // One commits-API call plus one publish pre-flight, for the first resolve only.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails when the branch head has no published package', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
        init?.method === 'HEAD'
          ? new Response(null, { status: 404 })
          : new Response(JSON.stringify({ sha: SHA }), { status: 200 })
      )
    );

    await expect(
      resolveStorybookMcpPackage({ ...SPEC, branch: 'experiment/unpublished-test' })
    ).rejects.toThrow(/was never published for that commit/);
  });

  it('lets the download step decide when the pre-flight cannot reach the registry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'HEAD') throw new Error('network down');
        return new Response(JSON.stringify({ sha: SHA }), { status: 200 });
      })
    );

    const spec = { ...SPEC, branch: 'experiment/preflight-offline-test' };
    await expect(resolveStorybookMcpPackage(spec)).resolves.toEqual({ ...spec, sha: SHA });
  });

  it('reports the branch and the publish prerequisite on an API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));

    await expect(
      resolveStorybookMcpPackage({ ...SPEC, branch: 'experiment/missing-test' })
    ).rejects.toThrow(/experiment\/missing-test.*storybook-mcp-preview/s);
  });

  it('rejects a malformed commits API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ sha: 'not-a-sha' }), { status: 200 }))
    );

    await expect(
      resolveStorybookMcpPackage({ ...SPEC, branch: 'experiment/malformed-test' })
    ).rejects.toThrow(/unexpected commits API response/);
  });

  it('never resolves before validating the spec', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveStorybookMcpPackage({ ...SPEC, branch: '$(id)' })).rejects.toThrow(
      /storybookMcpPackage/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
