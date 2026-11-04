import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SubprocessError,
  spawnNodeSubprocess,
  spawnSubprocess,
  spawnSubprocessSync,
} from './subprocess.ts';

// These tests spawn real processes: the wrapper's job is to match what the OS and Node report.
const node = process.execPath;
const script = (source: string) => ['-e', source];

describe('spawnSubprocess', () => {
  it('resolves with collected output without the final newline', async () => {
    const result = await spawnSubprocess(
      node,
      script('process.stdout.write("out\\n"); process.stderr.write("err\\n")')
    );

    expect(result).toMatchObject({
      stdout: 'out',
      stderr: 'err',
      exitCode: 0,
      failed: false,
      timedOut: false,
      isCanceled: false,
    });
  });

  it('is a child process whose streams can be read while it runs', async () => {
    const subprocess = spawnSubprocess(node, script('console.log("a"); console.log("b")'));
    const chunks: string[] = [];
    subprocess.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

    const exitCode = await new Promise((resolve) => subprocess.on('exit', resolve));
    await subprocess;

    expect(exitCode).toBe(0);
    expect(chunks.join('')).toBe('a\nb\n');
    expect(typeof subprocess.pid).toBe('number');
  });

  it('rejects with exit code, output and an execa-style message', async () => {
    const error = await spawnSubprocess(
      node,
      script('console.log("some output"); console.error("some error"); process.exit(3)')
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SubprocessError);
    expect(error).toMatchObject({
      exitCode: 3,
      failed: true,
      stdout: 'some output',
      stderr: 'some error',
      shortMessage: expect.stringMatching(/^Command failed with exit code 3: /),
    });
    expect((error as SubprocessError).message).toMatch(
      /^Command failed with exit code 3: .*\n\nsome error\n\nsome output$/s
    );
    expect(error).not.toHaveProperty('code');
  });

  it('rejects with code ENOENT when the command does not exist', async () => {
    const error = await spawnSubprocess('storybook-command-that-does-not-exist', ['--flag']).catch(
      (e: unknown) => e
    );

    expect(error).toMatchObject({
      code: 'ENOENT',
      failed: true,
      shortMessage: expect.stringMatching(
        /^Command failed with ENOENT: storybook-command-that-does-not-exist --flag\n/
      ),
    });
    expect(error).not.toHaveProperty('exitCode');
  });

  it('resolves with the error instead of rejecting when reject is false', async () => {
    const result = await spawnSubprocess(node, script('process.exit(2)'), { reject: false });

    expect(result).toBeInstanceOf(SubprocessError);
    expect(result).toMatchObject({ failed: true, exitCode: 2 });
  });

  it('kills the command after the timeout', async () => {
    const result = await spawnSubprocess(node, script('setTimeout(() => {}, 60_000)'), {
      timeout: 100,
      reject: false,
    });

    expect(result).toMatchObject({ failed: true, timedOut: true, signal: 'SIGTERM' });
    expect((result as SubprocessError).shortMessage).toMatch(
      /^Command timed out after 100 milliseconds: /
    );
  });

  it('uses killSignal for timeouts and kill()', async () => {
    const result = await spawnSubprocess(node, script('setTimeout(() => {}, 60_000)'), {
      timeout: 100,
      killSignal: 'SIGKILL',
      reject: false,
    });

    expect(result).toMatchObject({ timedOut: true, signal: 'SIGKILL' });
  });

  it('kills the command when the cancel signal aborts', async () => {
    const controller = new AbortController();
    const subprocess = spawnSubprocess(node, script('setTimeout(() => {}, 60_000)'), {
      cancelSignal: controller.signal,
    });
    controller.abort();

    await expect(subprocess).rejects.toMatchObject({
      isCanceled: true,
      shortMessage: expect.stringMatching(/^Command was canceled: /),
    });
  });

  it('reports a kill from outside as a signal', async () => {
    const subprocess = spawnSubprocess(node, script('setTimeout(() => {}, 60_000)'));
    subprocess.kill();

    await expect(subprocess).rejects.toMatchObject({
      signal: 'SIGTERM',
      isTerminated: true,
      shortMessage: expect.stringMatching(/^Command was killed with SIGTERM: /),
    });
  });

  it('interleaves stdout and stderr with the all option', async () => {
    const result = await spawnSubprocess(
      node,
      script(
        'process.stdout.write("1\\n"); setTimeout(() => { process.stderr.write("2\\n"); setTimeout(() => process.stdout.write("3\\n"), 20) }, 20)'
      ),
      { all: true }
    );

    expect(result.all).toBe('1\n2\n3');
  });

  it('does not collect output with buffer false', async () => {
    const subprocess = spawnSubprocess(node, script('console.log("x")'), { buffer: false });
    subprocess.stdout?.resume();

    expect((await subprocess).stdout).toBeUndefined();
  });

  it('drains output nobody reads with buffer false, so the process cannot block on a full pipe', async () => {
    const result = await spawnSubprocess(
      node,
      script('process.stdout.write("x".repeat(1e6)); process.stderr.write("y".repeat(1e6))'),
      { buffer: false }
    );

    expect(result.exitCode).toBe(0);
  });

  it('reports a spawn that fails synchronously through the promise, with ended streams', async () => {
    const subprocess = spawnSubprocess(node, ['null\0byte']);

    // Callers such as `execCommandCountLines` read stdout before awaiting.
    const stdoutEnded = new Promise((resolve) => subprocess.stdout?.on('end', resolve).resume());
    await expect(stdoutEnded).resolves.toBeUndefined();
    await expect(subprocess).rejects.toMatchObject({
      failed: true,
      code: 'ERR_INVALID_ARG_VALUE',
    });
  });

  it('strips terminal escape sequences from the error message', async () => {
    const error = await spawnSubprocess(
      node,
      script(
        'process.stderr.write("\\u001b[31mnpm error code ERESOLVE\\u001b[39m"); process.exit(1)'
      )
    ).catch((e: SubprocessError) => e);

    expect(error).toBeInstanceOf(SubprocessError);
    expect((error as SubprocessError).message).toContain('\n\nnpm error code ERESOLVE');
    expect(error.stderr).toBe('\u001b[31mnpm error code ERESOLVE\u001b[39m');
  });

  it('uses only the given env with extendEnv false', async () => {
    const { stdout } = await spawnSubprocess(
      node,
      script('console.log(JSON.stringify([process.env.SB_TEST_VAR, process.env.HOME]))'),
      { env: { SB_TEST_VAR: 'only' }, extendEnv: false }
    );

    expect(JSON.parse(stdout!)).toEqual(['only', null]);
  });

  it('leaves stdout undefined when it is not piped', async () => {
    const result = await spawnSubprocess(node, script(''), { stdio: 'ignore' });

    expect(result.stdout).toBeUndefined();
  });

  it('merges env over process.env by default', async () => {
    const { stdout } = await spawnSubprocess(
      node,
      script('console.log(process.env.SB_TEST_VAR, typeof process.env.PATH)'),
      { env: { SB_TEST_VAR: 'hello' } }
    );

    expect(stdout).toBe('hello string');
  });

  it('runs the command line through a shell with the shell option', async () => {
    const { stdout } = await spawnSubprocess('echo', ['$((1 + 2))'], { shell: true });

    expect(stdout).toBe(process.platform === 'win32' ? '$((1 + 2))' : '3');
  });
});

