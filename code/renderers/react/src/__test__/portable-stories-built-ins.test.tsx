// @vitest-environment happy-dom
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import React, { type ComponentProps } from 'react';

import { setProjectAnnotations as setCollectedProjectAnnotations } from 'storybook/internal/preview-api';
import { BUILT_IN_PREVIEW_ANNOTATIONS } from 'storybook/internal/preview/built-in-annotations';
import { composeStory as composeHostStory } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import {
  INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
  __definePreview,
  composeStories,
  composeStory,
  setProjectAnnotations,
} from '../index.ts';
import type { ReactRenderer } from '../types.ts';

type Spy = ReturnType<typeof fn>;

interface Probe {
  args: Record<string, unknown>;
  run: () => Promise<void>;
}

const Button = ({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
  onSubmit?: () => void;
}) => <button onClick={onClick}>{label}</button>;

const clickButton = {
  play: async ({ canvas, userEvent }: any) => {
    await userEvent.click(canvas.getByRole('button'));
  },
};

const metaInput = (onClick: Spy) => ({
  component: Button,
  args: { label: 'Submit', onClick },
  argTypes: { onSubmit: { action: 'submitted' } },
});

/** Two stories that click the same meta-level spy, composed the way each API composes them. */
const composeClassic = (onClick: Spy): Probe[] => {
  const { First, Second } = composeStories({
    default: metaInput(onClick),
    First: clickButton,
    Second: clickButton,
  });
  return [First, Second].map((story) => ({ args: story.args, run: () => story.run() }));
};

const composeFactories = (onClick: Spy): Probe[] => {
  const meta = __definePreview({ addons: [] }).meta(metaInput(onClick));
  return [meta.story(clickButton), meta.story(clickButton)].map((story) => ({
    args: story.composed.args,
    run: () => story.run(),
  }));
};

beforeEach(() => {
  vi.stubGlobal('globalProjectAnnotations', undefined);
  vi.stubGlobal('defaultProjectAnnotations', undefined);
  vi.stubGlobal('__STORYBOOK_ADDON_VITEST_PROJECT_ANNOTATIONS_APPLIED__', undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('outside a Storybook host', () => {
  it.each([
    { name: 'composeStories', compose: composeClassic },
    {
      name: 'composeStories after setProjectAnnotations',
      compose: (onClick: Spy) => {
        setProjectAnnotations([]);
        return composeClassic(onClick);
      },
    },
    // Last: definePreview points the project annotations global at its preview.
    { name: 'CSF factories', compose: composeFactories },
  ])('$name applies the built-in annotations', async ({ compose }) => {
    const onClick = fn();
    const [first, second] = compose(onClick);

    expect(first.args.onSubmit).toHaveProperty('isAction', true);

    await first.run();
    expect(onClick).toHaveBeenCalledOnce();

    await second.run();
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('each built-in loader runs once', () => {
  // Distinct objects, like the built files addon-vitest collects.
  const collected = () => BUILT_IN_PREVIEW_ANNOTATIONS.map((annotations) => ({ ...annotations }));

  it.each([
    {
      name: 'setProjectAnnotations with a CSF factories preview',
      compose: (onClick: Spy) => {
        setProjectAnnotations(__definePreview({ addons: [] }).composed);
        const story = composeStory(clickButton, metaInput(onClick));
        return { run: () => story.run() };
      },
    },
    {
      name: 'addon-vitest classic stories',
      compose: (onClick: Spy) => {
        setCollectedProjectAnnotations([...collected(), INTERNAL_DEFAULT_PROJECT_ANNOTATIONS]);
        const story = composeHostStory<ReactRenderer, ComponentProps<typeof Button>>(
          clickButton,
          metaInput(onClick)
        );
        return { run: () => story.run() };
      },
    },
    {
      name: 'addon-vitest CSF factories',
      compose: (onClick: Spy) => {
        const preview = __definePreview({ addons: [] });
        preview.composeWith(collected());
        const story = preview.meta(metaInput(onClick)).story(clickButton);
        return { run: () => story.run() };
      },
    },
  ])('$name', async ({ compose }) => {
    const onClick = fn();
    const nameSpy = vi.spyOn(onClick, 'mockName');

    await compose(onClick).run();

    expect(nameSpy).toHaveBeenCalledOnce();
  });
});
