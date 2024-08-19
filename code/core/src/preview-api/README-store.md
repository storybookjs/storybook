# Storybook Store

The store is responsible for loading a story from a CSF file and preparing into a `Story` type, which is our internal format.

## Story vs StoryContext

Story functions and decorators receive a `StoryContext<Framework>` object (parameterized by their framework).

The `Story` type that we pass around in our code includes all of those fields apart from the `args`, `globals`, `hooks` and `viewMode`, which are mutable and stored separately in the store.

## Identification

The first set of fields on a `Story` are the identifying fields for a story:

- `componentId` - the URL "id" of the component
- `title` - the title of the component, which generates the sidebar entry
- `id` - the story "id" (in the URL)
- `name` - the name of the story

## Annotations

The main fields on a `Story` are the various annotations. Annotations can be set:

- At the project level in `preview.js` (or via addons)
- At the component level via `export default { ... }` in a CSF file
- At the story level via `export const Story = {...}` in a CSF file.

Not all annotations can be set at every level but most can.

## Parameters

The story parameters is a static, serializable object of data that provides details about the story. Those details can be used by addons or Storybook itself to render UI or provide defaults about the story rendering.

Parameters _cannot change_ and are synchronized to the manager once when the story is loaded (note over the lifetime of a development Storybook a story can be loaded several times due to hot module reload, so the parameters technically can change for that reason).

Usually addons will read from a single key of `parameters` namespaced by the name of that addon. For instance the configuration of the `backgrounds` addon is driven by the `parameters.backgrounds` namespace.

Parameters are inheritable -- you can set project parameters via `export parameters = {}`, at the component level by the `parameters` key of the component (default) export in CSF, and on a single story via the `parameters` key on the story data.

Some notable parameters:

- `parameters.fileName` - the file that the story was defined in, when available

## Args

Args are "inputs" to stories.

You can think of them equivalently to React props, Angular inputs and outputs, etc.

Changing the args cause the story to be re-rendered with the new set of args.

### Using args in a story

By default the args will be passed to the story as first argument and the context as second:

```js
const YourStory = ({ x, y } /*, context*/) => /* render your story using `x` and `y` */
```

### Arg types and values

Arg types are used by the docs addon to populate the props table and are documented there. They are controlled by `argTypes` and can (sometimes) be automatically inferred from type information about the story or the component rendered by the story.

A story can set initial values of its args with the `args` annotation. If you set an initial value for an arg that doesn't have a type a simple type will be inferred from the value.

If an arg doesn't have an initial value, it will start unset, although it can still be set later via user interaction.

Args can be set at the project, component and story level.

### Using args in an addon

Args values are automatically synchronized (via the `changeStoryArgs` and `storyArgsChanged` events) between the preview and manager; APIs exist in `lib/api` to read and set args in the manager.

Args need to be serializable -- so currently cannot include callbacks (this may change in a future version).

Note that arg values are passed directly to a story -- you should only store the actual value that the story needs to render in the arg. If you need more complex information supporting that, use parameters or addon state.

Both `@storybook/preview-api` and `@storybook/manager-api` export a `useArgs()` hook that you can use to access args in decorators or addon panels. The API is as follows:

```js
import { useArgs } from '@storybook/preview-api';

// or '@storybook/manager-api'

// `args` is the args of the currently rendered story
// `updateArgs` will update its args. You can pass a subset of the args; other args will not be changed.
const [args, updateArgs] = useArgs();
```

## ArgTypes

Arg types add type information and metadata about args that are used to control the docs and controls addons.

### ArgTypes enhancement

To add a argTypes enhancer, `export const argTypesEnhancers = []` from `preview.js` or and addon

There is a default enhancer that ensures that each `arg` in a story has a baseline `argType`. This value can be improved by subsequent enhancers, e.g. those provided by `@storybook/addon-docs`.

## Globals

Globals are rendering information that is global across stories. They are used for things like themes and internationalization (i18n) in stories, where you want Storybook to "remember" your setting as you browse between stories.

They can be accessed in stories and decorators in the `context.globals` key.

### Initial values of globals

To set initial values of globals, `export const globals = {...}` from `preview.js`

### Using globals in an addon

Similar to args, globals are synchronized to the manager and can be accessed via the `useGlobals` hook.

```js
import { useGlobals } from '@storybook/preview-api';

// or '@storybook/manager-api'

const [globals, updateGlobals] = useGlobals();
```

## Technical details

### Initialization

- The store is created "uninitialized".
- It is assumed at some later time it will be initialized with the Story Index, the set of stories (this may be loaded async).
- You _can_ call `loadStory` prior to that time, in which case it will wait for initialization.

### Caching

- "All story" APIs like `extract()` require all stories to be loaded.
- For backwards-compatibility, these APIs are _not_ async, so it is required that `store.cacheAllCSFFiles()` is called first
- In v6 mode, this will be called on initialization but `start.ts`.
