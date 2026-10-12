import { describe, expect, it } from 'vitest';

import { fillTemplate } from './fill-template-by-syntax.ts';
import { fillVueTemplate } from './fill-template-vue.ts';

describe('fillVueTemplate', () => {
  it('spreads v-bind="args" into attributes', () => {
    const onClick = Object.assign(() => {}, { getMockName: () => 'onClick' });
    expect(
      fillVueTemplate('<template>\n  <Button v-bind="args" />\n</template>', {
        label: 'Hi',
        primary: true,
        disabled: false,
        size: 2,
        onClick,
      })
    ).toMatchInlineSnapshot(`
      "<template>
        <Button
          label="Hi"
          primary
          :disabled="false"
          :size="2"
          @click="onClick"
        />
      </template>"
    `);
  });

  it('keeps short spreads on one line', () => {
    expect(fillVueTemplate('<Button v-bind="args" />', { label: 'Go' })).toBe(
      '<Button label="Go" />'
    );
  });

  it('fills bound attributes, dropping unset ones', () => {
    expect(
      fillVueTemplate('<Button :label="args.label" :size="args.size" :icon="args.icon" />', {
        label: 'Hi',
        size: 3,
      })
    ).toBe('<Button label="Hi" :size="3" />');
  });

  it('fills interpolations as text and other references as values', () => {
    expect(
      fillVueTemplate(
        '<Button v-if="args.visible" :style="{ color: args.color }">{{ args.label }}</Button>',
        { visible: true, color: 'red', label: 'Click me' }
      )
    ).toBe(`<Button v-if="true" :style="{ color: 'red' }">Click me</Button>`);
  });

  it('prints objects with single-quoted strings', () => {
    expect(fillVueTemplate('<List :items="args.items" />', { items: [{ name: 'a' }] })).toBe(
      `<List :items="[{ name: 'a' }]" />`
    );
  });

  it('is used for the vue template syntax', () => {
    expect(fillTemplate('<Button v-bind="args" />', { label: 'Go' }, 'vue')).toBe(
      '<Button label="Go" />'
    );
  });
});
