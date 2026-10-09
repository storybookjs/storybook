import React, { type ReactNode } from 'react';

import { defaultDecorateStory } from 'storybook/preview-api';

import { previewFiles, workingDir } from 'virtual:@storybook/nextjs-vite-rsc/project';
import { clientFileOf, setNodeFiles } from 'vitest-plugin-rsc/nextjs/internal';
import { cleanup, clientNode, renderServer } from 'vitest-plugin-rsc/nextjs/testing-library';

import { storyOf } from './csf-next.ts';
import { canvasIsThePage, screenFollowsTheBody } from './storybook-internals.ts';
import type { NextJsParameters } from './types.ts';

type StoryContext = {
  id: string;
  component?: unknown;
  // `fileName` is the story file, from Storybook's working directory: `./stories/a.stories.tsx`
  parameters: NextJsParameters & { fileName?: string };
  globals: Record<string, unknown>;
  originalStoryFn: unknown;
  moduleExport: unknown;
  abortSignal: AbortSignal;
};

type RenderContext = {
  storyContext: StoryContext;
  storyFn: () => ReactNode;
  showMain(): void;
  forceRemount: boolean;
};

// A story without a component and without a `render` is the page at its URL
export function render(args: Record<string, unknown>, context: StoryContext): ReactNode {
  const Component = context.component as ((props: object) => ReactNode) | undefined;
  if (!Component) throw pageWithoutUrl(context.id);
  return <Component {...args} />;
}

// The server renders the project's decorators around a client story, and the browser the ones of
// its story file. `features.legacyDecoratorFileOrder` would move this boundary, and is unsupported.
const clientStorySlot = Symbol.for('@storybook/nextjs-vite-rsc/client-story');
let projectHasBoundary = false;

export function clientStoryBoundary(): (Story: () => ReactNode, context: object) => ReactNode {
  projectHasBoundary = true;
  return (Story, context) =>
    clientStorySlot in context ? (
      (context as Record<symbol, ReactNode>)[clientStorySlot]
    ) : (
      <Story />
    );
}

// The project's decorators as a wrapper of `renderServer()` around a client story. A preview in
// CSF 3 has no boundary, and its decorators are not around a client story.
function serverDecorators(storyContext: StoryContext, storyFn: () => ReactNode) {
  if (!projectHasBoundary) return {};
  return {
    wrapper: function ServerDecorators({ children }: { children: ReactNode }) {
      (storyContext as unknown as Record<symbol, ReactNode>)[clientStorySlot] = children;
      return storyFn();
    },
  };
}

// Storybook names a story file from its working directory: `./apps/web/src/a.stories.tsx` is
// `./src/a.stories.tsx` for the root `apps/web`.
function fromRoot(fileName: string): string {
  const parts = [...workingDir.cwd];
  for (const part of fileName.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else parts.push(part);
  }
  let common = 0;
  while (common < workingDir.root.length && workingDir.root[common] === parts[common]) common++;
  return ['.', ...workingDir.root.slice(common).map(() => '..'), ...parts.slice(common)].join('/');
}

// The URL of the iframe to Storybook, which the page of a story changes
let previewPath: string | undefined;
function setUp(): string {
  if (previewPath === undefined) {
    previewPath = window.location.pathname;
    screenFollowsTheBody();
  }
  return previewPath;
}

// The story on the canvas and how to render it again in place, which a page of the app is not
let current: { key: string; rerender(ui: ReactNode): Promise<void> } | undefined;
let renders = 0;

// It has "use client", so importing it loads it in the browser layer, once there is a client story
let clientStory: Promise<{ module: string; name: string }> | undefined;
const loadClientStory = () =>
  (clientStory ??= import('@storybook/nextjs-vite-rsc/internal/client-story').then(
    ({ ClientStory }) => {
      const found = clientFileOf(ClientStory);
      if (!found) {
        throw new Error(
          '@storybook/nextjs-vite-rsc/internal/client-story is not a file of the host'
        );
      }
      return found;
    }
  ));

type ClientStoryOf = { module: string; name: string; test?: string };

// In CSF 3 the story is what the file exports. In CSF Next the file exports what `meta.story()`
// made, and Storybook has the input of that, or of one of its `.test()`s.
function clientStoryOf(context: StoryContext): ClientStoryOf | undefined {
  const file = clientFileOf(context.moduleExport);
  if (file) return file;
  const registered = storyOf(context.moduleExport);
  const story = registered && clientFileOf(registered.story);
  return story && { module: story.module, name: story.name, test: registered.test };
}

// Storybook reloads the preview when an aborted render has not stopped after a few tasks, and the
// URL of the preview is the page's by then. A page load takes longer, so a render stops as soon as
// it is aborted, and the teardown leaves the page that may still be loading.
function untilAborted(rendering: Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborted = () => resolve();
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) resolve();
    rendering.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

export async function renderToCanvas(
  context: RenderContext,
  canvasElement: HTMLElement
): Promise<() => Promise<void>> {
  const path = setUp();
  await untilAborted(renderStory(context, canvasElement), context.storyContext.abortSignal);
  return async () => {
    current = undefined;
    await cleanup();
    // Storybook names the story in the query of the iframe's URL
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path + window.location.search);
    }
  };
}

