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

const WithComment = {
  play: async (context: any) => {
    const {
      // a comment
      mount,
    } = context;
    await mount();
  },
};

const WithTrailingComment = {
  play: async (context: any) => {
    const {
      mount, // a comment
    } = context;
    await mount();
  },
};

const WithMultipleComments = {
  play: async (context: any) => {
    const {
      mount, // a comment
      // another comment
    } = context;
    await mount();
  },
};

const WithBlockComments = {
  play: async (context: any) => {
    const { mount /* a comment */ } = context;
    /* another comment */
    await mount();
    /* third comment */
  },
};

const testingScope = {
  mount: async (m: any) => {
    return 'testingScope.mount';
  },
};

const IncorrectMount = {
  play: async (context: any) => {
    const { mount } = testingScope;
    const { mount: sbMount } = context;
    mount(await sbMount());
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

test('Detect with comment', () => {
  expect(getUsedProps(WithComment.play)).toMatchInlineSnapshot(`
      [
        "mount",
      ]
    `);
});

test('Detect with trailing comment', () => {
  expect(getUsedProps(WithTrailingComment.play)).toMatchInlineSnapshot(`
    [
      "mount",
    ]
  `);
});

test('Detect with multiple comments', () => {
  expect(getUsedProps(WithMultipleComments.play)).toMatchInlineSnapshot(`
    [
      "mount",
    ]
  `);
});

test('Detect with block comments', () => {
  expect(getUsedProps(WithBlockComments.play)).toMatchInlineSnapshot(`
    [
      "mount",
    ]
  `);
});

test('Detect incorrect mount', () => {
  expect(getUsedProps(IncorrectMount.play)).toMatchInlineSnapshot(`[]`);
});
