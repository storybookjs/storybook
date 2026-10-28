import { fileURLToPath } from 'node:url';

import { basename } from 'pathe';
import { afterEach, expect, it } from 'vitest';

import { createStorybook } from './create-storybook.ts';
import {
  bindToInstance,
  getStorybook,
  runWithStorybook,
  tryGetStorybook,
} from './instance-context.ts';
import { defineAddon } from './plugins.ts';
import type { Storybook } from './types.ts';

type Probe = (label: string) => void;

const FIRST = fileURLToPath(new URL('./__fixtures__/first', import.meta.url));
const SECOND = fileURLToPath(new URL('./__fixtures__/second', import.meta.url));
const MAIN_ACCESSOR = fileURLToPath(new URL('./__fixtures__/main-accessor', import.meta.url));
const NO_COMMON = defineAddon(() => ({ meta: { name: 'test/common' }, setup(): void {} }))();

const opened: Storybook[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((storybook) => storybook.close()));
});

/** Which instance `getStorybook()` sees, by config directory, or the error it throws. */
function seen(): string {
  try {
    return basename(getStorybook().configDir);
  } catch (error) {
    return (error as Error).message;
  }
}

/** Create a minimal instance whose addon reports what `getStorybook()` sees at each point. */
async function open(configDir: string, record: Probe): Promise<Storybook> {
  const probe = defineAddon(() => ({
    meta: { name: 'test/probe' },
    setup(storybook): void {
      record(`setup matches parameter: ${getStorybook() === storybook}`);
      storybook.hook('core:instance:ready', async () => {
        record(`hook handler: ${seen()}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        record(`async continuation: ${seen()}`);
      });
    },
  }))();
  const storybook = await createStorybook(
    { configDir, mode: 'headless', main: { stories: [], addons: [probe] } },
    { common: NO_COMMON, builtInAddons: [] }
  );
  opened.push(storybook);
  return storybook;
}

it('resolves the running instance at each point of its lifecycle', async () => {
  const log: string[] = [];
  await open(FIRST, (entry) => log.push(entry));

  expect(log).toMatchInlineSnapshot(`
    [
      "setup matches parameter: true",
      "hook handler: first",
      "async continuation: first",
    ]
  `);
});

it('gives two concurrent instances each their own', async () => {
  const logs: Record<string, string[]> = { first: [], second: [] };
  await Promise.all([
    open(FIRST, (entry) => logs.first.push(entry)),
    open(SECOND, (entry) => logs.second.push(entry)),
  ]);

  expect(logs).toMatchInlineSnapshot(`
    {
      "first": [
        "setup matches parameter: true",
        "hook handler: first",
        "async continuation: first",
      ],
      "second": [
        "setup matches parameter: true",
        "hook handler: second",
        "async continuation: second",
      ],
    }
  `);
});

it('restores the instance for callbacks bound inside it and fired outside', async () => {
  let later: (() => string) | undefined;
  const storybook = await open(SECOND, () => {
    later ??= bindToInstance(seen);
  });
  const cases = {
    'bound callback, fired outside': later!(),
    'unbound call outside': seen(),
    'tryGetStorybook outside': String(tryGetStorybook()),
    runWithStorybook: runWithStorybook(storybook, seen),
  };

  expect(cases).toMatchInlineSnapshot(`
    {
      "bound callback, fired outside": "second",
      "runWithStorybook": "second",
      "tryGetStorybook outside": "undefined",
      "unbound call outside": "getStorybook() was called outside a Storybook instance.

    Use the storybook passed to setup(storybook). Wrap callbacks that run outside the instance, such as worker or library callbacks, with bindToInstance() where they are registered.",
    }
  `);
});

it('throws while main.ts is being evaluated', async () => {
  const globals = globalThis as { __mainAccessorProbe?: () => void };
  let duringMain: string | undefined;
  globals.__mainAccessorProbe = () => {
    duringMain = seen();
  };
  try {
    opened.push(
      await createStorybook(
        { configDir: MAIN_ACCESSOR, mode: 'headless' },
        { common: NO_COMMON, builtInAddons: [] }
      )
    );
  } finally {
    delete globals.__mainAccessorProbe;
  }

  expect(duringMain).toMatchInlineSnapshot(`
    "getStorybook() was called while main.ts was being evaluated, before the Storybook instance exists.

    Call it from a plugin's setup(storybook) or from a hook handler instead."
  `);
});
