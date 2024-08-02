import { dedent } from 'ts-dedent';
import { StorybookError } from './storybook-error';

/**
 * If you can't find a suitable category for your error, create one
 * based on the package name/file path of which the error is thrown.
 * For instance:
 * If it's from @storybook/client-logger, then CLIENT-LOGGER
 *
 * Categories are prefixed by a logical grouping, e.g. PREVIEW_ or FRAMEWORK_
 * to prevent manager and preview errors from having the same category and error code.
 */
export enum Category {
  BLOCKS = 'BLOCKS',
  DOCS_TOOLS = 'DOCS-TOOLS',
  PREVIEW_CLIENT_LOGGER = 'PREVIEW_CLIENT-LOGGER',
  PREVIEW_CHANNELS = 'PREVIEW_CHANNELS',
  PREVIEW_CORE_EVENTS = 'PREVIEW_CORE-EVENTS',
  PREVIEW_INSTRUMENTER = 'PREVIEW_INSTRUMENTER',
  PREVIEW_API = 'PREVIEW_API',
  PREVIEW_REACT_DOM_SHIM = 'PREVIEW_REACT-DOM-SHIM',
  PREVIEW_ROUTER = 'PREVIEW_ROUTER',
  PREVIEW_THEMING = 'PREVIEW_THEMING',
  RENDERER_HTML = 'RENDERER_HTML',
  RENDERER_PREACT = 'RENDERER_PREACT',
  RENDERER_REACT = 'RENDERER_REACT',
  RENDERER_SERVER = 'RENDERER_SERVER',
  RENDERER_SVELTE = 'RENDERER_SVELTE',
  RENDERER_VUE = 'RENDERER_VUE',
  RENDERER_VUE3 = 'RENDERER_VUE3',
  RENDERER_WEB_COMPONENTS = 'RENDERER_WEB-COMPONENTS',
  FRAMEWORK_NEXTJS = 'FRAMEWORK_NEXTJS',
}

export class MissingStoryAfterHmrError extends StorybookError {
  constructor(public data: { storyId: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 1,
      message: dedent`
        Couldn't find story matching id '${data.storyId}' after HMR.
        - Did you just rename a story?
        - Did you remove it from your CSF file?
        - Are you sure a story with the id '${data.storyId}' exists?
        - Please check the values in the stories field of your main.js config and see if they would match your CSF File.
        - Also check the browser console and terminal for potential error messages.`,
    });
  }
}

export class ImplicitActionsDuringRendering extends StorybookError {
  constructor(public data: { phase: string; name: string; deprecated: boolean }) {
    super({
      category: Category.PREVIEW_API,
      code: 2,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#using-implicit-actions-during-rendering-is-deprecated-for-example-in-the-play-function',
      message: dedent`
        We detected that you use an implicit action arg while ${data.phase} of your story.  
        ${data.deprecated ? `\nThis is deprecated and won't work in Storybook 8 anymore.\n` : ``}
        Please provide an explicit spy to your args like this:
          import { fn } from '@storybook/test';
          ... 
          args: {
           ${data.name}: fn()
          }`,
    });
  }
}

export class CalledExtractOnStoreError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 3,
      message: dedent`
        Cannot call \`storyStore.extract()\` without calling \`storyStore.cacheAllCsfFiles()\` first.

        You probably meant to call \`await preview.extract()\` which does the above for you.`,
    });
  }
}

export class MissingRenderToCanvasError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 4,
      message: dedent`
        Expected your framework's preset to export a \`renderToCanvas\` field.

        Perhaps it needs to be upgraded for Storybook 7.0?`,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-framework-field',
    });
  }
}

export class CalledPreviewMethodBeforeInitializationError extends StorybookError {
  constructor(public data: { methodName: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 5,
      message: dedent`
        Called \`Preview.${data.methodName}()\` before initialization.
        
        The preview needs to load the story index before most methods can be called. If you want
        to call \`${data.methodName}\`, try \`await preview.initializationPromise;\` first.
        
        If you didn't call the above code, then likely it was called by an addon that needs to
        do the above.`,
    });
  }
}

export class StoryIndexFetchError extends StorybookError {
  constructor(public data: { text: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 6,
      message: dedent`
        Error fetching \`/index.json\`:
        
        ${data.text}

        If you are in development, this likely indicates a problem with your Storybook process,
        check the terminal for errors.

        If you are in a deployed Storybook, there may have been an issue deploying the full Storybook
        build.`,
    });
  }
}

export class MdxFileWithNoCsfReferencesError extends StorybookError {
  constructor(public data: { storyId: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 7,
      message: dedent`
        Tried to render docs entry ${data.storyId} but it is a MDX file that has no CSF
        references, or autodocs for a CSF file that some doesn't refer to itself.
        
        This likely is an internal error in Storybook's indexing, or you've attached the
        \`attached-mdx\` tag to an MDX file that is not attached.`,
    });
  }
}

export class EmptyIndexError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 8,
      message: dedent`
        Couldn't find any stories in your Storybook.

        - Please check your stories field of your main.js config: does it match correctly?
        - Also check the browser console and terminal for error messages.`,
    });
  }
}

