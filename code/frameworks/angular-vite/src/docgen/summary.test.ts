import type { IndexEntry } from 'storybook/internal/types';

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { createDocgenProvider, createSummaryProvider } from './docgen-worker.ts';

const storyOf = (imports: string, component: string) => dedent`
  ${imports}
  export default { component: ${component} };
  export const Default = {};
`;

const buttonStory = storyOf(
  `import { ButtonComponent } from './button.component';`,
  'ButtonComponent'
);

// Each case is a directory of its own, with one story file in it.
const cases = {
  'Direct Import': {
    'button.component.ts': dedent`
      import { Component, Input } from '@angular/core';

      /**
       * A button for the main action in a view.
       *
       * It takes its label as an input, such as \`@Input() label\`.
       *
       * @summary for user actions
       * @example <sb-button label="Save" />
       */
      @Component({ selector: 'sb-button', template: '<button>{{ label }}</button>' })
      export class ButtonComponent {
        @Input() label = 'Save';
      }
    `,
    'button.stories.ts': buttonStory,
  },
  Barrel: {
    'tooltip.component.ts': dedent`
      /** A tooltip that replaces the title attribute. */
      export class TooltipComponent {}
    `,
    'index.ts': `export { TooltipComponent as Tooltip } from './tooltip.component';`,
    'tooltip.stories.ts': storyOf(`import { Tooltip } from './index';`, 'Tooltip'),
  },
  'Built Library': {
    'node_modules/@acme/ui/package.json': JSON.stringify({
      name: '@acme/ui',
      exports: { '.': { types: './index.d.ts', default: './fesm2022/ui.mjs' } },
    }),
    'node_modules/@acme/ui/index.d.ts': dedent`
      /** A badge, as its declaration file documents it. */
      export declare class BadgeComponent {}
    `,
    'node_modules/@acme/ui/fesm2022/ui.mjs': dedent`
      /** A badge, as its build documents it. */
      export class BadgeComponent {}
    `,
    'badge.stories.ts': storyOf(`import { BadgeComponent } from '@acme/ui';`, 'BadgeComponent'),
  },
  'Default Export': {
    'card.component.ts': dedent`
      /** A card that groups related content. */
      export default class CardComponent {}
    `,
    'card.stories.ts': storyOf(`import Card from './card.component';`, 'Card'),
  },
  'Import Alias': {
    'input.component.ts': dedent`
      /** A text input. */
      class InputComponent {}
      export { InputComponent as Input };
    `,
    'input.stories.ts': storyOf(
      `import { Input as TextInput } from './input.component';`,
      'TextInput'
    ),
  },
  'In The Story File': {
    'badge.stories.ts': dedent`
      /** A badge that counts. */
      class BadgeComponent {}
      export default { component: BadgeComponent };
      export const Default = {};
    `,
  },
  'No Docblock': {
    'button.component.ts': `export class ButtonComponent {}`,
    'button.stories.ts': dedent`
      import { ButtonComponent } from './button.component';
      /** Buttons as the dashboard uses them. */
      const meta = { component: ButtonComponent };
      export default meta;
      export const Default = {};
    `,
  },
  'Tag In A Sentence': {
    'button.component.ts': dedent`
      /**
       * Wraps the @angular/cdk overlay.
       *
       * @summary
       */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Tags Only': {
    'button.component.ts': dedent`
      /**
       * @description A button described
       * by a tag.
       * @summary for user actions,
       *   over two lines
       * @summary a second summary
       */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Decorator In A Code Fence': {
    'button.component.ts': dedent`
      /**
       * A button to extend:
       *
       * \`\`\`ts
       * @Component({ selector: 'my-button' })
       * class MyButton extends ButtonComponent {}
       * \`\`\`
       */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Docblock Below The Decorator': {
    'button.component.ts': dedent`
      import { Component } from '@angular/core';

      @Component({ selector: 'sb-button', template: '' })
      /** A docblock that TypeScript gives to no declaration. */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Windows Line Endings': {
    'button.component.ts':
      '/**\r\n * A button,\r\n * on two lines.\r\n */\r\nexport class ButtonComponent {}\r\n',
    'button.stories.ts': buttonStory,
  },
  'Merged With An Interface': {
    'button.component.ts': dedent`
      /** What a button emits. */
      export interface ButtonComponent {
        clicked: unknown;
      }

      /** A button that shares its name with an interface. */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Not A Class': {
    'button.component.ts': dedent`
      /** A factory of buttons. */
      export const ButtonComponent = () => class {};
    `,
    'button.stories.ts': buttonStory,
  },
  'Anonymous Class': {
    'button.component.ts': dedent`
      /** A class without a name. */
      export default class {}
    `,
    'button.stories.ts': storyOf(`import Button from './button.component';`, 'Button'),
  },
  'Ignored Class': {
    'button.component.ts': dedent`
      /**
       * A button left out of the docs.
       *
       * @ignore
       */
      export class ButtonComponent {}
    `,
    'button.stories.ts': buttonStory,
  },
  'Unresolvable Import': { 'button.stories.ts': buttonStory },
  'Missing Export': {
    'button.component.ts': `export class LinkComponent {}`,
    'button.stories.ts': buttonStory,
  },
  'Unreadable Expression': {
    'button.stories.ts': dedent`
      export default { component: createButton() };
      export const Default = {};
    `,
  },
  'No Component': {
    'hook.stories.ts': dedent`
      export default { title: 'Hooks/use Thing' };
      export const Default = {};
    `,
  },
};

type Case = keyof typeof cases;
const names = Object.keys(cases) as Case[];

let tempDir: string;
let entries: Record<Case, IndexEntry>;

beforeAll(() => {
  tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'sb-angular-summary-')));
  entries = Object.fromEntries(
    names.map((name, index) => {
      const directory = join(tempDir, String(index));
      mkdirSync(directory);
      const files = Object.entries<string>(cases[name]);
      files.forEach(([file, source]) => {
        mkdirSync(dirname(join(directory, file)), { recursive: true });
        writeFileSync(join(directory, file), source);
      });
      const [storyFile] = files.map(([file]) => file).filter((file) => file.includes('.stories.'));
      return [
        name,
        {
          type: 'story',
          subtype: 'story',
          id: `${index}--default`,
          name: 'Default',
          title: `Components/${name}`,
          importPath: relative(process.cwd(), join(directory, storyFile)),
        } satisfies IndexEntry,
      ];
    })
  ) as typeof entries;
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const docgen = createDocgenProvider({ propsTable: 'api' })(async () => undefined);

it.each(names)(
  'summarizes "%s" as docgen names and describes it',
  { timeout: 60_000 },
  async (name) => {
    const entry = entries[name];
    const payload = await docgen({ entry });
    const [summary] = await createSummaryProvider()([{ entry }]);

    expect({
      name: summary?.name,
      description: summary?.description,
      summary: summary?.summary,
    }).toEqual({
      name: payload?.name,
      description: payload?.description,
      summary: payload?.summary,
    });
  }
);

it('describes the cases above, so the comparison is not of nothing to nothing', async () => {
  const summaries = await createSummaryProvider()(names.map((name) => ({ entry: entries[name] })));

  expect(Object.fromEntries(summaries.map((summary, index) => [names[index], summary])))
    .toMatchInlineSnapshot(`
    {
      "Anonymous Class": {
        "description": "A class without a name.",
        "name": "Button",
        "summary": undefined,
      },
      "Barrel": {
        "description": "A tooltip that replaces the title attribute.",
        "name": "TooltipComponent",
        "summary": undefined,
      },
      "Built Library": {
        "description": "A badge, as its build documents it.",
        "name": "BadgeComponent",
        "summary": undefined,
      },
      "Decorator In A Code Fence": {
        "description": "A button to extend:

    \`\`\`ts",
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Default Export": {
        "description": "A card that groups related content.",
        "name": "CardComponent",
        "summary": undefined,
      },
      "Direct Import": {
        "description": "A button for the main action in a view.

    It takes its label as an input, such as \`@Input() label\`.",
        "name": "ButtonComponent",
        "summary": "for user actions",
      },
      "Docblock Below The Decorator": {
        "description": undefined,
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Ignored Class": {
        "description": "A button left out of the docs.",
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Import Alias": {
        "description": "A text input.",
        "name": "InputComponent",
        "summary": undefined,
      },
      "In The Story File": {
        "description": "A badge that counts.",
        "name": "BadgeComponent",
        "summary": undefined,
      },
      "Merged With An Interface": {
        "description": "What a button emits.
    A button that shares its name with an interface.",
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Missing Export": {
        "description": undefined,
        "name": "Missing Export",
        "summary": undefined,
      },
      "No Component": undefined,
      "No Docblock": {
        "description": undefined,
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Not A Class": {
        "description": "A factory of buttons.",
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Tag In A Sentence": {
        "description": "Wraps the",
        "name": "ButtonComponent",
        "summary": "",
      },
      "Tags Only": {
        "description": "A button described
    by a tag.",
        "name": "ButtonComponent",
        "summary": "for user actions,
    over two lines",
      },
      "Unreadable Expression": {
        "description": undefined,
        "name": "createButton()",
        "summary": undefined,
      },
      "Unresolvable Import": {
        "description": undefined,
        "name": "ButtonComponent",
        "summary": undefined,
      },
      "Windows Line Endings": {
        "description": "A button,
    on two lines.",
        "name": "ButtonComponent",
        "summary": undefined,
      },
    }
  `);
});

it('leaves a file that is not a story file to the next provider', async () => {
  const entry = { ...entries['Direct Import'], importPath: './button.component.ts' };

  expect(await createSummaryProvider()([{ entry }])).toEqual([undefined]);
});
