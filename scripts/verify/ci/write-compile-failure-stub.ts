// CI helper: writes a synthetic `regression` verdict when the install/compile
// phase aborts before `yarn verify-pr` can run. Replaces the inline bash
// `write_compile_failure_stub` previously embedded in
// `.github/workflows/verify-pr.yml`.
//
// Invocation:
//   node ./scripts/verify/ci/write-compile-failure-stub.ts \
//     --log <path-to-compile.log> \
//     --out-dir <path-to-.verify-output>
//
// The script tails the last 4 KB of the compile log, strips ANSI escape
// sequences, and routes through `writeRegressionResult` in `core.ts` so the
// verdict-file schema stays single-sourced.

import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { buildRunPaths, stripAnsi, writeRegressionResult } from '../core.ts';

interface Args {
  log: string;
  outDir: string;
  template?: string;
}

function parseCliArgs(argv: string[]): Args {
  const { values } = parseArgs({
    args: argv,
    options: {
      log: { type: 'string' },
      'out-dir': { type: 'string' },
      template: { type: 'string' },
    },
    strict: true,
  });
  if (!values.log || !values['out-dir']) {
    throw new Error('usage: write-compile-failure-stub --log <path> --out-dir <path> [--template <name>]');
  }
  return {
    log: values.log,
    outDir: values['out-dir'],
    template: values.template,
  };
}

function tailBytes(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, 'utf-8');
  if (buf.length <= maxBytes) return text;
  return buf.subarray(buf.length - maxBytes).toString('utf-8');
}

export async function writeCompileFailureStub(args: Args): Promise<string> {
  const resolvedLog = resolve(args.log);
  const resolvedOutDir = resolve(args.outDir);
  mkdirSync(resolvedOutDir, { recursive: true });

  let raw = '';
  try {
    raw = readFileSync(resolvedLog, 'utf-8');
  } catch {
    raw = '';
  }
  // Drop NUL bytes (occasional NX subprocess output) then strip ANSI.
  const cleaned = stripAnsi(tailBytes(raw, 4000).replace(/\0/g, ''));

  const paths = buildRunPaths(undefined, resolvedOutDir);
  // Trusted-context script (runs in workflow bash, not inside srt). Sign the
  // stub so derive-verdict.ts accepts it the same way as orchestrator-written
  // results — keeps the verification gate uniform.
  const secret = process.env.VERIFY_PROVENANCE_SECRET;
  await writeRegressionResult(
    paths,
    'compile failure (see regressionDetails)',
    {
      template: args.template ?? 'internal-ui',
      details: cleaned,
    },
    undefined,
    secret
  );
  return paths.resultJson;
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  writeCompileFailureStub(args)
    .then((p) => {
      console.log(`[verify] compile failure — wrote stub verdict to ${p}`);
    })
    .catch((err) => {
      console.error('[write-compile-failure-stub] error:', err?.message ?? err);
      process.exit(1);
    });
}
