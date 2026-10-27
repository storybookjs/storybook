import { describe, expect, it } from 'vitest';

import { type ApiDescriptionSource, buildApiDescription } from './api-description.ts';

type Prop = ApiDescriptionSource['props'][number];
type Event = ApiDescriptionSource['events'][number];
type Slot = ApiDescriptionSource['slots'][number];
type Exposed = ApiDescriptionSource['exposed'][number];

// Fields the formatter never reads, filled so each case only states its actual inputs.
const unread = { tags: [], schema: '', declarations: [] };

const prop = (over: Pick<Prop, 'name' | 'type'> & Partial<Prop>): Prop => ({
  description: '',
  global: false,
  required: true,
  ...unread,
  ...over,
});

const event = (over: Pick<Event, 'name' | 'type'> & Partial<Event>): Event => ({
  description: '',
  signature: '',
  ...unread,
  schema: [],
  ...over,
});

const slot = (over: Pick<Slot, 'name' | 'type'> & Partial<Slot>): Slot => ({
  description: '',
  ...unread,
  ...over,
});

const exposed = (over: Pick<Exposed, 'name' | 'type'> & Partial<Exposed>): Exposed => ({
  description: '',
  ...unread,
  ...over,
});

const source = (overrides: Partial<ApiDescriptionSource>): ApiDescriptionSource => ({
  displayName: 'Button',
  props: [],
  events: [],
  slots: [],
  exposed: [],
  ...overrides,
});

describe('buildApiDescription', () => {
  it('renders props, events, slots and exposed as their own sections', () => {
    const result = buildApiDescription(
      source({
        props: [
          prop({
            name: 'label',
            type: 'string | undefined',
            description: 'Text on the button.',
            default: "'Click me'",
            required: false,
          }),
          prop({ name: 'disabled', type: 'boolean' }),
        ],
        events: [
          event({
            name: 'submit',
            type: '[payload: SubmitPayload]',
            description: 'Fires on submit.',
          }),
        ],
        slots: [slot({ name: 'default', type: '{ label: string; }' })],
        exposed: [
          exposed({ name: 'focus', type: '() => void', description: 'Focuses the input.' }),
        ],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = {
        /**
         * Text on the button.
         *
         * @default 'Click me'
         */
        label?: string;
        disabled: boolean;
      }
      \`\`\`

      ## Events

      \`\`\`
      export type ButtonEvents = {
        /** Fires on submit. */
        submit: [payload: SubmitPayload];
      }
      \`\`\`

      ## Slots

      Each slot is typed with the props it passes to its content.

      \`\`\`
      export type ButtonSlots = {
        default: { label: string; };
      }
      \`\`\`

      ## Exposed

      Available on the component instance through a template ref.

      \`\`\`
      export type ButtonExposed = {
        /** Focuses the input. */
        focus: () => void;
      }
      \`\`\`"
    `);
  });

  it('moves a prop and its update event into the Models section as one v-model binding', () => {
    const result = buildApiDescription(
      source({
        displayName: 'ColorPicker',
        props: [
          prop({ name: 'modelValue', type: 'string | undefined', required: false }),
          prop({
            name: 'alpha',
            type: 'number | undefined',
            description: 'Opacity of the color.',
            required: false,
          }),
          prop({ name: 'palette', type: 'string[]' }),
        ],
        events: [
          event({
            name: 'update:modelValue',
            type: '[value: string]',
            description: 'New color value.',
          }),
          event({ name: 'update:alpha', type: '[value: number]' }),
          event({ name: 'close', type: '[]' }),
        ],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Models

      Two-way bindings. Bind each one with the \`v-model\` syntax shown next to it — do not pass the prop and listen to its \`update:\` event separately.

      \`\`\`
      export type ColorPickerModels = {
        /** New color value. */
        modelValue?: string; // v-model="..."
        /** Opacity of the color. */
        alpha?: number; // v-model:alpha="..."
      }
      \`\`\`

      ## Props

      \`\`\`
      export type ColorPickerProps = {
        palette: string[];
      }
      \`\`\`

      ## Events

      \`\`\`
      export type ColorPickerEvents = {
        /** New color value. */
        "update:modelValue": [value: string];
        "update:alpha": [value: number];
        close: [];
      }
      \`\`\`"
    `);
  });

  it('leaves an update event alone when no prop matches it', () => {
    const result = buildApiDescription(
      source({
        events: [event({ name: 'update:query', type: '[value: string]' })],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Events

      \`\`\`
      export type ButtonEvents = {
        "update:query": [value: string];
      }
      \`\`\`"
    `);
  });

  it('renders jsdoc tags into the doc comment', () => {
    const result = buildApiDescription(
      source({
        props: [
          prop({
            name: 'size',
            type: "'small' | 'large'",
            description: 'Size of the button.',
            tags: [{ name: 'deprecated', text: 'use `scale` instead' }, { name: 'internal' }],
          }),
        ],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = {
        /**
         * Size of the button.
         *
         * @deprecated use \`scale\` instead
         * @internal
         */
        size: 'small' | 'large';
      }
      \`\`\`"
    `);
  });

  it('uses an authored default tag instead of appending the runtime default', () => {
    const result = buildApiDescription(
      source({
        props: [
          prop({
            name: 'placeholder',
            type: 'string | undefined',
            description: 'Placeholder shown while empty.',
            required: false,
            default: "'runtime-search'",
            tags: [{ name: 'default', text: '"Search…"' }],
          }),
        ],
      })
    );

    expect(result?.match(/@default/g)).toHaveLength(1);
    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = {
        /**
         * Placeholder shown while empty.
         *
         * @default "Search…"
         */
        placeholder?: string;
      }
      \`\`\`"
    `);
  });

  it('keeps multiline descriptions in a multiline doc comment', () => {
    const result = buildApiDescription(
      source({
        events: [
          event({
            name: 'submit',
            type: '[]',
            description: 'Validates the form.\nSubmits it when valid.',
          }),
        ],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Events

      \`\`\`
      export type ButtonEvents = {
        /**
         * Validates the form.
         * Submits it when valid.
         */
        submit: [];
      }
      \`\`\`"
    `);
  });

  it('quotes member names that are not valid identifiers', () => {
    const result = buildApiDescription(
      source({
        slots: [slot({ name: 'icon-left', type: '{}' })],
      })
    );

    expect(result).toMatchInlineSnapshot(`
      "## Slots

      Each slot is typed with the props it passes to its content.

      \`\`\`
      export type ButtonSlots = {
        "icon-left": {};
      }
      \`\`\`"
    `);
  });

  it('excludes global props and returns undefined when nothing else remains', () => {
    const result = buildApiDescription(
      source({
        props: [prop({ name: 'key', type: 'PropertyKey', global: true, required: false })],
      })
    );

    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty surface', () => {
    expect(buildApiDescription(source({}))).toBeUndefined();
  });
});
