import type { Meta, Preview, Story } from 'storybook/internal/csf';

// For the input of a CSF Next story, which Storybook has as `moduleExport`, the story that the story
// file exports, which the plugin knows a client story by, and the test it is. A story context that
// has its CSF Next story would replace this.

type Registered = { story: object; test?: string };

const stories = new WeakMap<object, Registered>();

export function storyOf(input: unknown): Registered | undefined {
  return typeof input === 'object' && input !== null ? stories.get(input) : undefined;
}

// A test is of the story that the story file exports. A story that `extend()` makes is exported
// itself.
function register(story: Story<any>, exported: object = story, test?: string): Story<any> {
  stories.set(story.input, { story: exported, test });
  const defineTest = story.test.bind(story);
  story.test = ((name: string, ...rest: unknown[]) =>
    register(
      (defineTest as (...args: unknown[]) => Story<any>)(name, ...rest),
      exported,
      name
    )) as typeof story.test;
  const extend = story.extend.bind(story);
  story.extend = ((input: never) => register(extend(input) as Story<any>)) as typeof story.extend;
  return story;
}

export function registerStories<P>(input: P): P {
  const preview = input as unknown as Preview<any>;
  const defineMeta = preview.meta.bind(preview);
  preview.meta = ((metaInput: never) => {
    const meta = defineMeta(metaInput) as Meta<any>;
    const defineStory = meta.story.bind(meta);
    meta.story = ((storyInput?: never) =>
      register(defineStory(storyInput) as Story<any>)) as typeof meta.story;
    return meta;
  }) as typeof preview.meta;
  return input;
}
