// The two client-side Angular baseline recorders: angular-baselines.test.ts (legacy compodoc path)
// and angular-component-meta-baselines.test.ts (ACM engine, `acm-` prefixed snapshots). Everything
// here feeds committed snapshot files, so changes must keep recordings byte-identical for both.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from 'vitest';

import type { ArgTypes } from 'storybook/internal/types';
import { computesTemplateSourceFromComponent } from '../../../../frameworks/angular-vite/src/client/renderer/ComputesTemplateFromComponent.ts';
import { getComponentInputsOutputs } from '../../../../frameworks/angular-vite/src/client/renderer/utils/NgComponentAnalyzer.ts';
import { expectNoStaleSnippets, fixturesDir, recordSnippet } from './snippet-recorder.ts';

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

// A noop handler is synthesized for every action argType, standing in for the one addon-actions
// injects at runtime.
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
    const snippet = computesTemplateSourceFromComponent(component, props);
    // null only when the component has no decorator metadata - impossible for these fixtures.
    expect(snippet).not.toBeNull();
    await recordSnippet({
      testDir,
      prefix,
      exportName,
      snippet: snippet!,
      legacyParity: recorder === 'acm',
    });
  }

  expectNoStaleSnippets(testDir, prefix, Object.keys(stories));
}
