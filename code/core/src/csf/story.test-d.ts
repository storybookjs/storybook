import type {
  AfterEach,
  BeforeEach,
  DecoratorFunction,
  LoaderFunction,
  PlayFunction,
  StoryContextUpdate,
} from './story.ts';

const loader: LoaderFunction = (context) => {
  // @ts-expect-error lifecycle argTypes cannot be assigned to application values
  const invalid: number = context.argTypes;
  void invalid;
  // @ts-expect-error argTypes are unavailable during lifecycle hooks
  return Object.keys(context.argTypes);
};

const beforeEach: BeforeEach = (context) => {
  // @ts-expect-error argTypes are unavailable during lifecycle hooks
  void Object.keys(context.argTypes);
};

const play: PlayFunction = (context) => {
  // @ts-expect-error argTypes are unavailable during lifecycle hooks
  void Object.keys(context.argTypes);
};

const afterEach: AfterEach = (context) => {
  // @ts-expect-error argTypes are unavailable during lifecycle hooks
  void Object.keys(context.argTypes);
};

const decorator: DecoratorFunction = (story, context) => {
  Object.keys(context.argTypes);
  return story(context);
};

const update: StoryContextUpdate = { custom: 'value' };

void [loader, beforeEach, play, afterEach, decorator, update];
