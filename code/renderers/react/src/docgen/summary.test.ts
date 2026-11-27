import * as path from 'node:path';

import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import {
  cleanup,
  createTempDir,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { createDocgenProvider, createSummaryProvider } from './docgen-worker.ts';

// TypeScript 4.x is a CommonJS module whose exports ESM cannot detect, so a dynamic import only
// exposes the API through `default`.
vi.mock('typescript', async (importOriginal) => ({
  default: await importOriginal<typeof import('typescript')>(),
}));

const stories = {
  Button: dedent`
    import { Button } from './Button';
    export default { component: Button };
    export const Default = {};
  `,
  Tooltip: dedent`
    import { Tooltip } from './barrel';
    export default { component: Tooltip };
    export const Default = {};
  `,
  Card: dedent`
    import Card from './Card';
    /** Cards as the dashboard uses them. */
    const meta = { component: Card };
    export default meta;
    export const Default = {};
  `,
  Input: dedent`
    import { Input as TextInput } from './Input';
    export default { component: TextInput };
    export const Default = {};
  `,
  Plain: dedent`
    import { Plain } from './Plain';
    export default { component: Plain };
    export const Default = {};
  `,
  Hook: dedent`
    export default { title: 'Hooks/use Thing' };
    export const Default = {};
  `,
  Badge: dedent`
    import { Badge } from '@acme/ui';
    export default { component: Badge };
    export const Default = {};
  `,
  Merged: dedent`
    import { Merged } from './Merged';
    export default { component: Merged };
    export const Default = {};
  `,
  Aliased: dedent`
    import { Aliased } from './Aliased';
    export default { component: Aliased };
    export const Default = {};
  `,
  Overloaded: dedent`
    import { Overloaded } from './Overloaded';
    export default { component: Overloaded };
    export const Default = {};
  `,
  Images: dedent`
    import React from 'react';
    import Image from '@acme/image';
    import { Frame } from './Frame';
    export default {};
    export const Default = { render: () => <Frame><Image src="a.png" /></Frame> };
  `,
  ButtonGroup: dedent`
    import React from 'react';
    import { Button } from './Button';
    import { ButtonGroup } from './ButtonGroup';
    export default {};
    export const Default = { render: () => <ButtonGroup><Button label="A" /></ButtonGroup> };
  `,
  Local: dedent`
    import React from 'react';
    /** Not the component of this file. */
    const Local = () => <div />;
    export default {};
    export const Default = { render: () => <Local /> };
  `,
  Declared: dedent`
    import React from 'react';
    /** A component that the story file declares. */
    const Declared = () => <div />;
    /** Docs on the meta of a component that docgen cannot read. */
    const meta = { component: Declared };
    export default meta;
    export const Default = {};
  `,
  ButtonPreview: dedent`
    import React from 'react';
    import { Button } from './Button';
    const ButtonPreview = () => <Button label="Preview" />;
    export default { component: ButtonPreview };
    export const Default = {};
  `,
  Global: dedent`
    /** Docs on the meta of a component that is no import. */
    const meta = { component: globalThis.__COMPONENTS__.Button };
    export default meta;
    export const Default = {};
  `,
  Namespace: dedent`
    import * as Buttons from './Button';
    /** Docs on the meta of a namespace. */
    const meta = { component: Buttons };
    export default meta;
    export const Default = {};
  `,
  Absent: dedent`
    import { Absent } from './Button';
    /** Docs on the meta of an export that does not exist. */
    const meta = { component: Absent };
    export default meta;
    export const Default = {};
  `,
  TabsRoot: dedent`
    import { Tabs } from './Tabs';
    export default { component: Tabs.Root };
    export const Default = {};
  `,
  Parts: dedent`
    import { Button } from './Button';
    const parts = { Button };
    export default { component: parts.Button };
    export const Default = {};
  `,
  Paired: dedent`
    import { Paired } from './Paired';
    export default { component: Paired };
    export const Default = {};
  `,
  Cast: dedent`
    import type React from 'react';
    import { Button } from './Button';
    export default { component: Button as React.FC<{ label: string }> };
    export const Default = {};
  `,
};

let tempDir: string;
let entries: Record<keyof typeof stories, IndexEntry>;

beforeAll(() => {
  tempDir = createTempDir('docgen-summary');
  const files = writeFiles(tempDir, {
    'tsconfig.json': tsconfigJSON(),
    'Button.tsx': dedent`
      import React from 'react';
      /**
       * A button for the main action in a view.
       *
       * @summary for user actions
       */
      export const Button = ({ label }: { label: string }) => <button>{label}</button>;
    `,
    'Tooltip.tsx': dedent`
      import React from 'react';
      /** A tooltip that replaces the title attribute. */
      export const RTooltip = React.forwardRef<HTMLDivElement, { text: string }>(
        ({ text }, ref) => <div ref={ref}>{text}</div>
      );
    `,
    'barrel.ts': `export { RTooltip as Tooltip } from './Tooltip';`,
    'Card.tsx': dedent`
      import React from 'react';
      /** A card that groups related content. */
      function Card({ title }: { title: string }) {
        return <section>{title}</section>;
      }
      export default Card;
    `,
    'Input.tsx': dedent`
      import React from 'react';
      /** A text input. */
      export function Input({ value }: { value: string }) {
        return <input value={value} readOnly />;
      }
    `,
    'Plain.tsx': dedent`
      import React from 'react';
      export const Plain = ({ label }: { label: string }) => <span>{label}</span>;
    `,
    'Merged.tsx': dedent`
      import React from 'react';
      /** What a merged component takes. */
      export interface Merged { label: string }
      /** A component that shares its name with an interface. */
      export const Merged = ({ label }: { label: string }) => <span>{label}</span>;
    `,
    'Aliased.tsx': dedent`
      import React from 'react';
      /**
       * A component that shares its name with a type.
       *
       * @summary aliased
       */
      export const Aliased = ({ label }: { label: string }) => <span>{label}</span>;
      /** What an aliased component takes. */
      export type Aliased = { label: string };
    `,
    'Overloaded.tsx': dedent`
      import React from 'react';
      /** With a label. */
      export function Overloaded(props: { label: string }): JSX.Element;
      /** With a count. */
      export function Overloaded(props: { count: number }): JSX.Element;
      export function Overloaded(props: any) {
        return <span>{props.label}</span>;
      }
    `,
    'Tabs.tsx': dedent`
      import React from 'react';
      /** The root of the tabs. */
      const Root = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
      /** The list of the tabs. */
      const List = () => <ul />;
      /** Tabs, as a compound component. */
      export const Tabs = { Root, List };
    `,
    'Paired.tsx': dedent`
      import React from 'react';
      /** Two components that share a docblock. */
      export const Other = () => <i />,
        Paired = () => <b />;
    `,
    'Frame.tsx': dedent`
      import React from 'react';
      /** A frame around a picture. */
      export const Frame = ({ children }: { children: React.ReactNode }) => <figure>{children}</figure>;
    `,
    'ButtonGroup.tsx': dedent`
      import React from 'react';
      /** Buttons that belong together. */
      export const ButtonGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    `,
    'node_modules/@acme/image/package.json': JSON.stringify({
      name: '@acme/image',
      main: 'index.js',
      types: 'index.d.ts',
    }),
    'node_modules/@acme/image/index.js': `export default function Image() { return null; }`,
    'node_modules/@acme/image/index.d.ts': dedent`
      /** The \`Image\` component is used to optimize images. */
      declare const Image: (props: { src: string }) => null;
      export default Image;
    `,
    'node_modules/@acme/ui/package.json': JSON.stringify({
      name: '@acme/ui',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
    }),
    'node_modules/@acme/ui/dist/index.js': `export { Badge } from './Badge.js';`,
    'node_modules/@acme/ui/dist/Badge.js': `export const Badge = () => null;`,
    'node_modules/@acme/ui/dist/index.d.ts': `export { Badge } from './Badge';`,
    'node_modules/@acme/ui/dist/Badge.d.ts': dedent`
      /** A badge from a package that ships its build. */
      export declare const Badge: (props: { count: number }) => null;
    `,
    ...Object.fromEntries(
      Object.entries(stories).map(([name, source]) => [`${name}.stories.tsx`, source])
    ),
  });
  entries = Object.fromEntries(
    Object.keys(stories).map((name) => [
      name,
      {
        type: 'story',
        subtype: 'story',
        id: `${name.toLowerCase()}--default`,
        name: 'Default',
        title: name === 'Hook' ? 'Hooks/use Thing' : `Components/${name}`,
        importPath: `./${path.relative(tempDir, files[`${name}.stories.tsx`])}`,
      } satisfies IndexEntry,
    ])
  ) as typeof entries;
});

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
});

