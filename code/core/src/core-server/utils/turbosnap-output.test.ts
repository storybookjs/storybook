import { createHash } from 'node:crypto';
import * as disk from 'node:fs/promises';

import type { Stats } from 'storybook/internal/types';

import { fs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTurbosnapOutputFinalizer } from './turbosnap-output.ts';

vi.mock('node:fs/promises', { spy: true });
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const stats = (): Stats => ({
  toJson: () => ({ modules: [] }),
  turbosnapOutput: {
    status: 'complete',
    reason: 'verified',
    builder: { name: '@storybook/builder-vite', version: '1' },
    outputFiles: { 'entry.js': digest('entry') },
    globalOutputHash: 'global',
    storyOutputHashes: { './src/A.stories.tsx': 'story' },
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
  vol.reset();
  vol.fromJSON({
    '/project/config/storybook/main.ts': 'main',
    '/project/output/entry.js': 'entry',
  });
  vi.spyOn(process, 'cwd').mockReturnValue('/project');
  vi.mocked(disk.readFile).mockImplementation(fs.promises.readFile as typeof disk.readFile);
  vi.mocked(disk.readdir).mockImplementation(fs.promises.readdir as typeof disk.readdir);
  vi.mocked(disk.realpath).mockImplementation(fs.promises.realpath as typeof disk.realpath);
});

async function finish(metadata?: string, components?: { source: string; canonical: string }) {
  const finalize = await createTurbosnapOutputFinalizer(
    '/project/config/storybook',
    '/project/output',
    '/project/output'
  );
  return (await finalize(stats(), metadata, components))!.toJson().turbosnapOutput;
}

describe('final output evidence', () => {
  it('anchors a custom config directory to the build working directory', async () => {
    const evidence = await finish();
    expect(evidence).toMatchObject({
      status: 'complete',
      projectRoot: './',
      configDir: './config/storybook',
    });
    expect(evidence.configFiles['./config/storybook/main.ts'].hash).toBe(digest('main'));
  });

  it('vetoes late output changes and config inventory changes', async () => {
    const finalize = await createTurbosnapOutputFinalizer(
      '/project/config/storybook',
      '/project/output',
      '/project/output'
    );
    vol.writeFileSync('/project/output/entry.js', 'late mutation');
    expect((await finalize(stats()))!.toJson().turbosnapOutput.reason).toBe(
      'output-changed-after-fingerprint'
    );
    vol.writeFileSync('/project/config/storybook/new.json', '{}');
    expect((await finalize(stats()))!.toJson().turbosnapOutput.reason).toBe(
      'config-changed-during-build'
    );
  });

  it('binds all final assets and includes their content globally', async () => {
    vol.writeFileSync('/project/output/style.css', 'red');
    const before = await finish();
    vol.writeFileSync('/project/output/style.css', 'blue');
    const after = await finish();
    expect(before.globalOutputHash).not.toBe(after.globalOutputHash);
    expect(after.outputFiles['style.css']).toBe(digest('blue'));
  });

  it('normalizes only the timestamp in exact core-generated telemetry while binding raw bytes', async () => {
    const first = '{"generatedAt":1,"framework":"react"}';
    vol.writeFileSync('/project/output/project.json', first);
    const before = await finish(first);
    const second = '{"generatedAt":2,"framework":"react"}';
    vol.writeFileSync('/project/output/project.json', second);
    const after = await finish(second);
    expect(before.globalOutputHash).toBe(after.globalOutputHash);
    expect(before.outputFiles['project.json']).not.toBe(after.outputFiles['project.json']);
    const changed = '{"generatedAt":2,"framework":"next"}';
    vol.writeFileSync('/project/output/project.json', changed);
    expect((await finish(changed)).globalOutputHash).not.toBe(after.globalOutputHash);
    expect((await finish(second)).reason).toBe('metadata-changed-after-generation');
  });

  it('does not normalize an arbitrary static project.json without core provenance', async () => {
    vol.writeFileSync('/project/output/project.json', '{"generatedAt":1}');
    const before = await finish();
    vol.writeFileSync('/project/output/project.json', '{"generatedAt":2}');
    expect((await finish()).globalOutputHash).not.toBe(before.globalOutputHash);
  });

  it('binds generated diagnostic HTML before using its canonical duration', async () => {
    vol.mkdirSync('/project/output/manifests');
    const html = (duration: number, label = 'Button') =>
      `<h1>${label}</h1>Generation took ${duration}s`;
    const first = { source: html(1), canonical: html(0) };
    vol.writeFileSync('/project/output/manifests/components.html', first.source);
    const before = await finish(undefined, first);
    const second = { source: html(2), canonical: html(0) };
    vol.writeFileSync('/project/output/manifests/components.html', second.source);
    const after = await finish(undefined, second);
    expect(after.globalOutputHash).toBe(before.globalOutputHash);
    expect(after.outputFiles['manifests/components.html']).not.toBe(
      before.outputFiles['manifests/components.html']
    );
    expect((await finish()).globalOutputHash).not.toBe(after.globalOutputHash);
    const changed = { source: html(2, 'Changed'), canonical: html(0, 'Changed') };
    vol.writeFileSync('/project/output/manifests/components.html', changed.source);
    expect((await finish(undefined, changed)).globalOutputHash).not.toBe(after.globalOutputHash);
    expect((await finish(undefined, second)).reason).toBe('metadata-changed-after-generation');
  });

  it('rejects symlinked output and excludes only the supplied stats file and CLI bookkeeping', async () => {
    vol.mkdirSync('/project/output/.chromatic');
    vol.writeFileSync('/project/output/.chromatic/manifest.json', '{}');
    vol.writeFileSync('/project/output/preview-stats.json', '{}');
    expect(Object.keys((await finish()).outputFiles)).toEqual(['entry.js']);
    vol.symlinkSync('/project/config/storybook/main.ts', '/project/output/link.js');
    expect((await finish()).status).toBe('incomplete');
  });
});
