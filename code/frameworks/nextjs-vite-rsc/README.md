# Storybook for Next.js with React Server Components (experimental)

`@storybook/nextjs-vite-rsc` runs your Next.js App Router app in Storybook the way [vitest-plugin-rsc](https://github.com/storybookjs/vitest-plugin-rsc) runs it in a test: the Next.js server runs in the browser, and every story is a real request to your app. Server Components, `headers()`, `cookies()`, Server Actions, `proxy.ts`, Next's router and caching work as they do in the app.

It is experimental, and it lives next to [`@storybook/nextjs-vite`](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite?ref=readme), which mocks Next.js instead of running it.

## Requirements

- Next.js 16.4 or later, with the App Router, and `@next/routing` at the version of `next`
- React 19
- Vite 8

## Set up

```sh
npm create storybook@next -- --type nextjs_vite_rsc
```

Or install `@storybook/nextjs-vite-rsc`, `vite` and `@next/routing` (at the version of `next`) yourself, and configure Storybook:

```ts
// .storybook/main.ts
import { defineMain } from '@storybook/nextjs-vite-rsc/node';

export default defineMain({
  stories: ['../app/**/*.stories.tsx', '../components/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/nextjs-vite-rsc',
    options: {
      // Modules of the preview that have to know they run in a browser, like MSW: see
      // `browserModules` of vitest-plugin-rsc.
      browserModules: ['**/node_modules/msw/**', '**/node_modules/@mswjs/**'],
    },
  },
});
```

```ts
// .storybook/preview.ts
import addonDocs from '@storybook/addon-docs';
import { definePreview } from '@storybook/nextjs-vite-rsc';

import '../app/globals.css';

export default definePreview({ addons: [addonDocs()] });
```

The framework brings vitest-plugin-rsc itself. A `vite.config.ts` of the project that adds the plugin for Vitest would add it a second time: point Storybook at a Vite config of its own with `builder: { viteConfigPath }` in the framework options.

The examples import `.storybook/preview.ts` as `#.storybook/preview`, with `"imports": { "#*": ["./*", "./*.ts", "./*.tsx"] }` in `package.json`. A relative path works as well.

A story has the CSS of what `.storybook/preview` and its own story file import, as Next links it, in dev and in a static build: not the CSS of another story file.

## Three kinds of story

A story file is server code, as a file of your app is. The directive at the top decides where its stories render.

| Kind                   | Story file                                   | Renders                                                                                                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A story of a component | no directive                                 | The component and `render` are Server Components, which can be `async`. They render on a route of their own, in a request of the app. |
| A client story         | `"use client"`                               | In the browser, as a Client Component. An arg can be a function, like a spy of `storybook/test`, and `render` can have state.         |
| A page                 | no directive, no `component` and no `render` | The route of the app at `parameters.nextjs.url`, in its layouts, as a browser opens it.                                               |

```tsx
// components/request-info.stories.tsx: a Server Component that reads the request
import preview from '#.storybook/preview';

import { RequestInfo } from './request-info';

const meta = preview.meta({
  component: RequestInfo,
  parameters: { nextjs: { headers: { cookie: 'flavor=chocolate' } } },
});

export const Default = meta.story();
```

```tsx
// app/notes/page.stories.tsx: a page of the app
import preview from '#.storybook/preview';

import { expect, userEvent } from 'storybook/test';

const meta = preview.meta({
  title: 'Pages/Notes',
  parameters: { layout: 'fullscreen', nextjs: { url: '/notes' } },
});

export const Empty = meta.story({
  async play({ canvas }) {
    await expect(await canvas.findByText('No notes yet')).toBeVisible();
  },
});

Empty.test('links to the form for a new note', async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('link', { name: 'Create your first note' }));
  await expect(await canvas.findByRole('heading', { level: 1, name: 'New note' })).toBeVisible();
});
```

```tsx
// components/submit-button.stories.tsx: a client story
'use client';

import preview from '#.storybook/preview';

import { expect, fn, userEvent, waitFor } from 'storybook/test';

import { SubmitButton } from './submit-button';

// `preview.type()` adds an arg that the render function takes.
const meta = preview.type<{ args: { onSave: () => void } }>().meta({
  component: SubmitButton,
  args: { children: 'Save note', onSave: fn() },
  render: ({ onSave, ...args }) => (
    <form action={async () => onSave()}>
      <SubmitButton {...args} />
    </form>
  ),
});

export const Pending = meta.story({
  async play({ args, canvas }) {
    await userEvent.click(await canvas.findByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(args.onSave).toHaveBeenCalledOnce());
  },
});
```

A story seeds what its page reads in `beforeEach`, as a test does, and mocks modules with `sb.mock()` in `.storybook/preview.ts`. The preview is the server's own module graph, so a database or a session that a story sets up is the one the Server Components read. `sb.mock()` mocks the modules of that graph: what Server Components, Server Actions and route handlers import. It takes a relative path: Storybook resolves the path from its own package, which does not know the `imports` of yours.

The decorators of `definePreview()` are Server Components around every story, also around a client story. The decorators of a client story and of its meta render in the browser, inside them.

## Parameters

`parameters.nextjs` is the request a story renders in:

| Parameter | What it does                                                                                                                                                         | Default                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `url`     | The URL of the request. A page story opens the route at this URL. For a story of a component it is what `usePathname()`, `useParams()` and `useSearchParams()` read. | `/`                                                   |
| `headers` | Headers of the request, next to the ones a browser sends, like `cookie`.                                                                                             | none                                                  |
| `layouts` | For a story of a component: renders it in place of the page at `url`, inside the app's layouts.                                                                      | `false`                                               |
| `proxy`   | Runs `proxy.ts` and the redirects, rewrites and headers of `next.config` for the request.                                                                            | `true` for a page, `false` for a story of a component |

The framework says so when a story is used wrong, with what to do instead: a hook in the `render` of a story without `"use client"`, a page story without `url`, `layouts` on a page story, or a page story in a file with `"use client"`.

## Docs

Autodocs and MDX docs pages work with `@storybook/addon-docs`. A docs page renders with React DOM, so it is code of the browser layer, as a client story is. Every story on a docs page renders in an iframe of its own (`docs.story.inline` is `false`), since the app runs once per document.

## Static build

`storybook build` builds the three layers of the app with Vite's app builder: the framework turns on `features.viteAppBuilder` of `@storybook/builder-vite`.

## Portable stories

`composeStories()`, `composeStory()` and `setProjectAnnotations()` compose a story of CSF 3 with the annotations of the framework. A story of CSF Next has `Story.run()`. Running them in Vitest also needs the framework's Vite setup there, which is not done yet.

## Not yet supported

- Controls and argTypes inferred from the props of a component.
- `@storybook/addon-vitest`, which runs stories as Vitest tests.
- Cache Components (`cacheComponents` in `next.config`).
- Stories inline on a docs page: each one renders in an iframe.
- `parameters.docs.components` from a story file without `"use client"`.
- A preview in CSF 3, without `definePreview()`: it works, but its decorators do not wrap a client story.
- An error of a component or of a decorator that the server renders shows the error page of Next in the canvas. An error of a story's own `render` shows in Storybook.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