afterAll(() => {
  vi.restoreAllMocks();
  cleanup(tempDir);
});

it.each(Object.keys(stories) as (keyof typeof stories)[])(
  'summarizes %s as docgen names and describes it',
  { timeout: 60_000 },
  async (name) => {
    const entry = entries[name];
    const docgen = await createDocgenProvider()(async () => undefined)({ entry });
    const [summary] = await createSummaryProvider()([{ entry }]);

    expect({
      name: summary?.name,
      description: summary?.description,
      summary: summary?.summary,
    }).toEqual({
      name: docgen?.name,
      description: docgen?.description,
      summary: docgen?.summary,
    });
  }
);

it('describes the cases above, so the comparison is not of nothing to nothing', async () => {
  const summaries = await createSummaryProvider()(
    Object.values(entries).map((entry) => ({ entry }))
  );

  expect(summaries).toMatchInlineSnapshot(`
    [
      {
        "description": "A button for the main action in a view.",
        "name": "Button",
        "summary": "for user actions",
      },
      {
        "description": "A tooltip that replaces the title attribute.",
        "name": "Tooltip",
        "summary": undefined,
      },
      {
        "description": "Cards as the dashboard uses them.",
        "name": "Card",
        "summary": undefined,
      },
      {
        "description": "A text input.",
        "name": "TextInput",
        "summary": undefined,
      },
      {
        "description": undefined,
        "name": "Plain",
        "summary": undefined,
      },
      {
        "description": undefined,
        "name": "useThing",
        "summary": undefined,
      },
      {
        "description": "A badge from a package that ships its build.",
        "name": "Badge",
        "summary": undefined,
      },
      {
        "description": "What a merged component takes.
    A component that shares its name with an interface.",
        "name": "Merged",
        "summary": undefined,
      },
      {
        "description": "A component that shares its name with a type.
    What an aliased component takes.",
        "name": "Aliased",
        "summary": "aliased",
      },
      {
        "description": "With a label.
    With a count.",
        "name": "Overloaded",
        "summary": undefined,
      },
      {
        "description": "The \`Image\` component is used to optimize images.",
        "name": "Images",
        "summary": undefined,
      },
      {
        "description": "Buttons that belong together.",
        "name": "ButtonGroup",
        "summary": undefined,
      },
      {
        "description": undefined,
        "name": "Local",
        "summary": undefined,
      },
      {
        "description": "Docs on the meta of a component that docgen cannot read.",
        "name": "Declared",
        "summary": undefined,
      },
      {
        "description": "A button for the main action in a view.",
        "name": "ButtonPreview",
        "summary": "for user actions",
      },
      {
        "description": "Docs on the meta of a component that is no import.",
        "name": "globalThis.__COMPONENTS__.Button",
        "summary": undefined,
      },
      {
        "description": "Docs on the meta of a namespace.",
        "name": "Buttons",
        "summary": undefined,
      },
      {
        "description": "Docs on the meta of an export that does not exist.",
        "name": "Absent",
        "summary": undefined,
      },
      {
        "description": "The root of the tabs.",
        "name": "Tabs.Root",
        "summary": undefined,
      },
      {
        "description": "A button for the main action in a view.",
        "name": "parts.Button",
        "summary": "for user actions",
      },
      {
        "description": "Two components that share a docblock.",
        "name": "Paired",
        "summary": undefined,
      },
      {
        "description": "A button for the main action in a view.",
        "name": "Button as React.FC<{ label: string }>",
        "summary": "for user actions",
      },
    ]
  `);
});
