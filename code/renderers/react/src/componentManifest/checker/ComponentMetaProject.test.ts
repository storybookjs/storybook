import { afterEach, describe, expect, it } from 'vitest';

import ts from 'typescript';

import type { StoryRef } from '../getComponentImports';
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
    // a namespace import base with sub-components `.Root`, `.Item`, etc.
    // The story uses `<Accordion.Root>`, so memberAccess = 'Root'.
    // Path 1 is driven by importId + memberAccess below, so the CSF meta only
    // needs to exist; we intentionally avoid `component: Accordion` because
    // this fixture's `Accordion` is a namespace object, not a Storybook component.
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
        export default {};
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
      const entries: StoryRef[] = [
        {
          storyPath: filePaths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: filePaths['accordion.tsx'],
            isPackage: false,
          },
        },
      ];
      project.extractPropsFromStories(entries);
      const doc = entries.find(
        (entry) =>
          entry.storyPath === filePaths['accordion.stories.tsx'] &&
          entry.component?.importName === 'Accordion'
      )?.component?.reactComponentMeta;

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

  it('serializes metadata from the selected compound member instead of the wrapper export', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
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
      const entries: StoryRef[] = [
        {
          storyPath: filePaths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion.Root',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: filePaths['accordion.tsx'],
            isPackage: false,
          },
        },
      ];

      project.extractPropsFromStories(entries);

      const component = entries[0]?.component;
      const doc = component?.reactComponentMeta;

      expect(doc).toBeDefined();
      expect(doc?.displayName).toBe('Accordion.Root');
      expect(doc?.description).toBe('Root-specific description');
      expect(doc?.jsDocTags).toEqual({
        summary: ['Root summary'],
      });
      expect(component?.importOverride).toBeUndefined();
      expect(doc?.props.size.defaultValue).toEqual({ value: "'md'" });
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
    } finally {
      project.dispose();
    }
  });

  it('serializes metadata from the selected default-export member instead of the default wrapper', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
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
      const entries: StoryRef[] = [
        {
          storyPath: filePaths['button.stories.tsx'],
          component: {
            componentName: 'Button.Aligner',
            importId: './button',
            importName: 'default',
            member: 'Aligner',
            path: filePaths['button.tsx'],
            isPackage: false,
          },
        },
      ];

      project.extractPropsFromStories(entries);

      const component = entries[0]?.component;
      const doc = component?.reactComponentMeta;

      expect(doc).toBeDefined();
      expect(doc?.displayName).toBe('Button.Aligner');
      expect(doc?.description).toBe('Aligner-specific description');
      expect(doc?.jsDocTags).toEqual({
        summary: ['Aligner summary'],
      });
      expect(component?.importOverride).toBeUndefined();
      expect(doc?.props.side.defaultValue).toEqual({ value: "'start'" });
    } finally {
      project.dispose();
    }
  });

  it('preserves wrapper-level import overrides for selected compound members', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
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
      const entries: StoryRef[] = [
        {
          storyPath: filePaths['accordion.stories.tsx'],
          component: {
            componentName: 'Accordion.Root',
            importId: './accordion',
            importName: 'Accordion',
            member: 'Root',
            path: filePaths['accordion.tsx'],
            isPackage: false,
          },
        },
      ];

      project.extractPropsFromStories(entries);

      const component = entries[0]?.component;
      const doc = component?.reactComponentMeta;

      expect(doc).toBeDefined();
      expect(doc?.description).toBe('Root-specific description');
      expect(doc?.props.size.defaultValue).toEqual({ value: "'md'" });
      expect(component?.importOverride).toBe(
        "import { Accordion } from '@design-system/components/accordion';"
      );
    } finally {
      project.dispose();
    }
  });

  it('extracts props for different member accesses per entry', () => {
    // Same rationale as above: this test exercises memberAccess directly, so
    // the compound-component story should not encode an unsupported meta.component.
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
        export default {};
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

      const dialogDoc = entries.find(
        (entry) =>
          entry.storyPath === filePaths['dialog.stories.tsx'] &&
          entry.component?.importName === 'Dialog'
      )?.component?.reactComponentMeta;
      expect(dialogDoc).toBeDefined();
      expect(dialogDoc!.props.open).toBeDefined();
      expect(dialogDoc!.props.onOpenChange).toBeDefined();

      const buttonDoc = entries.find(
        (entry) =>
          entry.storyPath === filePaths['button.stories.tsx'] &&
          entry.component?.importName === 'Button'
      )?.component?.reactComponentMeta;
      expect(buttonDoc).toBeDefined();
      expect(buttonDoc!.props.label).toBeDefined();
      expect(buttonDoc!.props.variant).toBeDefined();
    } finally {
      project.dispose();
    }
  });

  it('extracts manifest JSDoc fields from TypeScript for react-component-meta', () => {
    const { projectDir, configPath, filePaths } = createTempProject({
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
      const entries: StoryRef[] = [
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
    } finally {
      project.dispose();
    }
  });
});
