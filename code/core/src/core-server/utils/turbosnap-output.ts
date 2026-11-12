import { createHash } from 'node:crypto';
import { readFile, readdir, realpath } from 'node:fs/promises';

import type { Stats, TurbosnapOutput } from 'storybook/internal/types';

import { isAbsolute, join, relative, resolve } from 'pathe';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const key = (root: string, file: string) => {
  const path = relative(root, file);
  return path.startsWith('../') ? path : `./${path}`;
};

async function inventory(
  directory: string,
  excluded: Set<string> = new Set()
): Promise<Record<string, { hash: string; realPath: string }>> {
  const files: Record<string, { hash: string; realPath: string }> = {};
  async function visit(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (excluded.has(path)) continue;
      if (entry.isSymbolicLink()) throw new Error('symlinked-evidence-input');
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files[relative(directory, path)] = {
          hash: digest(await readFile(path)),
          realPath: await realpath(path),
        };
      else throw new Error('nonregular-evidence-input');
    }
  }
  await visit(directory);
  return Object.fromEntries(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right))
  );
}

export async function createTurbosnapOutputFinalizer(
  configDir: string,
  outputDir: string,
  statsDirectory: string
) {
  const workingDir = process.cwd();
  let initial: Awaited<ReturnType<typeof inventory>> | undefined;
  try {
    initial = await inventory(configDir);
  } catch {
    /* Evidence remains unavailable. */
  }

  return async (
    stats: Stats | void,
    projectMetadata?: string,
    componentsMetadata?: { source: string; canonical: string }
  ): Promise<Stats | void> => {
    if (!stats?.turbosnapOutput) return stats;
    const draft = stats.turbosnapOutput;
    const data = stats.toJson();
    const evidence: TurbosnapOutput = {
      ...draft,
      version: 1,
      projectRoot: './',
      configDir: key(workingDir, configDir),
      modulesHash: digest(JSON.stringify(data.modules ?? null)),
      configFiles: {},
      outputFiles: {},
    };
    try {
      if (!Array.isArray(data.modules)) throw new Error('missing-module-list');
      const current = await inventory(configDir);
      if (!initial || JSON.stringify(initial) !== JSON.stringify(current))
        throw new Error('config-changed-during-build');
      evidence.configFiles = Object.fromEntries(
        Object.entries(current).map(([name, file]) => [
          key(workingDir, join(configDir, name)),
          { hash: file.hash, realPath: key(workingDir, file.realPath) },
        ])
      );
      const outputs = await inventory(
        outputDir,
        new Set([resolve(statsDirectory, 'preview-stats.json'), join(outputDir, '.chromatic')])
      );
      evidence.outputFiles = Object.fromEntries(
        Object.entries(outputs).map(([name, file]) => [name, file.hash])
      );
      for (const [name, hash] of Object.entries(draft.outputFiles)) {
        if (isAbsolute(name) || name.startsWith('../') || outputs[name]?.hash !== hash)
          throw new Error('output-changed-after-fingerprint');
      }
      const extras = Object.entries(evidence.outputFiles).filter(
        ([name]) => !(name in draft.outputFiles)
      );
      if (projectMetadata !== undefined) {
        if (evidence.outputFiles['project.json'] !== digest(projectMetadata))
          throw new Error('metadata-changed-after-generation');
        const { generatedAt: _generatedAt, ...metadata } = JSON.parse(projectMetadata);
        const entry = extras.find(([name]) => name === 'project.json');
        if (entry) entry[1] = digest(JSON.stringify(metadata));
      }
      if (componentsMetadata) {
        if (evidence.outputFiles['manifests/components.html'] !== digest(componentsMetadata.source))
          throw new Error('metadata-changed-after-generation');
        const entry = extras.find(([name]) => name === 'manifests/components.html');
        if (entry) entry[1] = digest(componentsMetadata.canonical);
      }
      evidence.globalOutputHash = digest(JSON.stringify([draft.globalOutputHash, extras]));
    } catch (error) {
      evidence.status = 'incomplete';
      evidence.reason = error instanceof Error ? error.message : 'unreadable-build-output';
    }
    return { toJson: () => ({ ...data, turbosnapOutput: evidence }) };
  };
}