export class NoStoryMatchError extends StorybookError {
  constructor(public data: { storySpecifier: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 9,
      message: dedent`
        Couldn't find story matching '${data.storySpecifier}'.

        - Are you sure a story with that id exists?
        - Please check your stories field of your main.js config.
        - Also check the browser console and terminal for error messages.`,
    });
  }
}

export class MissingStoryFromCsfFileError extends StorybookError {
  constructor(public data: { storyId: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 10,
      message: dedent`
        Couldn't find story matching id '${data.storyId}' after importing a CSF file.

        The file was indexed as if the story was there, but then after importing the file in the browser
        we didn't find the story. Possible reasons:
        - You are using a custom story indexer that is misbehaving.
        - You have a custom file loader that is removing or renaming exports.

        Please check your browser console and terminal for errors that may explain the issue.`,
    });
  }
}

export class StoryStoreAccessedBeforeInitializationError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 11,
      message: dedent`
        Cannot access the Story Store until the index is ready.

        It is not recommended to use methods directly on the Story Store anyway, in Storybook 9 we will
        remove access to the store entirely`,
    });
  }
}

export class MountMustBeDestructuredError extends StorybookError {
  constructor(public data: { playFunction: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 12,
      message: dedent`
      Incorrect use of mount in the play function.
      
      To use mount in the play function, you must satisfy the following two requirements: 
      
      1. You *must* destructure the mount property from the \`context\` (the argument passed to your play function). 
         This makes sure that Storybook does not start rendering the story before the play function begins.
      
      2. Your Storybook framework or builder must be configured to transpile to ES2017 or newer. 
         This is because destructuring statements and async/await usages are otherwise transpiled away, 
         which prevents Storybook from recognizing your usage of \`mount\`.
      
      Note that Angular is not supported. As async/await is transpiled to support the zone.js polyfill. 
      
      More info: https://storybook.js.org/docs/writing-tests/interaction-testing#run-code-before-the-component-gets-rendered
      
      Received the following play function:
      ${data.playFunction}`,
    });
  }
}

export class TestingLibraryMustBeConfiguredError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 13,
      message: dedent`
        You must configure testingLibraryRender to use play in portable stories.
        
        import { render } from '@testing-library/[renderer]';
        
        setProjectAnnotations({
          testingLibraryRender: render,
        });
        
        For other testing renderers, you can configure \`renderToCanvas\` like so:
        
        import { render } from 'your-test-renderer';
        
        setProjectAnnotations({
          renderToCanvas: ({ storyFn }) => {
            const Story = storyFn();
            
            // Svelte
            render(Story.Component, Story.props);
            
            // Vue
            render(Story);
            
            // or for React
            render(<Story/>);
          },
        });`,
    });
  }
}

export class NoRenderFunctionError extends StorybookError {
  constructor(public data: { id: string }) {
    super({
      category: Category.PREVIEW_API,
      code: 14,
      message: dedent`
        No render function available for storyId '${data.id}'
      `,
    });
  }
}

export class NoStoryMountedError extends StorybookError {
  constructor() {
    super({
      category: Category.PREVIEW_API,
      code: 15,
      message: dedent`
        No component is mounted in your story.
        
        This usually occurs when you destructure mount in the play function, but forget to call it.
        
        For example:

        async play({ mount, canvasElement }) {
          // 👈 mount should be called: await mount(); 
          const canvas = within(canvasElement);
          const button = await canvas.findByRole('button');
          await userEvent.click(button);
        };

        Make sure to either remove it or call mount in your play function.
      `,
    });
  }
}

export class NextJsSharpError extends StorybookError {
  constructor() {
    super({
      category: Category.FRAMEWORK_NEXTJS,
      code: 1,
      documentation: 'https://storybook.js.org/docs/get-started/nextjs#faq',
      message: dedent`
      You are importing avif images, but you don't have sharp installed.

      You have to install sharp in order to use image optimization features in Next.js.
      `,
    });
  }
}

export class NextjsRouterMocksNotAvailable extends StorybookError {
  constructor(public data: { importType: string }) {
    super({
      category: Category.FRAMEWORK_NEXTJS,
      code: 2,
      message: dedent`
        Tried to access router mocks from "${data.importType}" but they were not created yet. You might be running code in an unsupported environment.
      `,
    });
  }
}

export class UnknownArgTypesError extends StorybookError {
  constructor(public data: { type: object; language: string }) {
    super({
      category: Category.DOCS_TOOLS,
      code: 1,
      documentation: 'https://github.com/storybookjs/storybook/issues/26606',
      message: dedent`
        There was a failure when generating detailed ArgTypes in ${data.language} for:
        ${JSON.stringify(data.type, null, 2)} 
        
        Storybook will fall back to use a generic type description instead.

        This type is either not supported or it is a bug in the docgen generation in Storybook.
        If you think this is a bug, please detail it as much as possible in the Github issue.
      `,
    });
  }
}
