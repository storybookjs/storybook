import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractFromStory } from './componentMetaExtractor.test-helpers';

describe('display name resolution', () => {
  it('uses export name for named exports', async () => {
    const entry = await extractFromStory(
      {
        'dn/MyButton.tsx': dedent`
          import React from 'react';
          interface Props { label: string }
          export const MyButton = (props: Props) => <button />;
        `,
        'dn/MyButton.stories.tsx': dedent`
          import { MyButton } from './MyButton';
          export default { component: MyButton };
        `,
      },
      'dn/MyButton.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'MyButton' });
  });

  it('uses resolved symbol name for default exports', async () => {
    const entry = await extractFromStory(
      {
        'dn/MyButton.tsx': dedent`
          import React from 'react';
          interface Props { label: string }
          const MyButton = (props: Props) => <button />;
          export default MyButton;
        `,
        'dn/MyButton.stories.tsx': dedent`
          import MyButton from './MyButton';
          export default { component: MyButton };
        `,
      },
      'dn/MyButton.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'MyButton' });
  });

  it('uses the story-level component name for anonymous default exports', async () => {
    const entry = await extractFromStory(
      {
        'dn/Widget.tsx': dedent`
          import React from 'react';
          export default (props: { label: string }) => <button />;
        `,
        'dn/Widget.stories.tsx': dedent`
          import Widget from './Widget';
          export default { component: Widget };
        `,
      },
      'dn/Widget.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Widget' });
  });

  it('uses a custom story alias for anonymous default exports', async () => {
    const entry = await extractFromStory(
      {
        'dn/Widget.tsx': dedent`
          import React from 'react';
          export default (props: { label: string }) => <button />;
        `,
        'dn/Widget.stories.tsx': dedent`
          import MarketingHeader from './Widget';
          export default { component: MarketingHeader };
        `,
      },
      'dn/Widget.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'MarketingHeader' });
  });

  it('uses the story-level component name for anonymous default exports from index.ts', async () => {
    const entry = await extractFromStory(
      {
        'dn/TextInput/TextInput.tsx': dedent`
          import React from 'react';
          export default (props: { value: string }) => <input />;
        `,
        'dn/TextInput/index.ts': dedent`
          export { default } from './TextInput';
        `,
        'dn/TextInput.stories.tsx': dedent`
          import TextInput from './TextInput/index';
          export default { component: TextInput };
        `,
      },
      'dn/TextInput.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'TextInput' });
  });

  it('uses a custom story alias for anonymous default exports from index.ts', async () => {
    const entry = await extractFromStory(
      {
        'dn/TextInput/TextInput.tsx': dedent`
          import React from 'react';
          export default (props: { value: string }) => <input />;
        `,
        'dn/TextInput/index.ts': dedent`
          export { default } from './TextInput';
        `,
        'dn/TextInput.stories.tsx': dedent`
          import SearchField from './TextInput/index';
          export default { component: SearchField };
        `,
      },
      'dn/TextInput.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'SearchField' });
  });
});
