import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import ts from 'typescript';
import { createCheckerByJson } from 'vue-component-meta';

import { buildApiDescription } from '../../../../renderers/vue3/src/docgen/api-description.ts';
import {
  CHECKER_OPTIONS,
  collectComponentMetaSources,
} from '../../../../renderers/vue3/src/docgen/component-meta.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const checker = createCheckerByJson(fixturesDir, { include: ['**/*'] }, CHECKER_OPTIONS);

async function apiDescriptionFor(fixtureCase: string): Promise<string | undefined> {
  const testDir = join(fixturesDir, fixtureCase);
  const [sfcFile] = readdirSync(testDir).filter((file) => file.endsWith('.vue'));
  const sources = await collectComponentMetaSources(checker, join(testDir, sfcFile), ts);
  const meta = sources.find((source) => source.exportName === 'default');
  return meta && buildApiDescription(meta);
}

describe('vue3 api description from real vue-component-meta output', () => {
  it('props-basic-types', async () => {
    expect(await apiDescriptionFor('props-basic-types')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type PropsBasicTypesProps = {
        /** The main label text. */
        label: string;
        /**
         * How many times the label repeats.
         *
         * @default 1
         */
        count?: number;
        /**
         * Whether the control is enabled.
         *
         * @default false
         */
        enabled?: boolean;
        /**
         * Plain string tags rendered after the label.
         *
         * @default []
         */
        tags?: string[];
        /** Arbitrary configuration object. */
        config?: { theme: string; dense: boolean; };
        /** Formats the count for display. */
        formatter?: ((value: number) => string);
        /** Unique token for the instance. */
        token?: symbol;
        /** Large numeric identifier. */
        big?: bigint;
      }
      \`\`\`"
    `);
  });

  it('props-generic', async () => {
    expect(await apiDescriptionFor('props-generic')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type PropsGenericProps<T> = {
        /** Items rendered in order. */
        items: T[];
        /** Currently selected item. */
        selected?: T;
      }
      \`\`\`"
    `);
  });

  it('v-model', async () => {
    expect(await apiDescriptionFor('v-model')).toMatchInlineSnapshot(`
      "## Models

      Two-way bindings. Bind each one with the \`v-model\` syntax shown next to it — do not pass the prop and listen to its \`update:\` event separately.

      \`\`\`
      export type VModelInputModels = {
        /** The text value controlled via the default v-model. */
        modelValue: string; // v-model="..."
        /** Whether the box is checked, controlled via the named v-model. */
        checked?: boolean; // v-model:checked="..."
      }
      \`\`\`

      ## Events

      \`\`\`
      export type VModelInputEvents = {
        "update:checked": [value: boolean | undefined];
        /** Emitted when the text value changes. */
        "update:modelValue": [value: string];
      }
      \`\`\`"
    `);
  });

  it('define-expose', async () => {
    expect(await apiDescriptionFor('define-expose')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type DefineExposeProps = {
        /** Visible label of the counter button. */
        label: string;
      }
      \`\`\`

      ## Exposed

      Available on the component instance through a template ref.

      \`\`\`
      export type DefineExposeExposed = {
        /** How many times the button has been pressed. */
        count: number;
        reset: () => void;
      }
      \`\`\`"
    `);
  });

  it('define-slots-with-props', async () => {
    expect(await apiDescriptionFor('define-slots-with-props')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type DefineSlotsWithPropsProps = {
        /**
         * Visible label of the button.
         *
         * @default "Button"
         */
        label?: string;
        /**
         * Whether the button is disabled.
         *
         * @default false
         */
        disabled?: boolean;
      }
      \`\`\`

      ## Slots

      Each slot is typed with the props it passes to its content.

      \`\`\`
      export type DefineSlotsWithPropsSlots = {
        /** Main content, rendered instead of the label. */
        default: any;
        /** Icon rendered before the content. */
        icon: { size: string; };
      }
      \`\`\`"
    `);
  });

  it('events-jsdoc', async () => {
    expect(await apiDescriptionFor('events-jsdoc')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type EventsJsdocProps = {
        /** Visible label. */
        label: string;
      }
      \`\`\`

      ## Events

      \`\`\`
      export type EventsJsdocEvents = {
        /** Emitted when the user cancels editing. */
        cancel: [];
        /** Emitted when the user saves the current value. */
        save: [payload: { id: number; }];
      }
      \`\`\`"
    `);
  });

  it('jsdoc-tags', async () => {
    expect(await apiDescriptionFor('jsdoc-tags')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type JsdocTagsProps = {
        /**
         * Visible label.
         *
         * @deprecated Prefer \`title\`.
         * @since 10.0
         */
        label?: string;
        /**
         * Preferred title text.
         *
         * @default "Untitled"
         */
        title?: string;
      }
      \`\`\`"
    `);
  });
  it('expose-event-collision keeps authored exposed members named like events', async () => {
    expect(await apiDescriptionFor('expose-event-collision')).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ExposeEventCollisionProps = {
        label?: string;
      }
      \`\`\`

      ## Events

      \`\`\`
      export type ExposeEventCollisionEvents = {
        focus: [];
        blur: [];
        boarding: [];
      }
      \`\`\`

      ## Exposed

      Available on the component instance through a template ref.

      \`\`\`
      export type ExposeEventCollisionExposed = {
        focus: () => void;
        blur: () => void;
        onboarding: () => void;
      }
      \`\`\`"
    `);
  });
});
