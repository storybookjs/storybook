/* eslint-disable playwright/no-conditional-expect */

/* eslint-disable playwright/no-conditional-in-test */
import { expect, test } from '@playwright/test';
import process from 'process';
import { dedent } from 'ts-dedent';

import { SbPage } from './util';

const storybookUrl = process.env.STORYBOOK_URL || 'http://localhost:8001';
const templateName = process.env.STORYBOOK_TEMPLATE_NAME || '';

test.describe('addon-docs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(storybookUrl);
    await new SbPage(page, expect).waitUntilLoaded();
  });

  test('should show descriptions for stories', async ({ page }) => {
    const skipped = [
      // SSv6 does not render stories in the correct order in our sandboxes
      'internal\\/ssv6',
    ];
    test.skip(
      new RegExp(`^${skipped.join('|')}`, 'i').test(`${templateName}`),
      `Skipping ${templateName}, because of wrong ordering of stories on docs page`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/basic', 'docs');
    const root = sbPage.previewRoot();

    const basicStories = root.locator('#anchor--addons-docs-docspage-basic--basic');
    const secondBasicStory = (await basicStories.all())[1];
    await expect(secondBasicStory).toContainText('A basic button');

    const anotherStory = root.locator('#anchor--addons-docs-docspage-basic--another');
    await expect(anotherStory).toContainText('Another button, just to show multiple stories');
  });

  test('should show source=code view for stories', async ({ page }) => {
    const skipped = [
      // SSv6 does not render stories in the correct order in our sandboxes
      'internal\\/ssv6',
    ];
    test.skip(
      new RegExp(`^${skipped.join('|')}`, 'i').test(`${templateName}`),
      `Skipping ${templateName}, because of wrong ordering of stories on docs page`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/basic', 'docs');
    const root = sbPage.previewRoot();

    // Click on the third button which has the text "Show code"
    const showCodeButton = (await root.locator('button', { hasText: 'Show Code' }).all())[2];
    await showCodeButton.click();
    const sourceCode = root.locator('pre.prismjs');
    const expectedSource = dedent`{
      args: {
        label: 'Another'
      },
      parameters: {
        docs: {
          source: {
            type: 'code'
          }
        }
      },
      play: async () => {
        await new Promise(resolve => resolve('Play function'));
      }
    }`;
    await expect(sourceCode).toHaveText(expectedSource);
  });

  test('should render errors', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/error', 'docs');
    const root = sbPage.previewRoot();

    const primaryStory = root.locator('#story--addons-docs-docspage-error--error-story--primary');
    await expect(primaryStory).toContainText('Story did something wrong');
  });

  test('should provide source snippet', async ({ page }) => {
    // templateName is e.g. 'vue-cli/default-js'
    test.skip(
      /^(vue3|vue-cli|preact)/i.test(`${templateName}`),
      `Skipping ${templateName}, which does not support dynamic source snippets`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/basic', 'docs');
    const root = sbPage.previewRoot();
    const toggles = root.locator('.docblock-code-toggle');

    const toggleCount = await toggles.count();
    for (let i = 0; i < toggleCount; i += 1) {
      const toggle = toggles.nth(i);
      await toggle.click();
    }

    const codes = root.locator('pre.prismjs');
    const codeCount = await codes.count();
    for (let i = 0; i < codeCount; i += 1) {
      const code = codes.nth(i);
      const text = await code.innerText();
      await expect(text).not.toMatch(/^\(args\) => /);
    }
  });

  test('source snippet should not change in stories block', async ({ page }) => {
    const skipped = [
      'vue3',
      'vue-cli',
      'preact',
      // SSv6 does not render stories in the correct order in our sandboxes
      'internal\\/ssv6',
      // Angular bug: https://github.com/storybookjs/storybook/issues/21066
      'angular',
      // Lit seems to render incorrectly for our template-stories but not real stories
      //   - template: https://638db567ed97c3fb3e21cc22-ulhjwkqzzj.chromatic.com/?path=/docs/addons-docs-docspage-basic--docs
      //   - real: https://638db567ed97c3fb3e21cc22-ulhjwkqzzj.chromatic.com/?path=/docs/example-button--docs
      'lit-vite',
    ];
    test.skip(
      new RegExp(`^${skipped.join('|')}`, 'i').test(`${templateName}`),
      `Skipping ${templateName}, which does not support dynamic source snippets`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/basic', 'docs');
    const root = sbPage.previewRoot();
    const toggles = root.locator('.docblock-code-toggle');

    // Open up the first and second code toggle (i.e the "Basic" story outside and inside the Stories block)
    await toggles.nth(0).click();
    await toggles.nth(1).click();

    // Check they both say "Basic"
    const codes = root.locator('pre.prismjs');
    const primaryCode = codes.nth(0);
    const storiesCode = codes.nth(1);
    await expect(primaryCode).toContainText('Basic');
    await expect(storiesCode).toContainText('Basic');

    const labelControl = root.locator('textarea[name=label]');
    labelControl.fill('Changed');
    labelControl.blur();

    // Check the Primary one has changed
    await expect(primaryCode).toContainText('Changed');
    // Check the stories one still says "Basic"
    await expect(storiesCode).toContainText('Basic');
  });

  test('should not run autoplay stories without parameter', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/autoplay', 'docs');

    const root = sbPage.previewRoot();
    const autoplayPre = root.locator('#story--addons-docs-docspage-autoplay--autoplay pre');
    await expect(autoplayPre).toHaveText('Play has run');

    const noAutoplayPre = root.locator('#story--addons-docs-docspage-autoplay--no-autoplay pre');
    await expect(noAutoplayPre).toHaveText('Play has not run');
  });

  test('should order entries correctly', async ({ page }) => {
    // TODO: This is broken in SSV6 Webpack. Context: https://github.com/storybookjs/storybook/issues/20941
    test.skip(
      templateName.includes('ssv6-webpack'),
      `${templateName} fails because of a known issue: https://github.com/storybookjs/storybook/issues/20941`
    );

    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docspage/basic', 'docs');

    // The `<Primary>` block should render the "Basic" story, and the `<Stories/>` block should
    // render both the "Basic" and "Another" story
    const root = sbPage.previewRoot();
    const stories = root.locator('.sb-story button');

    await expect(stories).toHaveCount(3);
    await expect(stories.first()).toHaveText('Basic');
    await expect(stories.nth(1)).toHaveText('Basic');
    await expect(stories.last()).toHaveText('Another');
  });

  test('should resolve react to the correct version', async ({ page }) => {
    // Arrange - Navigate to MDX docs
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('addons/docs/docs2/resolvedreact', 'mdx', 'docs');
    const root = sbPage.previewRoot();

    // Arrange - Setup expectations
    let expectedReactVersionRange = /^18/;
    if (templateName.includes('react-webpack/17') || templateName.includes('react-vite/17')) {
      expectedReactVersionRange = /^17/;
    } else if (templateName.includes('react16')) {
      expectedReactVersionRange = /^16/;
    } else if (
      templateName.includes('nextjs/prerelease') ||
      templateName.includes('react-vite/prerelease') ||
      templateName.includes('react-webpack/prerelease')
    ) {
      expectedReactVersionRange = /^19/;
    }

    // Arrange - Get the actual versions
    const mdxReactVersion = root.getByTestId('mdx-react');
    const mdxReactDomVersion = root.getByTestId('mdx-react-dom');
    const mdxReactDomServerVersion = root.getByTestId('mdx-react-dom-server');
    const componentReactVersion = root.getByTestId('component-react');
    const componentReactDomVersion = root.getByTestId('component-react-dom');
    const componentReactDomServerVersion = root.getByTestId('component-react-dom-server');

    // Assert - The versions are in the expected range
    await expect(mdxReactVersion).toHaveText(expectedReactVersionRange);
    await expect(componentReactVersion).toHaveText(expectedReactVersionRange);
    await expect(mdxReactDomVersion).toHaveText(expectedReactVersionRange);
    await expect(componentReactDomVersion).toHaveText(expectedReactVersionRange);
    if (!templateName.includes('preact')) {
      // preact/compat alias doesn't have a version export in react-dom/server
      await expect(mdxReactDomServerVersion).toHaveText(expectedReactVersionRange);
      await expect(componentReactDomServerVersion).toHaveText(expectedReactVersionRange);
    }

    // Arrange - Navigate to autodocs
    await sbPage.navigateToStory('addons/docs/docs2/resolvedreact', 'docs');

    // Arrange - Get the actual versions
    const autodocsReactVersion = root.getByTestId('react');
    const autodocsReactDomVersion = root.getByTestId('react-dom');
    const autodocsReactDomServerVersion = root.getByTestId('react-dom-server');

    // Assert - The versions are in the expected range
    await expect(autodocsReactVersion).toHaveText(expectedReactVersionRange);
    await expect(autodocsReactDomVersion).toHaveText(expectedReactVersionRange);
    if (!templateName.includes('preact')) {
      await expect(autodocsReactDomServerVersion).toHaveText(expectedReactVersionRange);
    }

    // Arrange - Navigate to story
    await sbPage.navigateToStory('addons/docs/docs2/resolvedreact', 'story');

    // Arrange - Get the actual versions
    const storyReactVersion = root.getByTestId('react');
    const storyReactDomVersion = root.getByTestId('react-dom');
    const storyReactDomServerVersion = root.getByTestId('react-dom-server');

    // Assert - The versions are in the expected range
    await expect(storyReactVersion).toHaveText(expectedReactVersionRange);
    await expect(storyReactDomVersion).toHaveText(expectedReactVersionRange);
    if (!templateName.includes('preact')) {
      await expect(storyReactDomServerVersion).toHaveText(expectedReactVersionRange);
    }
  });

  test('should have stories from multiple CSF files in autodocs', async ({ page }) => {
    const sbPage = new SbPage(page, expect);
    await sbPage.navigateToStory('/addons/docs/multiple-csf-files-same-title', 'docs');
    const root = sbPage.previewRoot();

    const storyHeadings = root.locator('.sb-anchor > h3');
    await expect(storyHeadings).toHaveCount(6);
    await expect(storyHeadings).toHaveText([
      'Default A',
      'Span Content',
      'Code Content',
      'Default B',
      'H 1 Content',
      'H 2 Content',
    ]);
  });
});
