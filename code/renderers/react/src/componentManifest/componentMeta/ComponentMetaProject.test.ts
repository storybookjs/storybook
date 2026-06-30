import { afterEach, describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import type { StoryRef } from '../getComponentImports.ts';
import { findMatchingComponent } from '../resolveComponents.ts';
import { findExactComponentMatch } from '../subcomponents.ts';
import {
  extractFromStory,
  loadDeclaredSubcomponentComponents,
  resetProjectVolume,
  withProject,
} from './componentMetaExtractor.test-helpers.ts';

afterEach(() => {
  resetProjectVolume();
});

describe('compound component extraction', () => {
  it('extracts props for Accordion.Root, not Item or Trigger', async () => {
    const entry = await extractFromStory(
      {
        'accordion.tsx': dedent`
          import React from 'react';

          interface RootProps {
            /** Allow multiple items open */
            multiple?: boolean;
            /** Default open items */
            defaultValue?: string[];
          }
          const Root = (props: RootProps) => <div />;

          interface ItemProps {
            value: string;
            disabled?: boolean;
          }
          const Item = (props: ItemProps) => <div />;

          interface TriggerProps {
            asChild?: boolean;
          }
          const Trigger = (props: TriggerProps) => <button />;

          export const Accordion = { Root, Item, Trigger };
        `,
        'accordion.stories.tsx': dedent`
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root multiple><Accordion.Item value="a"><Accordion.Trigger /></Accordion.Item></Accordion.Root>;
        `,
      },
      'accordion.stories.tsx',
      { componentName: 'Accordion.Root' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        multiple: { required: false, description: 'Allow multiple items open' },
        defaultValue: expect.anything(),
      },
    });
    // Should NOT have Item or Trigger props
    expect(entry.component?.reactComponentMeta?.props?.value).toBeUndefined();
    expect(entry.component?.reactComponentMeta?.props?.asChild).toBeUndefined();
  });

  it('uses Root description and jsDocTags, not wrapper Accordion', async () => {
    const entry = await extractFromStory(
      {
        'accordion.tsx': dedent`
          import React from 'react';

          interface RootProps {
            /** Root size */
            size?: 'sm' | 'md';
          }

          /**
           * Root-specific description
           * @summary Root summary
           */
          const Root = ({ size = 'md' }: RootProps) => <div data-size={size} />;

          interface ItemProps {
            value: string;
          }
          const Item = (props: ItemProps) => <div />;

          /**
           * Wrapper description
           * @summary Wrapper summary
           */
          export const Accordion = { Root, Item };
        `,
        'accordion.stories.tsx': dedent`
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root />;
        `,
      },
      'accordion.stories.tsx',
      { componentName: 'Accordion.Root' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Accordion.Root',
      description: 'Root-specific description',
      jsDocTags: { summary: ['Root summary'] },
      props: { size: { defaultValue: { value: "'md'" } } },
    });
    expect(entry.component?.importOverride).toBeUndefined();
  });

  it('extracts Aligner props when targeting Button.Aligner, Button props otherwise', async () => {
    // Uses withProject directly because this test needs two extraction rounds on the same project.
    await withProject(
      {
        'button.tsx': dedent`
          import React from 'react';

          interface ButtonProps {
            /** Visual variant */
            variant?: 'solid' | 'outline';
            /** Color theme */
            color?: 'neutral' | 'primary';
            /** Disabled state */
            disabled?: boolean;
          }
          const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
            (props, ref) => <button ref={ref} />
          );

          interface AlignerProps {
            /** Side of the button to align */
            side?: 'start' | 'end';
            children?: React.ReactNode;
          }
          const Aligner = (props: AlignerProps) => <div />;

          interface GroupProps {
            /** Gap between buttons */
            gap?: number;
            children?: React.ReactNode;
          }
          const Group = (props: GroupProps) => <div />;

          const ButtonRoot = Button as typeof Button & {
            Aligner: typeof Aligner;
            Group: typeof Group;
          };
          ButtonRoot.Aligner = Aligner;
          ButtonRoot.Group = Group;

          export default ButtonRoot;
        `,
        'button.stories.tsx': dedent`
          import React from 'react';
          import Button from './button';
          export default { component: Button };
          export const AlignerStory = () => <Button.Aligner side="start"><Button /></Button.Aligner>;
          export const ButtonStory = () => <Button variant="solid" />;
        `,
      },
      (project, filePaths) => {
        // memberAccess='Aligner' → find <Button.Aligner />, get Aligner's props
        const entries1: StoryRef[] = [
          {
            storyPath: filePaths['button.stories.tsx'],
            component: {
              componentName: 'Button',
              importId: './button',
              importName: 'default',
              member: 'Aligner',
              path: filePaths['button.tsx'],
              isPackage: false,
            },
          },
        ];
        project.extractPropsFromStories(entries1);

        expect(entries1[0]?.component?.reactComponentMeta).toMatchObject({
          props: { side: expect.anything() },
        });
        expect(entries1[0]?.component?.reactComponentMeta?.props?.variant).toBeUndefined();

        // Without memberAccess → find <Button />, get Button's own props
        const entries2: StoryRef[] = [
          {
            storyPath: filePaths['button.stories.tsx'],
            component: {
              componentName: 'Button',
              importId: './button',
              importName: 'default',
              path: filePaths['button.tsx'],
              isPackage: false,
            },
          },
        ];
        project.extractPropsFromStories(entries2);

        expect(entries2[0]?.component?.reactComponentMeta).toMatchObject({
          props: { variant: expect.anything(), color: expect.anything() },
        });
        expect(entries2[0]?.component?.reactComponentMeta?.props?.side).toBeUndefined();
      }
    );
  });

  it('uses Aligner metadata for default-exported Button.Aligner', async () => {
    const entry = await extractFromStory(
      {
        'button.tsx': dedent`
          import React from 'react';

          interface ButtonProps {
            variant?: 'solid' | 'outline';
          }
          const Button = (props: ButtonProps) => <button />;

          interface AlignerProps {
            /** Aligner direction */
            side?: 'start' | 'end';
          }

          /**
           * Aligner-specific description
           * @summary Aligner summary
           */
          const Aligner = ({ side = 'start' }: AlignerProps) => <div data-side={side} />;

          /**
           * Wrapper description
           * @summary Wrapper summary
           */
          const ButtonRoot = Button as typeof Button & {
            Aligner: typeof Aligner;
          };

          ButtonRoot.Aligner = Aligner;

          export default ButtonRoot;
        `,
        'button.stories.tsx': dedent`
          import React from 'react';
          import Button from './button';
          export default { component: Button };
          export const AlignerStory = () => <Button.Aligner />;
        `,
      },
      'button.stories.tsx',
      { componentName: 'Button.Aligner' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Button.Aligner',
      description: 'Aligner-specific description',
      jsDocTags: { summary: ['Aligner summary'] },
      props: { side: { defaultValue: { value: "'start'" } } },
    });
    expect(entry.component?.importOverride).toBeUndefined();
  });

  it('inherits @import from wrapper for compound members', async () => {
    const entry = await extractFromStory(
      {
        'accordion.tsx': dedent`
          import React from 'react';

          interface RootProps {
            /** Root size */
            size?: 'sm' | 'md';
          }

          /**
           * Root-specific description
           * @summary Root summary
           */
          const Root = ({ size = 'md' }: RootProps) => <div data-size={size} />;

          interface ItemProps {
            value: string;
          }
          const Item = (props: ItemProps) => <div />;

          /**
           * Wrapper description
           * @import import { Accordion } from '@design-system/components/accordion';
           */
          export const Accordion = { Root, Item };
        `,
        'accordion.stories.tsx': dedent`
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root />;
        `,
      },
      'accordion.stories.tsx',
      { componentName: 'Accordion.Root' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      description: 'Root-specific description',
      props: { size: { defaultValue: { value: "'md'" } } },
    });
    expect(entry.component?.importOverride).toBe(
      "import { Accordion } from '@design-system/components/accordion';"
    );
  });

  it('extracts Dialog.Root and Button in the same batch', async () => {
    // Uses withProject directly because this test extracts two story files in one batch.
    await withProject(
      {
        'dialog.tsx': dedent`
          import React from 'react';

          interface RootProps {
            open?: boolean;
            onOpenChange?: (open: boolean) => void;
          }
          const Root = (props: RootProps) => <div />;

          interface ContentProps {
            /** Trap focus inside dialog */
            trapFocus?: boolean;
          }
          const Content = (props: ContentProps) => <div />;

          export const Dialog = { Root, Content };
        `,
        'button.tsx': dedent`
          import React from 'react';
          export interface ButtonProps {
            label: string;
            variant?: 'primary' | 'secondary';
          }
          export const Button = (props: ButtonProps) => <button />;
        `,
        'dialog.stories.tsx': dedent`
          import React from 'react';
          import { Dialog } from './dialog';
          export default {};
          export const Default = () => <Dialog.Root open><Dialog.Content trapFocus /></Dialog.Root>;
        `,
        'button.stories.tsx': dedent`
          import React from 'react';
          import { Button } from './button';
          export default { component: Button };
          export const Default = () => <Button label="Click" />;
        `,
      },
      (project, filePaths) => {
        const entries: StoryRef[] = [
          {
            storyPath: filePaths['dialog.stories.tsx'],
            component: {
              componentName: 'Dialog',
              importId: './dialog',
              importName: 'Dialog',
              member: 'Root',
              path: filePaths['dialog.tsx'],
              isPackage: false,
            },
          },
          {
            storyPath: filePaths['button.stories.tsx'],
            component: {
              componentName: 'Button',
              importId: './button',
              importName: 'Button',
              path: filePaths['button.tsx'],
              isPackage: false,
            },
          },
        ];
        project.extractPropsFromStories(entries);

        expect(entries[0]?.component?.reactComponentMeta).toMatchObject({
          props: { open: expect.anything(), onOpenChange: expect.anything() },
        });
        expect(entries[1]?.component?.reactComponentMeta).toMatchObject({
          props: { label: expect.anything(), variant: expect.anything() },
        });
      }
    );
  });

  it('extracts declared compound subcomponent without JSX when meta.component is the base export', async () => {
    await withProject(
      {
        'button.tsx': dedent`
          import React from 'react';

          interface ButtonProps {
            variant?: 'solid' | 'outline';
          }
          const Button = (props: ButtonProps) => <button />;

          interface AlignerProps {
            side?: 'start' | 'end';
          }
          const Aligner = (props: AlignerProps) => <div />;

          const ButtonRoot = Button as typeof Button & {
            Aligner: typeof Aligner;
          };
          ButtonRoot.Aligner = Aligner;

          export default ButtonRoot;
        `,
        'button.stories.tsx': dedent`
          import type { Meta } from '@storybook/react';
          import Button from './button';

          const meta = {
            title: 'Example/Button',
            component: Button,
            subcomponents: { Aligner: Button.Aligner },
          } satisfies Meta<typeof Button>;

          export default meta;
        `,
      },
      async (project, filePaths) => {
        const { storyPath, csf, components } = await loadDeclaredSubcomponentComponents({
          filePaths,
          storyFileName: 'button.stories.tsx',
          title: 'Example/Button',
        });

        const mainComponent = findMatchingComponent(components, csf._meta?.component, 'Button');
        const alignerEntry = {
          storyPath,
          component: findExactComponentMatch(components, 'Button.Aligner'),
        };

        project.extractPropsFromStories([{ storyPath, component: mainComponent }, alignerEntry]);

        expect(mainComponent?.reactComponentMeta?.props?.variant).toBeDefined();
        expect(mainComponent?.reactComponentMeta?.props?.side).toBeUndefined();

        expect(alignerEntry.component?.reactComponentMeta?.props?.side).toBeDefined();
        expect(alignerEntry.component?.reactComponentMeta?.props?.variant).toBeUndefined();
      }
    );
  });

  it('extracts declared subcomponents from namespace import without JSX', async () => {
    await withProject(
      {
        'controls-parameters.tsx': dedent`
          import React from 'react';

          type MainProps = { a?: string; b: string };
          export const ControlsParameters = ({ a = 'a', b }: MainProps) => <div>{a}{b}</div>;

          type SubcomponentAProps = { e: boolean; c: boolean; d?: boolean };
          export const SubcomponentA = ({ d = false }: SubcomponentAProps) => <div />;

          type SubcomponentBProps = { g: number; h: number; f?: number };
          export const SubcomponentB = ({ f = 42 }: SubcomponentBProps) => <div />;
        `,
        'controls-parameters.stories.tsx': dedent`
          import type { Meta } from '@storybook/react';
          import * as UI from './controls-parameters';

          const meta = {
            title: 'Example/ControlsParameters',
            component: UI.ControlsParameters,
            subcomponents: { SubcomponentA: UI.SubcomponentA, SubcomponentB: UI.SubcomponentB },
          } satisfies Meta<typeof UI.ControlsParameters>;

          export default meta;
        `,
      },
      async (project, filePaths) => {
        const { storyPath, csf, declaredSubcomponents, components } =
          await loadDeclaredSubcomponentComponents({
            filePaths,
            storyFileName: 'controls-parameters.stories.tsx',
            title: 'Example/ControlsParameters',
          });

        const mainComponent = findMatchingComponent(
          components,
          csf._meta?.component,
          'ControlsParameters'
        );
        const subcomponentEntries = declaredSubcomponents.map((declared) => ({
          storyPath,
          component: findExactComponentMatch(components, declared.componentName),
        }));

        project.extractPropsFromStories([
          { storyPath, component: mainComponent },
          ...subcomponentEntries,
        ]);

        expect(mainComponent?.reactComponentMeta?.props?.a).toBeDefined();
        expect(mainComponent?.reactComponentMeta?.props?.b).toBeDefined();

        const subcomponentA = subcomponentEntries[0].component;
        const subcomponentB = subcomponentEntries[1].component;

        expect(subcomponentA?.reactComponentMeta?.props?.e).toBeDefined();
        expect(subcomponentA?.reactComponentMeta?.props?.c).toBeDefined();
        expect(subcomponentA?.reactComponentMeta?.props?.a).toBeUndefined();

        expect(subcomponentB?.reactComponentMeta?.props?.g).toBeDefined();
        expect(subcomponentB?.reactComponentMeta?.props?.h).toBeDefined();
        expect(subcomponentB?.reactComponentMeta?.props?.b).toBeUndefined();
      }
    );
  });

  it('extracts declared subcomponents from meta without JSX', async () => {
    await withProject(
      {
        'controls-parameters.tsx': dedent`
          import React from 'react';

          type MainProps = { a?: string; b: string };
          export const ControlsParameters = ({ a = 'a', b }: MainProps) => <div>{a}{b}</div>;

          type SubcomponentAProps = { e: boolean; c: boolean; d?: boolean };
          export const SubcomponentA = ({ d = false }: SubcomponentAProps) => <div />;

          type SubcomponentBProps = { g: number; h: number; f?: number };
          export const SubcomponentB = ({ f = 42 }: SubcomponentBProps) => <div />;
        `,
        'controls-parameters.stories.tsx': dedent`
          import type { Meta } from '@storybook/react';
          import { ControlsParameters, SubcomponentA, SubcomponentB } from './controls-parameters';

          const meta = {
            title: 'Example/ControlsParameters',
            component: ControlsParameters,
            subcomponents: { SubcomponentA, SubcomponentB },
          } satisfies Meta<typeof ControlsParameters>;

          export default meta;
        `,
      },
      async (project, filePaths) => {
        const { storyPath, csf, declaredSubcomponents, components } =
          await loadDeclaredSubcomponentComponents({
            filePaths,
            storyFileName: 'controls-parameters.stories.tsx',
            title: 'Example/ControlsParameters',
          });

        const mainComponent = findMatchingComponent(
          components,
          csf._meta?.component,
          'ControlsParameters'
        );
        const subcomponentEntries = declaredSubcomponents.map((declared) => ({
          storyPath,
          component: findExactComponentMatch(components, declared.componentName),
        }));

        project.extractPropsFromStories([
          { storyPath, component: mainComponent },
          ...subcomponentEntries,
        ]);

        expect(mainComponent?.reactComponentMeta?.props?.a).toBeDefined();
        expect(mainComponent?.reactComponentMeta?.props?.b).toBeDefined();
        expect(mainComponent?.reactComponentMeta?.props?.e).toBeUndefined();

        const subcomponentA = subcomponentEntries[0].component;
        const subcomponentB = subcomponentEntries[1].component;

        expect(subcomponentA?.reactComponentMeta?.props?.e).toBeDefined();
        expect(subcomponentA?.reactComponentMeta?.props?.c).toBeDefined();
        expect(subcomponentA?.reactComponentMeta?.props?.d).toBeDefined();
        expect(subcomponentA?.reactComponentMeta?.props?.a).toBeUndefined();

        expect(subcomponentB?.reactComponentMeta?.props?.g).toBeDefined();
        expect(subcomponentB?.reactComponentMeta?.props?.h).toBeDefined();
        expect(subcomponentB?.reactComponentMeta?.props?.f).toBeDefined();
        expect(subcomponentB?.reactComponentMeta?.props?.b).toBeUndefined();
      }
    );
  });

  it('extracts description, @import, and @summary from component JSDoc', async () => {
    const entry = await extractFromStory(
      {
        'button.tsx': dedent`
          import React from 'react';

          export interface ButtonProps {
            label: string;
          }

          /**
           * Primary UI component for user interaction
           * @import import { Button } from '@design-system/components/override';
           * @summary Fast summary
           */
          export const Button = ({ label }: ButtonProps) => <button>{label}</button>;
        `,
        'button.stories.tsx': dedent`
          import React from 'react';
          import { Button } from './button';
          export default { component: Button };
          export const Default = () => <Button label="Click" />;
        `,
      },
      'button.stories.tsx'
    );

    expect(entry.component).toMatchObject({
      reactComponentMeta: {
        description: 'Primary UI component for user interaction',
      },
      componentJsDocTags: {
        import: ["import { Button } from '@design-system/components/override';"],
        summary: ['Fast summary'],
      },
      importOverride: "import { Button } from '@design-system/components/override';",
    });
  });
});
