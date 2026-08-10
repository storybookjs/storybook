// Shared machinery for the two Angular baseline recorders: angular-baselines.test.ts (legacy
// compodoc client path) and angular-component-meta-baselines.test.ts (ACM engine, `acm-` prefixed
// snapshots). Everything here feeds committed snapshot files, so changes must keep recordings
// byte-identical for both recorders.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

import type { ArgTypes } from 'storybook/internal/types';
import { computesTemplateSourceFromComponent } from '../../../../frameworks/angular-vite/src/client/renderer/ComputesTemplateFromComponent.ts';
import { getComponentInputsOutputs } from '../../../../frameworks/angular-vite/src/client/renderer/utils/NgComponentAnalyzer.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { assertGatableAngularSnippet } from '../compare/snippets-angular.ts';

export const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

export const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export const readCommitted = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

type AotCmp = {
  inputs: Record<string, [string, number, null]>;
  outputs: Record<string, string>;
};

type SnippetComponent = Parameters<typeof computesTemplateSourceFromComponent>[0];

// Signal fixtures cannot mount under JIT: bare JIT leaves ɵcmp.inputs/outputs empty, which would
// record `<tag></tag>` artifacts instead of real member bindings. The committed AOT-shaped fragment
// goes on through defineProperty because the JIT decorator installs a getter.
export async function attachAotCmp(
  component: SnippetComponent,
  fixtureCase: string
): Promise<void> {
  if (!existsSync(join(fixturesDir, fixtureCase, 'aot-cmp.ts'))) {
    return;
  }
  const { aotCmp } = (await import(`./__testfixtures__/${fixtureCase}/aot-cmp.ts`)) as {
    aotCmp: AotCmp;
  };
  Object.defineProperty(component, 'ɵcmp', { value: aotCmp, configurable: true });

  const { inputs, outputs } = getComponentInputsOutputs(component);
  for (const [templateName, [propName]] of Object.entries(aotCmp.inputs)) {
    expect(inputs).toContainEqual({ propName, templateName });
  }
  for (const [templateName, propName] of Object.entries(aotCmp.outputs)) {
    expect(outputs).toContainEqual({ propName, templateName });
  }
}

// One snippet snapshot per story export, ratcheted against its committed recording. The stale-file
// check at the end exists because toMatchFileSnapshot files sit outside vitest's obsolete-snapshot
// detection, so a renamed or removed story export would silently leave its old snapshot behind.
export async function recordSnippets({
  fixtureCase,
  component,
  meta,
  stories,
  argTypes,
  recorder,
}: {
  fixtureCase: string;
  component: SnippetComponent;
  meta: { args?: Record<string, unknown> };
  stories: Record<string, { args?: Record<string, unknown> }>;
  argTypes: ArgTypes | undefined;
  recorder: 'legacy' | 'acm';
}): Promise<void> {
  const prefix = recorder === 'acm' ? 'acm-snippet-' : 'snippet-';
  const testDir = join(fixturesDir, fixtureCase);
  expect(Object.keys(stories).length).toBeGreaterThan(0);

  const actionArgNames = Object.entries(argTypes ?? {})
    .filter(([, argType]) => argType.action)
    .map(([name]) => name);

  for (const [exportName, story] of Object.entries(stories)) {
    const props: Record<string, unknown> = { ...meta.args, ...story.args };
    for (const name of actionArgNames) {
      if (!(name in props)) {
        props[name] = () => {};
      }
    }
    const snippetPath = join(testDir, `${prefix}${exportName}.snapshot`);
    const baselines = [readCommitted(snippetPath)];
    if (recorder === 'acm') {
      // Asserted to exist so deleting the legacy files can never silently disarm the parity gate.
      const legacyLabel = `${fixtureCase}/snippet-${exportName}.snapshot`;
      const committedLegacy = readCommitted(join(testDir, `snippet-${exportName}.snapshot`));
      expect(committedLegacy, `missing legacy ${legacyLabel}`).toBeDefined();
      baselines.push(committedLegacy);
    }
    const snippet = computesTemplateSourceFromComponent(component, props, argTypes);
    // null only when the component has no decorator metadata - impossible for these fixtures.
    expect(snippet).not.toBeNull();
    // Every gate runs BEFORE the snapshot call: under `-u` that call queues the rewrite, so a gate
    // placed after it would turn the run red while still persisting the regressed recording.
    assertGatableAngularSnippet(snippet!);
    for (const baseline of baselines) {
      if (baseline !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'angular',
          baseline,
          candidate: snippet!,
        });
      }
    }
    await expect(snippet).toMatchFileSnapshot(snippetPath);
  }

  const snippetFilesOnDisk = readdirSync(testDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.snapshot'))
    .sort();
  const expectedSnippetFiles = Object.keys(stories)
    .map((exportName) => `${prefix}${exportName}.snapshot`)
    .sort();
  expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
}
