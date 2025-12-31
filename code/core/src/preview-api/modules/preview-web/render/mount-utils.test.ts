import { expect, test } from 'vitest';

import { getUsedProps } from './mount-utils';

const StoryWithContext = {
  play: async (context: any) => {
    console.log(context);
  },
};

const StoryWitCanvasElement = {
  play: async ({ canvasElement }: any) => {
    console.log(canvasElement);
  },
};

const MountStory = {
  play: async ({ mount }: any) => {
    await mount();
  },
};

const LongDefinition = {
  play: async ({
    mount,
    veryLongDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn,
    over,
    multiple,
    lines,
  }: any) => {
    await mount();
  },
};

const MethodProperty = {
  async play({
    mount,
    veryLongDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn,
    over,
    multiple,
    lines,
  }: any) {
    await mount();
  },
};

const TranspiledDefinition = {
  play: async (context: any) => {
    const {
      mount,
      veryLongTranspiledDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn,
      over,
      multiple,
      lines,
    } = context;
    await mount();
  },
};

const LateDestructuring = {
  play: async (a: any) => {
    console.log(a);
    const {
      mount,
      veryLongTranspiledDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn,
      over,
      multiple,
      lines,
    } = a;
    await mount();
  },
};

test('Detect basic destructuring', () => {
  expect(getUsedProps(StoryWithContext.play)).toMatchInlineSnapshot(`[]`);
  expect(getUsedProps(StoryWitCanvasElement.play)).toMatchInlineSnapshot(`
    [
      "canvasElement",
    ]
  `);
  expect(getUsedProps(MountStory.play)).toMatchInlineSnapshot(`
    [
      "mount",
    ]
  `);
});

test('Detect multiline destructuring', () => {
  expect(getUsedProps(LongDefinition.play)).toMatchInlineSnapshot(`
    [
      "mount",
      "veryLongDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
      "over",
      "multiple",
      "lines",
    ]
  `);
  expect(getUsedProps(MethodProperty.play)).toMatchInlineSnapshot(`
    [
      "mount",
      "veryLongDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
      "over",
      "multiple",
      "lines",
    ]
  `);
});

test('Detect transpiled destructuring', () => {
  expect(getUsedProps(TranspiledDefinition.play)).toMatchInlineSnapshot(`
    [
      "mount",
      "veryLongTranspiledDefinitionnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn",
      "over",
      "multiple",
      "lines",
    ]
  `);

  expect(getUsedProps(LateDestructuring.play)).toMatchInlineSnapshot(`[]`);
});
