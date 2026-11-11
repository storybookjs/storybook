import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { join } from 'pathe';

const REDACTED = '[redacted]';

// Credential shapes a run could leak through agent prose or a log: provider keys, GitHub tokens,
// and HTTP auth headers. Actions masks only the exact secret value, so encoded forms need this.
const SECRET_PATTERNS = [
  /sk-ant-[\w-]{10,}/g,
  /sk-(?:proj-)?[\w-]{20,}/g,
  /github_pat_\w{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /(authorization:\s*basic\s+)\S+/gi,
  /(bearer\s+)[\w.~+/=-]{20,}/gi,
];

const BASE64_RUN = /[A-Za-z0-9+/]{40,}={0,2}/g;

const decodesToSecret = (run: string): boolean => {
  const decoded = Buffer.from(run, 'base64').toString('utf8');
  return (
    decoded.startsWith('x-access-token:') ||
    SECRET_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags).test(decoded))
  );
};

export const redactSecrets = (text: string): string => {
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, prefix?: string) =>
      typeof prefix === 'string' ? `${prefix}${REDACTED}` : REDACTED
    );
  }
  return redacted.replace(BASE64_RUN, (run) => (decodesToSecret(run) ? REDACTED : run));
};

/**
 * Copy an evidence file, redacting credentials when it is text. A file counts as text when it is
 * valid UTF-8 without a NUL byte, whatever its extension; images and other binaries are copied as
 * they are.
 */
export const copyRedacted = (source: string, target: string): void => {
  const content = readFileSync(source);
  const text = content.toString('utf8');
  const isText = !content.includes(0) && Buffer.from(text, 'utf8').equals(content);
  writeFileSync(target, isText ? redactSecrets(text) : content);
};

/** Redact every regular text file under `dir` in place; symlinks and binaries are left alone. */
export const redactTree = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      redactTree(path);
    } else if (entry.isFile()) {
      copyRedacted(path, path);
    }
  }
};
