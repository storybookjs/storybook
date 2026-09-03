import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function replaceMarker(body: string, marker: string, replacement: string): string {
  const pattern = new RegExp(
    `(<!-- ${escapeRegExp(marker)} -->)(.*?)(<!-- ${escapeRegExp(marker)} -->)`,
    's'
  );
  const matches = body.match(new RegExp(pattern.source, 'gs'));
  if (matches?.length !== 1) {
    throw new Error(`expected 1 ${marker} pair, found ${matches?.length ?? 0}`);
  }
  return body.replace(
    pattern,
    (_match, open, _inner, close) => `${open}\n${replacement}\n${close}`
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv: string[]): {
  repo: string;
  pr: string;
  markers: { marker: string; file: string }[];
} {
  let repo = '';
  let pr = '';
  const markers: { marker: string; file: string }[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') {
      repo = argv[(i += 1)] ?? '';
      continue;
    }
    if (arg === '--pr') {
      pr = argv[(i += 1)] ?? '';
      continue;
    }
    if (arg === '--marker') {
      const marker = argv[(i += 1)];
      const file = argv[(i += 1)];
      if (!marker || !file) {
        throw new Error('--marker requires MARKER and FILE');
      }
      markers.push({ marker, file });
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }

  if (!repo || !pr || markers.length === 0) {
    throw new Error('usage: --repo REPO --pr NUMBER --marker MARKER FILE');
  }

  return { repo, pr, markers };
}

function ghJson(args: string[], input?: string): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
}

function main(): void {
  const { repo, pr, markers } = parseArgs(process.argv.slice(2));

  let body = ghJson(['api', `repos/${repo}/pulls/${pr}`, '--jq', '.body']);
  if (body.endsWith('\n')) {
    body = body.slice(0, -1);
  }

  for (const { marker, file } of markers) {
    body = replaceMarker(body, marker, readFileSync(file, 'utf8').replace(/\n$/, ''));
  }

  ghJson(
    ['api', '--method', 'PATCH', `repos/${repo}/pulls/${pr}`, '--input', '-'],
    JSON.stringify({ body })
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
