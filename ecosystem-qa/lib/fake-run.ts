import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { join } from 'pathe';

import { checksFor } from '../checks.ts';
import type { Outcome, RunRequest } from './types.ts';

const TOOLS_DIR = fileURLToPath(new URL('../tools', import.meta.url));
const NULL_SHA = '0'.repeat(40);

const frame = (title: string, color: string) =>
  `data:text/html,<body style="font:32px sans-serif;background:${color}"><h1>${title}</h1><p>ecosystem-qa --fake</p></body>`;

export const runFake = (request: RunRequest): Outcome => {
  const evidenceDir = join(request.outDir, 'evidence');
  const framesDir = join(evidenceDir, 'fake-frames');
  mkdirSync(framesDir, { recursive: true });
  const tool = (name: string, ...args: string[]) =>
    execFileSync(process.execPath, [join(TOOLS_DIR, name), ...args], { stdio: 'inherit' });

  tool('shot.mjs', frame('Before: canned fake frame', '%23e0f2fe'), join(framesDir, '01.png'));
  tool('shot.mjs', frame('After: canned fake frame', '%23fee2e2'), join(framesDir, '02.png'));
  tool('shot.mjs', frame('Fake finding screenshot', '%23fee2e2'), join(evidenceDir, 'fake.png'));
  tool('gif.mjs', framesDir, join(evidenceDir, 'fake.gif'), '--delay', '800');
  writeFileSync(join(evidenceDir, 'fake.log'), 'Error: canned fake failure from --fake\n');
  writeFileSync(join(request.outDir, 'run.log'), 'ecosystem-qa --fake: no agent ran.\n');
  writeFileSync(
    join(request.outDir, 'agent-stream.jsonl'),
    `${JSON.stringify({
      type: 'assistant',
      message: {
        id: 'fake-message',
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          cache_read_input_tokens: 5000,
          cache_creation_input_tokens: 2000,
        },
      },
    })}\n`
  );

  const failing = 'core.story-render';
  return {
    status: 'ok',
    startSha: NULL_SHA,
    headSha: null,
    output: {
      storybookVersionBefore: '10.6.0',
      storybookVersionInstalled: request.version,
      checks: checksFor(request.tier).map(({ id, label }) =>
        id === failing
          ? { id, label, state: 'fail', note: 'Canned failure from --fake.' }
          : { id, label, state: 'pass' }
      ),
      findings: [
        {
          checkId: failing,
          title: 'Fake finding from the --fake test seam',
          baseline: 'pass',
          expected: 'Nothing; this finding is canned',
          actual: 'A fake run always reports this finding',
          errorText: `Error: canned fake failure at ${evidenceDir}/fake.log:1:1 on ${request.version}`,
          reproSteps: [
            `git clone https://github.com/${request.entry.repo}`,
            'Run node ecosystem-qa/run.ts with --fake and ECOSYSTEM_QA_FAKE=1',
          ],
          evidence: { png: 'fake.png', gif: 'fake.gif', logs: ['fake.log'] },
          windowsOnly: false,
          severityHint: 'S4',
        },
      ],
    },
  };
};
