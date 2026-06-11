import type { PrContext } from '../types.ts';

/**
 * Dependency-additions precompute for Check 4 (cost/benefit).
 *
 * Reports newly-added runtime + peer dependencies. We deliberately ignore
 * devDependencies because Check 4 is about *runtime* maintenance cost — a new
 * test dep is essentially free, whereas a new runtime dep affects every
 * downstream consumer.
 *
 * Subtlety the test suite captures: a `+ "foo": "^1.0.0",` line on its own
 * could be either (a) a genuinely new entry or (b) the SAME entry with a
 * trailing comma added because a newer entry was inserted after it. We track
 * removed names per section and skip additions whose name was also removed —
 * that filters out comma-only modifications.
 */
export interface AddedDeps {
  runtime: string[];
  peer: string[];
}

const DEP_LINE = /^[+\-]\s*"([^"]+)"\s*:\s*"([^"]+)"/;

type Section = 'none' | 'dependencies' | 'peerDependencies' | 'other';

interface Bucket {
  added: Map<string, string>;
  removed: Set<string>;
}

export function computeAddedDependencies(files: PrContext['files']): AddedDeps {
  const buckets: Record<'dependencies' | 'peerDependencies', Bucket> = {
    dependencies: { added: new Map(), removed: new Set() },
    peerDependencies: { added: new Map(), removed: new Set() },
  };

  for (const file of files) {
    if (file.path !== 'package.json' && !file.path.endsWith('/package.json')) continue;
    if (!file.patch) continue;
    let section: Section = 'none';
    for (const line of file.patch.split('\n')) {
      if (line.startsWith('@@')) {
        section = 'none';
        continue;
      }
      const trimmed = line.replace(/^[+\- ]/, '').trim();
      if (trimmed.includes('"dependencies"')) section = 'dependencies';
      else if (trimmed.includes('"peerDependencies"')) section = 'peerDependencies';
      else if (/^"[a-zA-Z]+Dependencies"\s*:/.test(trimmed)) section = 'other';

      if (section !== 'dependencies' && section !== 'peerDependencies') continue;
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      const match = DEP_LINE.exec(line);
      if (!match) continue;
      const [, name, version] = match;
      if (line.startsWith('+')) buckets[section].added.set(name, version);
      else if (line.startsWith('-')) buckets[section].removed.add(name);
    }
  }

  const collect = (b: Bucket): string[] => {
    const out: string[] = [];
    for (const [name, version] of b.added) {
      if (b.removed.has(name)) continue;
      out.push(`${name}@${version}`);
    }
    return out;
  };

  return {
    runtime: collect(buckets.dependencies),
    peer: collect(buckets.peerDependencies),
  };
}
