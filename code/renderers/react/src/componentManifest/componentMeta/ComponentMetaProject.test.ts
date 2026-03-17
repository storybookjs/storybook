import { describe, expect, it } from 'vitest';

import type { StoryRef } from '../getComponentImports';
import { withProject } from './componentMetaExtractor.test-helpers';

// ---------------------------------------------------------------------------
// Local helper: create a project, run extractPropsFromStories, return entries
// ---------------------------------------------------------------------------

function extractFromStories(
  files: Record<string, string>,
  makeEntries: (filePaths: Record<string, string>) => StoryRef[]
): StoryRef[] {
  return withProject(files, (project, filePaths) => {
    const entries = makeEntries(filePaths);
    project.extractPropsFromStories(entries);
    return entries;
  });
}

// ---------------------------------------------------------------------------
// Compound component detection via memberAccess
// ---------------------------------------------------------------------------

describe('compound component extraction', () => {
  it('extracts props for Accordion.Root, not Item or Trigger', () => {
    const entries = extractFromStories(
      {
        'accordion.tsx': `
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
        'accordion.stories.tsx': `
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root multiple><Accordion.Item value="a"><Accordion.Trigger /></Accordion.Item></Accordion.Root>;
        `,
      },
      (paths) => [
        {
          storyPath: paths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: paths['accordion.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const doc = entries[0].component?.reactComponentMeta;
    expect(doc).toBeDefined();
    expect(doc!.props.multiple).toBeDefined();
    expect(doc!.props.multiple.required).toBe(false);
    expect(doc!.props.multiple.description).toBe('Allow multiple items open');
    expect(doc!.props.defaultValue).toBeDefined();
    // Should NOT have Item or Trigger props
    expect(doc!.props.value).toBeUndefined();
    expect(doc!.props.asChild).toBeUndefined();
  });

  it('uses Root description and jsDocTags, not wrapper Accordion', () => {
    const entries = extractFromStories(
      {
        'accordion.tsx': `
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
        'accordion.stories.tsx': `
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root />;
        `,
      },
      (paths) => [
        {
          storyPath: paths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion.Root',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: paths['accordion.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const component = entries[0]?.component;
    const doc = component?.reactComponentMeta;

    expect(doc).toBeDefined();
    expect(doc?.displayName).toBe('Accordion.Root');
    expect(doc?.description).toBe('Root-specific description');
    expect(doc?.jsDocTags).toEqual({ summary: ['Root summary'] });
    expect(component?.importOverride).toBeUndefined();
    expect(doc?.props.size.defaultValue).toEqual({ value: "'md'" });
  });

  it('extracts Aligner props when targeting Button.Aligner, Button props otherwise', () => {
    // Uses withProject directly because this test needs two extraction rounds on the same project.
    withProject(
      {
        'button.tsx': `
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
        'button.stories.tsx': `
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

        const doc = entries1[0]?.component?.reactComponentMeta;
        expect(doc).toBeDefined();
        expect(doc!.props.side).toBeDefined();
        // Should NOT have Button's own props
        expect(doc!.props.variant).toBeUndefined();

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

        const doc2 = entries2[0]?.component?.reactComponentMeta;
        expect(doc2).toBeDefined();
        expect(doc2!.props.variant).toBeDefined();
        expect(doc2!.props.color).toBeDefined();
        // Should NOT have Aligner's props
        expect(doc2!.props.side).toBeUndefined();
      }
    );
  });

  it('uses Aligner metadata for default-exported Button.Aligner', () => {
    const entries = extractFromStories(
      {
        'button.tsx': `
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
        'button.stories.tsx': `
          import React from 'react';
          import Button from './button';
          export default { component: Button };
          export const AlignerStory = () => <Button.Aligner />;
        `,
      },
      (paths) => [
        {
          storyPath: paths['button.stories.tsx'],
          component: {
            componentName: 'Button.Aligner',
            importId: './button',
            importName: 'default',
            member: 'Aligner',
            path: paths['button.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const component = entries[0]?.component;
    const doc = component?.reactComponentMeta;

    expect(doc).toBeDefined();
    expect(doc?.displayName).toBe('Button.Aligner');
    expect(doc?.description).toBe('Aligner-specific description');
    expect(doc?.jsDocTags).toEqual({ summary: ['Aligner summary'] });
    expect(component?.importOverride).toBeUndefined();
    expect(doc?.props.side.defaultValue).toEqual({ value: "'start'" });
  });

  it('inherits @import from wrapper for compound members', () => {
    const entries = extractFromStories(
      {
        'accordion.tsx': `
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
        'accordion.stories.tsx': `
          import React from 'react';
          import { Accordion } from './accordion';
          export default {};
          export const Default = () => <Accordion.Root />;
        `,
      },
      (paths) => [
        {
          storyPath: paths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion.Root',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: paths['accordion.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const component = entries[0]?.component;
    const doc = component?.reactComponentMeta;

    expect(doc).toBeDefined();
    expect(doc?.description).toBe('Root-specific description');
    expect(doc?.props.size.defaultValue).toEqual({ value: "'md'" });
    expect(component?.importOverride).toBe(
      "import { Accordion } from '@design-system/components/accordion';"
    );
  });

  it('extracts Dialog.Root and Button in the same batch', () => {
    const entries = extractFromStories(
      {
        'dialog.tsx': `
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
        'button.tsx': `
          import React from 'react';
          export interface ButtonProps {
            label: string;
            variant?: 'primary' | 'secondary';
          }
          export const Button = (props: ButtonProps) => <button />;
        `,
        'dialog.stories.tsx': `
          import React from 'react';
          import { Dialog } from './dialog';
          export default {};
          export const Default = () => <Dialog.Root open><Dialog.Content trapFocus /></Dialog.Root>;
        `,
        'button.stories.tsx': `
          import React from 'react';
          import { Button } from './button';
          export default { component: Button };
          export const Default = () => <Button label="Click" />;
        `,
      },
      (paths) => [
        {
          storyPath: paths['dialog.stories.tsx'],
          component: {
            componentName: 'Dialog',
            importId: './dialog',
            importName: 'Dialog',
            member: 'Root',
            path: paths['dialog.tsx'],
            isPackage: false,
          },
        },
        {
          storyPath: paths['button.stories.tsx'],
          component: {
            componentName: 'Button',
            importId: './button',
            importName: 'Button',
            path: paths['button.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const dialogDoc = entries[0]?.component?.reactComponentMeta;
    expect(dialogDoc).toBeDefined();
    expect(dialogDoc!.props.open).toBeDefined();
    expect(dialogDoc!.props.onOpenChange).toBeDefined();

    const buttonDoc = entries[1]?.component?.reactComponentMeta;
    expect(buttonDoc).toBeDefined();
    expect(buttonDoc!.props.label).toBeDefined();
    expect(buttonDoc!.props.variant).toBeDefined();
  });

  it('extracts description, @import, and @summary from component JSDoc', () => {
    const entries = extractFromStories(
      {
        'button.tsx': `
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
        'button.stories.tsx': `
          import React from 'react';
          import { Button } from './button';
          export default { component: Button };
          export const Default = () => <Button label="Click" />;
        `,
      },
      (paths) => [
        {
          storyPath: paths['button.stories.tsx'],
          component: {
            componentName: 'Button',
            importId: './button',
            importName: 'Button',
            path: paths['button.tsx'],
            isPackage: false,
          },
        },
      ]
    );

    const component = entries[0]?.component;
    expect(component?.reactComponentMeta).toBeDefined();
    expect(component?.reactComponentMeta?.description).toBe(
      'Primary UI component for user interaction'
    );
    expect(component?.componentJsDocTags).toEqual({
      import: ["import { Button } from '@design-system/components/override';"],
      summary: ['Fast summary'],
    });
    expect(component?.importOverride).toBe(
      "import { Button } from '@design-system/components/override';"
    );
  });
});
