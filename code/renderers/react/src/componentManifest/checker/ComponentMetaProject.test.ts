import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { ComponentMetaProject } from './ComponentMetaProject';
import { cleanup, createTempProject } from './test-helpers';

// ---------------------------------------------------------------------------
// Compound component detection via memberAccess
// ---------------------------------------------------------------------------

describe('extractPropsFromStories with memberAccess (compound components)', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('extracts props for compound component sub-property via memberAccess', () => {
    // Simulates the Park UI / Ark UI pattern:
    // A namespace object `Accordion` with sub-components `.Root`, `.Item`, etc.
    // The story uses `<Accordion.Root>`, so memberAccess = 'Root'.
    const { projectDir, configPath, filePaths } = createTempProject({
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
        export default { component: Accordion };
        export const Default = () => <Accordion.Root multiple><Accordion.Item value="a"><Accordion.Trigger /></Accordion.Item></Accordion.Root>;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // memberAccess='Root' → find <Accordion.Root /> in story, get Root's props
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['accordion.stories.tsx'],
          componentPath: filePaths['accordion.tsx'],
          exportName: 'Accordion',
          importId: './accordion',
          memberAccess: 'Root',
        },
      ]);
      const docs = results.get(filePaths['accordion.stories.tsx'])?.get('Accordion');
      const doc = docs?.[0];

      expect(doc).toBeDefined();
      expect(doc!.props.multiple).toBeDefined();
      expect(doc!.props.multiple.required).toBe(false);
      expect(doc!.props.multiple.description).toBe('Allow multiple items open');
      expect(doc!.props.defaultValue).toBeDefined();
      // Should NOT have Item or Trigger props
      expect(doc!.props.value).toBeUndefined();
      expect(doc!.props.asChild).toBeUndefined();
    } finally {
      project.dispose();
    }
  });

  it('probes the member directly when memberAccess is set', () => {
    // When memberAccess is set (derived from outermost JSX like <Button.Aligner>),
    // the probe targets that member directly — no fallback needed.
    const { projectDir, configPath, filePaths } = createTempProject({
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
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // memberAccess='Aligner' → find <Button.Aligner />, get Aligner's props
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'default',
          importId: './button',
          memberAccess: 'Aligner',
        },
      ]);

      const docs = results.get(filePaths['button.stories.tsx'])?.get('default');
      const doc = docs?.[0];
      expect(doc).toBeDefined();
      expect(doc!.props.side).toBeDefined();
      // Should NOT have Button's own props
      expect(doc!.props.variant).toBeUndefined();

      // Without memberAccess → find <Button />, get Button's own props
      const results2 = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'default',
          importId: './button',
        },
      ]);

      const docs2 = results2.get(filePaths['button.stories.tsx'])?.get('default');
      const doc2 = docs2?.[0];
      expect(doc2).toBeDefined();
      expect(doc2!.props.variant).toBeDefined();
      expect(doc2!.props.color).toBeDefined();
      // Should NOT have Aligner's props
      expect(doc2!.props.side).toBeUndefined();
    } finally {
      project.dispose();
    }
  });

  it('extracts props for different member accesses per entry', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
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
        export default { component: Dialog };
        export const Default = () => <Dialog.Root open><Dialog.Content trapFocus /></Dialog.Root>;
      `,
      'button.stories.tsx': `
        import React from 'react';
        import { Button } from './button';
        export default { component: Button };
        export const Default = () => <Button label="Click" />;
      `,
    });
    tempDir = projectDir;

    const parsed = ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    );
    const project = new ComponentMetaProject(ts, parsed, configPath);

    try {
      // Mix: compound component with memberAccess + regular component
      const results = project.extractPropsFromStories([
        {
          storyFilePath: filePaths['dialog.stories.tsx'],
          componentPath: filePaths['dialog.tsx'],
          exportName: 'Dialog',
          importId: './dialog',
          memberAccess: 'Root',
        },
        {
          storyFilePath: filePaths['button.stories.tsx'],
          componentPath: filePaths['button.tsx'],
          exportName: 'Button',
          importId: './button',
        },
      ]);

      const dialogDocs = results.get(filePaths['dialog.stories.tsx'])?.get('Dialog');
      expect(dialogDocs?.[0]).toBeDefined();
      expect(dialogDocs![0].props.open).toBeDefined();
      expect(dialogDocs![0].props.onOpenChange).toBeDefined();

      const buttonDocs = results.get(filePaths['button.stories.tsx'])?.get('Button');
      expect(buttonDocs?.[0]).toBeDefined();
      expect(buttonDocs![0].props.label).toBeDefined();
      expect(buttonDocs![0].props.variant).toBeDefined();
    } finally {
      project.dispose();
    }
  });
});