async function renderStory(
  { storyContext, storyFn, showMain, forceRemount }: RenderContext,
  canvasElement: HTMLElement
): Promise<void> {
  const nextjs = storyContext.parameters.nextjs ?? {};
  const { url, headers, layouts, proxy } = nextjs;
  // Storybook does not wait for this render when it renders the story again while its play
  // function runs
  const { abortSignal: signal } = storyContext;
  const ticket = ++renders;
  const superseded = () => signal.aborted || ticket !== renders;
  const thrown = renderOnTheServer(storyContext);
  const file = clientStoryOf(storyContext);
  const isPage = !storyContext.component && storyContext.originalStoryFn === render;
  if (isPage) assertPage(storyContext, file);
  const story = async (): Promise<ReactNode> => {
    if (!file) {
      const Story = () => storyFn();
      return <Story />;
    }
    // The context is passed as it is, not through Flight: a spy in the args is the play function's
    const { module, name } = await loadClientStory();
    return clientNode(module, name, {
      file: file.module,
      name: file.name,
      test: file.test,
      context: () => storyContext,
    });
  };

  // A story renders again in place, keeping the state of its Client Components, as long as its
  // request stays, and for a client story the globals, which the project's decorators around it
  // get on the server. Those render once per page, with the args the page loaded with.
  const key = JSON.stringify([storyContext.id, nextjs, file ? storyContext.globals : null]);
  const shown = current;
  if (!forceRemount && shown?.key === key) {
    try {
      await shown.rerender(await story());
      if (superseded()) return;
      if (thrown.error !== undefined) return showServerError(thrown.error);
      if (layouts === true) canvasIsThePage(storyContext);
      showMain();
      return;
    } catch {
      if (current === shown) current = undefined;
      if (superseded()) return;
      if (thrown.error !== undefined) return showServerError(thrown.error);
    }
  }

  current = undefined;
  await cleanup();
  if (superseded()) return;
  // React hydrates the `<body>` of a page, on which Storybook sets classes when it shows a story:
  // that comes first, or React would find a class the server did not render
  const ownsDocument = isPage || layouts === true;
  if (ownsDocument) showMain();
  try {
    if (isPage) {
      await renderServer({ url: url!, headers, proxy });
    } else {
      const node = await story();
      if (superseded()) return;
      // The CSS of what the preview and its story file import, not that of another story file
      const { fileName } = storyContext.parameters;
      setNodeFiles([...previewFiles, ...(fileName ? [fromRoot(fileName)] : [])]);
      const { rerender } = await renderServer(node, {
        url,
        headers,
        proxy,
        ...(file && serverDecorators(storyContext, storyFn)),
        ...(layouts ? { layouts } : { container: canvasElement }),
      });
      if (!superseded()) current = { key, rerender };
    }
  } catch (error) {
    if (superseded()) return;
    throw thrown.error ?? error;
  }
  if (superseded()) return;
  if (thrown.error !== undefined) return showServerError(thrown.error);
  if (ownsDocument) canvasIsThePage(storyContext);
  else showMain();
}

const pageWithoutUrl = (id: string) =>
  new Error(
    `The story ${id} has no component and no render function, so it is a page of the app, ` +
      `which needs a URL to open: add \`parameters: { nextjs: { url: "/notes" } }\`, with the ` +
      `path of the page. For a story of a component, give it a \`component\` or a \`render\`.`
  );

function assertPage(context: StoryContext, file: ClientStoryOf | undefined) {
  const { id } = context;
  if (file) {
    throw new Error(
      `The story ${id} is a page of the app, but its story file has "use client": a page ` +
        `renders on the server, and a story of a file with "use client" in the browser. Move ` +
        `the page story to a story file without the directive, or give it a component.`
    );
  }
  const { url, layouts } = context.parameters.nextjs ?? {};
  if (!url) throw pageWithoutUrl(id);
  if (layouts !== undefined) {
    throw new Error(
      `The story ${id} is a page of the app, which renders in its layouts already: ` +
        `\`parameters.nextjs.layouts\` is for a story of a component. Remove it.`
    );
  }
}

type StoryFn = (context: StoryContext) => ReactNode;

export const applyDecorators = (storyFn: StoryFn, decorators: never[]): StoryFn =>
  (defaultDecorateStory as unknown as (story: StoryFn, decorators: never[]) => StoryFn)(
    (context) => explainServerErrors(() => storyFn(context), context),
    decorators
  );

// What a story's render function threw when the server rendered it, which Storybook shows in place
// of Next's error page. An error of a component or a decorator is Next's to show.
const thrownSlot = Symbol.for('@storybook/nextjs-vite-rsc/thrown');
type Thrown = { error?: unknown };

function renderOnTheServer(context: StoryContext): Thrown {
  const thrown: Thrown = {};
  (context as unknown as Record<symbol, Thrown>)[thrownSlot] = thrown;
  return thrown;
}

async function showServerError(error: unknown): Promise<never> {
  current = undefined;
  await cleanup();
  throw error;
}

// On the server React has no hooks with state: they are not a function there
const serverHook = /\b(use[A-Z]\w*)\b[^\n]* is not a function/;

function explainServerErrors(storyFn: () => ReactNode, context: StoryContext): ReactNode {
  const { id } = context;
  const explain = (error: unknown) => {
    const thrown = (context as unknown as Record<symbol, Thrown | undefined>)[thrownSlot];
    const result = explained(error);
    if (thrown) thrown.error = result;
    return result;
  };
  const explained = (error: unknown) => {
    const hook = serverHook.exec(error instanceof Error ? error.message : '')?.[1];
    if (!hook) return error;
    return new Error(
      `The story ${id} calls ${hook}() on the server. A story file without "use client" is ` +
        `server code, as a file of the app is in Next: its components and its render ` +
        `function are Server Components. Add "use client" at the top of the story file to ` +
        `render its stories in the browser, or move ${hook}() into a Client Component.`,
      { cause: error }
    );
  };
  try {
    const result = storyFn();
    return result instanceof Promise
      ? (result.catch((error: unknown) => {
          throw explain(error);
        }) as unknown as ReactNode)
      : result;
  } catch (error) {
    throw explain(error);
  }
}
