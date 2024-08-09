import { describe, expect, it } from 'vitest';

import { isPageStory, summarizeIndex } from './summarizeIndex';

describe('isPageStory', () => {
  describe('true positives', () => {
    it.each(['pages/login', 'screens/login', 'components/LoginPage', 'components/LoginScreen'])(
      '%s',
      (title) => {
        expect(isPageStory(title)).toBe(true);
      }
    );
  });

  describe('false positives', () => {
    it.each([
      'components/PagerStatus',
      'components/DefectScreener',
      'addons/docs/docspage/autoplay',
    ])('%s', (title) => {
      expect(isPageStory(title)).toBe(true);
    });
  });

  describe('true negatives', () => {
    it.each(['atoms/Button', 'components/Slider'])('%s', (title) => {
      expect(isPageStory(title)).toBe(false);
    });
  });

  describe('false negatives', () => {
    it.each(['flows/login', 'login-flow/forgot password'])('%s', (title) => {
      expect(isPageStory(title)).toBe(false);
    });
  });
});

describe('summarizeIndex', () => {
  it('example stories', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'example-introduction--docs': {
            id: 'example-introduction--docs',
            title: 'Example/Introduction',
            name: 'Docs',
            importPath: './src/stories/Introduction.mdx',
            storiesImports: [],
            type: 'docs',
            tags: ['docs'],
          },
          'example-button--docs': {
            id: 'example-button--docs',
            title: 'Example/Button',
            name: 'Docs',
            importPath: './src/stories/Button.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
          'example-button--primary': {
            id: 'example-button--primary',
            title: 'Example/Button',
            name: 'Primary',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-button--secondary': {
            id: 'example-button--secondary',
            title: 'Example/Button',
            name: 'Secondary',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-button--large': {
            id: 'example-button--large',
            title: 'Example/Button',
            name: 'Large',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-button--small': {
            id: 'example-button--small',
            title: 'Example/Button',
            name: 'Small',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-header--docs': {
            id: 'example-header--docs',
            title: 'Example/Header',
            name: 'Docs',
            importPath: './src/stories/Header.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
          'example-header--logged-in': {
            id: 'example-header--logged-in',
            title: 'Example/Header',
            name: 'Logged In',
            importPath: './src/stories/Header.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-header--logged-out': {
            id: 'example-header--logged-out',
            title: 'Example/Header',
            name: 'Logged Out',
            importPath: './src/stories/Header.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-page--logged-out': {
            id: 'example-page--logged-out',
            title: 'Example/Page',
            name: 'Logged Out',
            importPath: './src/stories/Page.stories.ts',
            tags: ['story'],
            type: 'story',
          },
          'example-page--logged-in': {
            id: 'example-page--logged-in',
            title: 'Example/Page',
            name: 'Logged In',
            importPath: './src/stories/Page.stories.ts',
            tags: ['play-fn', 'story'],
            type: 'story',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 0,
        "componentCount": 0,
        "exampleDocsCount": 3,
        "exampleStoryCount": 8,
        "mdxCount": 0,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 0,
        "pageStoryCount": 0,
        "playStoryCount": 0,
        "storyCount": 0,
        "version": 5,
      }
    `);
  });
  it('onboarding stories', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'example-introduction--docs': {
            id: 'example-introduction--docs',
            title: 'Example/Introduction',
            name: 'Docs',
            importPath: './src/stories/Introduction.mdx',
            storiesImports: [],
            type: 'docs',
            tags: ['docs'],
          },
          'example-button--docs': {
            id: 'example-button--docs',
            title: 'Example/Button',
            name: 'Docs',
            importPath: './src/stories/Button.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
          'example-button--primary': {
            id: 'example-button--primary',
            title: 'Example/Button',
            name: 'Primary',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-button--warning': {
            id: 'example-button--warning',
            title: 'Example/Button',
            name: 'Warning',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 0,
        "componentCount": 0,
        "exampleDocsCount": 2,
        "exampleStoryCount": 1,
        "mdxCount": 0,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 1,
        "pageStoryCount": 0,
        "playStoryCount": 0,
        "storyCount": 0,
        "version": 5,
      }
    `);
  });
  it('user stories', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'stories-renderers-react-errors--story-contains-unrenderable': {
            id: 'stories-renderers-react-errors--story-contains-unrenderable',
            title: 'stories/renderers/react/errors',
            name: 'Story Contains Unrenderable',
            importPath: './src/stories/renderers/react/errors.stories.tsx',
            tags: ['story'],
            type: 'story',
          },
          'stories-renderers-react-hooks--basic': {
            id: 'stories-renderers-react-hooks--basic',
            title: 'stories/renderers/react/hooks',
            name: 'Basic',
            importPath: './src/stories/renderers/react/hooks.stories.tsx',
            tags: ['story'],
            type: 'story',
          },
          'stories-renderers-react-js-argtypes--js-class-component': {
            id: 'stories-renderers-react-js-argtypes--js-class-component',
            title: 'stories/renderers/react/js-argtypes',
            name: 'Js Class Component',
            importPath: './src/stories/renderers/react/js-argtypes.stories.jsx',
            tags: ['story'],
            type: 'story',
          },
          'stories-renderers-react-js-argtypes--js-function-component': {
            id: 'stories-renderers-react-js-argtypes--js-function-component',
            title: 'stories/renderers/react/js-argtypes',
            name: 'Js Function Component',
            importPath: './src/stories/renderers/react/js-argtypes.stories.jsx',
            tags: ['story'],
            type: 'story',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 0,
        "componentCount": 3,
        "exampleDocsCount": 0,
        "exampleStoryCount": 0,
        "mdxCount": 0,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 0,
        "pageStoryCount": 0,
        "playStoryCount": 0,
        "storyCount": 4,
        "version": 5,
      }
    `);
  });
  it('pages', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'example-page--logged-out': {
            id: 'example-page--logged-out',
            title: 'Example/Page',
            name: 'Logged Out',
            importPath: './src/stories/Page.stories.ts',
            tags: ['story'],
            type: 'story',
          },
          'example-page--logged-in': {
            id: 'example-page--logged-in',
            title: 'Example/Page',
            name: 'Logged In',
            importPath: './src/stories/Page.stories.ts',
            tags: ['play-fn', 'story'],
            type: 'story',
          },
          'addons-docs-docspage-autoplay--docs': {
            id: 'addons-docs-docspage-autoplay--docs',
            title: 'addons/docs/docspage/autoplay',
            name: 'Docs',
            importPath: './template-stories/addons/docs/docspage/autoplay.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
          'addons-docs-docspage-autoplay--no-autoplay': {
            id: 'addons-docs-docspage-autoplay--no-autoplay',
            title: 'addons/docs/docspage/autoplay',
            name: 'No Autoplay',
            importPath: './template-stories/addons/docs/docspage/autoplay.stories.ts',
            tags: ['play-fn', 'story'],
            type: 'story',
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 1,
        "componentCount": 1,
        "exampleDocsCount": 0,
        "exampleStoryCount": 2,
        "mdxCount": 0,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 0,
        "pageStoryCount": 1,
        "playStoryCount": 1,
        "storyCount": 1,
        "version": 5,
      }
    `);
  });
  it('autodocs', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'example-button--docs': {
            id: 'example-button--docs',
            title: 'Example/Button',
            name: 'Docs',
            importPath: './src/stories/Button.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
          'example-button--large': {
            id: 'example-button--large',
            title: 'Example/Button',
            name: 'Large',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'example-button--small': {
            id: 'example-button--small',
            title: 'Example/Button',
            name: 'Small',
            importPath: './src/stories/Button.stories.ts',
            tags: ['autodocs', 'story'],
            type: 'story',
          },
          'lib-preview-api-shortcuts--docs': {
            id: 'lib-preview-api-shortcuts--docs',
            title: 'lib/preview-api/shortcuts',
            name: 'Docs',
            importPath: './template-stories/lib/preview-api/shortcuts.stories.ts',
            type: 'docs',
            tags: ['autodocs', 'docs'],
            storiesImports: [],
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 1,
        "componentCount": 0,
        "exampleDocsCount": 1,
        "exampleStoryCount": 2,
        "mdxCount": 0,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 0,
        "pageStoryCount": 0,
        "playStoryCount": 0,
        "storyCount": 0,
        "version": 5,
      }
    `);
  });
  it('mdx', () => {
    expect(
      summarizeIndex({
        v: 5,
        entries: {
          'example-introduction--docs': {
            id: 'example-introduction--docs',
            title: 'Example/Introduction',
            name: 'Docs',
            importPath: './src/stories/Introduction.mdx',
            storiesImports: [],
            type: 'docs',
            tags: ['docs'],
          },
          'addons-docs-docs2-notitle--docs': {
            id: 'addons-docs-docs2-notitle--docs',
            title: 'addons/docs/docs2/NoTitle',
            name: 'Docs',
            importPath: './template-stories/addons/docs/docs2/NoTitle.mdx',
            storiesImports: [],
            type: 'docs',
            tags: ['docs', 'attached-mdx'],
          },
          'addons-docs-yabbadabbadooo--docs': {
            id: 'addons-docs-yabbadabbadooo--docs',
            title: 'addons/docs/Yabbadabbadooo',
            name: 'Docs',
            importPath: './template-stories/addons/docs/docs2/Title.mdx',
            storiesImports: [],
            type: 'docs',
            tags: ['docs', 'attached-mdx'],
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "autodocsCount": 0,
        "componentCount": 0,
        "exampleDocsCount": 1,
        "exampleStoryCount": 0,
        "mdxCount": 2,
        "onboardingDocsCount": 0,
        "onboardingStoryCount": 0,
        "pageStoryCount": 0,
        "playStoryCount": 0,
        "storyCount": 0,
        "version": 5,
      }
    `);
  });
});
