import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';

import { composeStories, setProjectAnnotations } from '@storybook/nextjs';
import * as imageStories from './Image.stories';
import * as navigationStories from './Navigation.stories';
import * as linkStories from './Link.stories';
import * as routerStories from './Router.stories';
import * as imageLegacyStories from './ImageLegacy.stories';
import * as styledJsxStories from './StyledJsx.stories';
import * as dynamicImportStories from './DynamicImport.stories';
import * as fontStories from './Font.stories';
import * as headStories from './Head.stories';
import * as nextHeaderStories from './NextHeader.stories';
import * as getImagePropsStories from './GetImageProps.stories';

// example with composeStories, returns an object with all stories composed with args/decorators
const runTests = (name: string, storiesModule: any) => {
  describe(`${name} stories`, () => {
    const composedStories = composeStories(storiesModule);
    Object.entries(composedStories).forEach(([name, Story]: [any, any]) => {
      it(`renders ${name}`, async () => {
        await Story.run?.();
        expect(document.body).toMatchSnapshot();
      });
    });
  });
};

// example with composeStory, returns a single story composed with args/decorators
describe('renders', () => {
  runTests('nextHeaderStories', nextHeaderStories);
  runTests('navigationStories', navigationStories);
  runTests('linkStories', linkStories);
  runTests('routerStories', routerStories);
  runTests('imageStories', imageStories);
  runTests('imageLegacyStories', imageLegacyStories);
  runTests('styledJsxStories', styledJsxStories);
  runTests('dynamicImportStories', dynamicImportStories);
  runTests('fontStories', fontStories);
  runTests('headStories', headStories);
  runTests('getImagePropsStories', getImagePropsStories);
});