describe('spawnNodeSubprocess', () => {
  it('runs with the current node binary and exchanges structured-clone messages over IPC', async () => {
    // `-e` takes the next argument as the script source.
    const subprocess = spawnNodeSubprocess('-e', [
      'process.on("message", (m) => { process.send({ echo: m }); process.disconnect(); })',
    ]);
    const reply = new Promise((resolve) => subprocess.on('message', resolve));
    subprocess.send({ hello: new Map([['structured', 'clone']]) });

    expect(await reply).toEqual({ echo: { hello: new Map([['structured', 'clone']]) } });
    await subprocess;
    expect(subprocess.spawnfile).toBe(process.execPath);
  });
});

describe('spawnSubprocessSync', () => {
  it('returns collected output without the final newline', () => {
    const result = spawnSubprocessSync(node, script('console.log("sync out")'));

    expect(result).toMatchObject({ stdout: 'sync out', exitCode: 0, failed: false });
  });

  it('passes arguments containing spaces through as one argument', () => {
    const result = spawnSubprocessSync(node, [
      ...script('console.log(JSON.stringify(process.argv.slice(1)))'),
      'one argument',
    ]);

    expect(JSON.parse(result.stdout!)).toEqual(['one argument']);
  });

  it('throws on a non-zero exit code', () => {
    expect(() =>
      spawnSubprocessSync(node, script('console.error("bad"); process.exit(4)'))
    ).toThrow(expect.objectContaining({ exitCode: 4, stderr: 'bad' }));
  });

  it('throws with code ENOENT when the command does not exist', () => {
    expect(() => spawnSubprocessSync('storybook-command-that-does-not-exist')).toThrow(
      expect.objectContaining({ code: 'ENOENT' })
    );
  });

  it('reports timeouts', () => {
    expect(() =>
      spawnSubprocessSync(node, script('setTimeout(() => {}, 60_000)'), { timeout: 100 })
    ).toThrow(expect.objectContaining({ timedOut: true }));
  });
});

describe.skipIf(process.platform === 'win32')('cleanup', () => {
  const subprocessModule = fileURLToPath(new URL('./subprocess.ts', import.meta.url));

  /**
   * Starts a parent Node process that spawns a long-running child through the wrapper, then sends
   * the parent `signal` and checks that both processes are gone.
   */
  const runParent = async (signal: NodeJS.Signals, { withOtherSignalExitUser = false } = {}) => {
    const parent = spawnSubprocess(
      node,
      [
        '--input-type=module',
        '-e',
        [
          withOtherSignalExitUser ? "import { onExit } from 'signal-exit'; onExit(() => {});" : '',
          `const { spawnSubprocess } = await import(${JSON.stringify(subprocessModule)});`,
          "const child = spawnSubprocess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
          'child.catch(() => {});',
          'console.log(child.pid);',
          'setInterval(() => {}, 1000);',
        ].join('\n'),
      ],
      { buffer: false, reject: false, cwd: fileURLToPath(new URL('.', import.meta.url)) }
    );
    const childPid = await new Promise<number>((resolve) =>
      parent.stdout?.once('data', (chunk: Buffer) => resolve(Number(chunk.toString().trim())))
    );
    parent.kill(signal);
    const result = await parent;

    await expect.poll(() => isAlive(childPid)).toBe(false);
    return result;
  };

  const isAlive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  it.each(['SIGTERM', 'SIGINT'] as const)('kills children and exits on %s', async (signal) => {
    expect(await runParent(signal)).toMatchObject({ signal });
  });

  it('still exits on SIGTERM when another library in the process uses signal-exit', async () => {
    expect(await runParent('SIGTERM', { withOtherSignalExitUser: true })).toMatchObject({
      signal: 'SIGTERM',
    });
  });
});
