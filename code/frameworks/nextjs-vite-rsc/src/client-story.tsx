'use client';

import React, { type ComponentType, type ReactNode, use, useEffect, useMemo } from 'react';

import { getStoryChildren, isStory } from 'storybook/internal/csf';
import { HooksContext, normalizeStory, prepareStory } from 'storybook/preview-api';

import { importClientModule } from 'vitest-plugin-rsc/nextjs/client-node';

// A page has a module graph of its own, so it imports the story file itself and composes the story
// from it. The args and the rest of the context are the preview's: a spy in an arg is the one the
// play function asserts on.

type Context = {
  id: string;
  title: string;
  componentId: string;
  component?: ComponentType<Record<string, unknown>>;
  [key: string]: unknown;
};

type Prepared = {
  component?: Context['component'];
  originalStoryFn: unknown;
  unboundStoryFn(context: Context): ReactNode;
};

const prepare = prepareStory as unknown as (
  story: object,
  meta: object,
  project: object
) => Prepared;
const normalize = normalizeStory as unknown as (
  name: string,
  story: unknown,
  meta: object
) => object;

function render(args: Record<string, unknown>, { id, component: Component }: Context): ReactNode {
  if (!Component) {
    throw new Error(`Unable to render story ${id}: give it a component, or a render function.`);
  }
  return <Component {...args} />;
}

// In CSF Next the export is what `meta.story()` made, and the story can be one of its `.test()`s
function annotationsOf(
  csf: Record<string, unknown>,
  name: string,
  test: string | undefined
): { meta: object; story: unknown } {
  const exported = csf[name];
  if (!isStory(exported)) return { meta: csf.default as object, story: exported };
  const story = test
    ? getStoryChildren(exported).find((child) => child.input.name === test)
    : exported;
  if (!story) throw new Error(`The story ${name} has no test named "${test}"`);
  return { meta: exported.meta.input, story: story.input };
}

export function ClientStory({
  file,
  name,
  test,
  context,
}: {
  file: string;
  name: string;
  test?: string;
  context(): Context;
}): ReactNode {
  const csf = use(importClientModule<Record<string, unknown>>(file));
  // What Storybook worked out for the file, which its meta may leave out
  const { title, componentId } = context();
  const story = useMemo(() => {
    const annotations = annotationsOf(csf, name, test);
    const meta = { ...annotations.meta, title, id: componentId };
    return prepare(normalize(test ?? name, annotations.story, meta), meta, { render });
  }, [csf, name, test, title, componentId]);
  // The hooks of the preview are for the decorators it runs on the server
  const hooks = useMemo(() => new HooksContext(), []);
  useEffect(() => () => hooks.clean(), [hooks]);
  return story.unboundStoryFn({
    ...context(),
    component: story.component,
    originalStoryFn: story.originalStoryFn,
    hooks,
  });
}
