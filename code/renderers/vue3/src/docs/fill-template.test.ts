import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { defineComponent, h } from 'vue';

import { fillTemplate } from './fill-template.ts';

const sfc = (markup: string, script = '') =>
  `${script ? `<script lang="ts" setup>\n${script}\n</script>\n\n` : ''}<template>\n${markup}\n</template>`;

const fill = (markup: string, args: Record<string, unknown>) =>
  fillTemplate(sfc(markup), args).slice('<template>\n'.length, -'\n</template>'.length);

const onClick = () => {};

describe('fillTemplate', () => {
  it('prints the args in the script setup, escaping a closing script tag', () => {
    expect(
      fillTemplate(
        sfc('  <Button :label="upper" />', 'const upper = computed(() => args.label.trim());'),
        { label: `It's </script>` }
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const upper = computed(() => 'It\\'s <\\/script>'.trim());
      </script>

      <template>
        <Button :label="upper" />
      </template>"
    `);
  });

  describe('a bound arg', () => {
    it('reads a string as a static attribute', () => {
      expect(fill('<Button :label="args.label" />', { label: 'Say "hi" &copy;' })).toBe(
        '<Button label="Say &quot;hi&quot; &amp;copy;" />'
      );
    });

    it('prints any other value as code', () => {
      expect(
        fill('<Button :primary="args.primary" :tags="args.tags" />', {
          primary: true,
          tags: ["it's", 'b'],
        })
      ).toBe(`<Button :primary="true" :tags="['it\\'s', 'b']" />`);
    });

    it('is left out when unset', () => {
      expect(fill('<Button :label="args.label" @click="args.onClick" />', {})).toBe('<Button />');
    });

    it('names a listener by its arg', () => {
      expect(fill('<Button @click="args.onClick" />', { onClick })).toBe(
        '<Button @click="onClick" />'
      );
    });
  });

  it('fills the args in any other expression, keeping the rest as written', () => {
    expect(
      fill(
        `<div v-if="args.loading" :class="{ big: args.size === 'lg' }">{{ args.count + 1 }}</div>`,
        {
          loading: true,
          size: 'lg',
          count: 2,
        }
      )
    ).toBe(`<div v-if="true" :class="{ big: 'lg' === 'lg' }">{{ 2 + 1 }}</div>`);
  });

  describe('an interpolated arg', () => {
    it('reads a primitive as escaped text', () => {
      expect(fill('<p>{{ args.label }}</p>', { label: '<b> & {{ x }}' })).toBe(
        '<p>&lt;b&gt; &amp; &#123;&#123; x }}</p>'
      );
    });

    it('prints padded text and other values as code', () => {
      expect(
        fill('<p>{{ args.label }}</p><p>{{ args.item }}</p>', {
          label: ' padded ',
          item: { n: 1 },
        })
      ).toBe(`<p>{{ ' padded ' }}</p><p>{{ { n: 1 } }}</p>`);
    });

    it('is empty when unset', () => {
      expect(fill('<p>{{ args.label }}</p>', {})).toBe('<p></p>');
    });
  });

  describe('v-bind="args"', () => {
    it('spreads one attribute per arg', () => {
      expect(
        fill('<Button v-bind="args" />', {
          label: 'Hi',
          primary: true,
          size: 2,
          unset: undefined,
          onClick,
          'onUpdate:modelValue': onClick,
        })
      ).toBe(
        '<Button label="Hi" primary :size="2" @click="onClick" @update:modelValue="onUpdateModelValue" />'
      );
    });

    it('leaves out the args the tag writes itself and the slots it names', () => {
      expect(
        fill(
          '<Button v-bind="args /* slots: default */" v-model="modelValue" :tone="tone" @click="handle" />',
          { label: 'Hi', modelValue: 'x', tone: 'dark', onClick, default: 'Body' }
        )
      ).toBe('<Button label="Hi" v-model="modelValue" :tone="tone" @click="handle" />');
    });

    it('throws for a set arg that overrides an attribute written before it', () => {
      const template = '<Button size="small" v-bind="args" />';
      expect(fill(template, { label: 'Hi' })).toBe('<Button size="small" label="Hi" />');
      expect(() => fill(template, { label: 'Hi', size: 'large' })).toThrow(UnprintableArgError);
    });
  });

  describe('a slot arg', () => {
    const slots = [
      '<Panel v-bind="args /* slots: default, header */">',
      '  {{ args.default }}',
      '  <template #header>',
      '    {{ args.header }}',
      '  </template>',
      '</Panel>',
    ].join('\n');

    it('is filled in as content', () => {
      expect(fill(slots, { default: 'Body', header: 'Title' })).toMatchInlineSnapshot(`
        "<Panel>
          Body
          <template #header>
            Title
          </template>
        </Panel>"
      `);
    });

    it('keeps an empty string as code, so the component shows no fallback', () => {
      expect(fill('<Panel>{{ args.default }}</Panel>', { default: '' })).toBe(
        "<Panel>{{ '' }}</Panel>"
      );
    });

    it('is left out when unset, so the component shows its fallback', () => {
      expect(fill(slots, {})).toBe('<Panel />');
      expect(fill(slots, { default: 'Body' })).toMatchInlineSnapshot(`
        "<Panel>
          Body
        </Panel>"
      `);
    });
  });

  it.each([
    ['a VNode', h('strong', 'Hi')],
    ['a component', defineComponent({ name: 'Icon', setup: () => () => null })],
    ['a slot function', () => 'Body'],
  ])('throws for %s it cannot print', (_, value) => {
    expect(() => fill('<Panel>{{ args.default }}</Panel>', { default: value })).toThrow(
      UnprintableArgError
    );
  });
});
