import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { Fragment, createTextVNode, defineComponent, h } from 'vue';

import { fillTemplate } from './fill-template.ts';

const sfc = (markup: string, script = '') =>
  `${script ? `<script lang="ts" setup>\n${script}\n</script>\n\n` : ''}<template>\n${markup}\n</template>`;

const onClick = () => {};

describe('fillTemplate', () => {
  describe('v-bind="args"', () => {
    it('spreads the args as attributes, props by name and then listeners', () => {
      expect(
        fillTemplate(sfc('  <Button v-bind="args" />'), {
          size: 2,
          label: 'Hi',
          onClick,
          primary: true,
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button label="Hi" primary :size="2" @click="onClick" />
        </template>"
      `);
    });

    it('lays a long list out one attribute per line', () => {
      expect(
        fillTemplate(sfc('  <Button v-bind="args" />\n  <Button v-bind="args">Go</Button>'), {
          label: 'A rather long label',
          size: 'large',
          disabled: false,
          variant: 'primary',
          onClick,
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button
            :disabled="false"
            label="A rather long label"
            size="large"
            variant="primary"
            @click="onClick"
          />
          <Button
            :disabled="false"
            label="A rather long label"
            size="large"
            variant="primary"
            @click="onClick"
          >Go</Button>
        </template>"
      `);
    });

    it('keeps the attributes after the spread in the layout', () => {
      expect(
        fillTemplate(sfc('  <Button v-bind="args" v-model="modelValue" @click="onClick" />'), {
          label: 'A rather long label',
          modelValue: 'x',
          size: 'large',
          variant: 'primary',
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button
            label="A rather long label"
            size="large"
            variant="primary"
            v-model="modelValue"
            @click="onClick"
          />
        </template>"
      `);
    });

    it('keeps an attribute per line when the spread is on its own line', () => {
      expect(
        fillTemplate(sfc('  <Button\n    class="wide"\n    v-bind="args"\n  />'), {
          label: 'Hi',
          size: 'large',
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button
            class="wide"
            label="Hi"
            size="large"
          />
        </template>"
      `);
    });

    it('lets the later of an attribute and the spread win, keeping the class and listeners the element writes', () => {
      expect(
        fillTemplate(
          sfc('  <Button label="Before" class="wide" @click="go" v-bind="args" size="small" />'),
          { label: 'Hi', size: 'large', class: 'arg', onClick }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Button class="wide" @click="go" label="Hi" size="small" />
        </template>"
      `);
    });

    it('leaves out the args the element passes on its own', () => {
      expect(
        fillTemplate(
          sfc(
            '  <Field v-bind="args" :hint="hint" v-model="modelValue" v-model:checked="checked" @save="onSave">\n    Body\n    <template #footer>Footer</template>\n  </Field>'
          ),
          {
            label: 'Name',
            hint: 'Hint',
            modelValue: 'x',
            'onUpdate:modelValue': onClick,
            checked: true,
            'onUpdate:checked': onClick,
            onSave: onClick,
            default: 'Body',
            footer: 'Footer',
          }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Field
            label="Name"
            :hint="hint"
            v-model="modelValue"
            v-model:checked="checked"
            @save="onSave"
          >
            Body
            <template #footer>Footer</template>
          </Field>
        </template>"
      `);
    });

    it('treats unset args the same as a bound attribute does', () => {
      const args = { label: undefined, hint: '', icon: null };
      expect(fillTemplate(sfc('  <Button v-bind="args" />'), args)).toBe(
        fillTemplate(
          sfc('  <Button :hint="args.hint" :icon="args.icon" :label="args.label" />'),
          args
        )
      );
    });

    it('leaves out unset args and empty strings, and binds a function prop by its name', () => {
      expect(
        fillTemplate(sfc('  <Button v-bind="args" />'), {
          label: undefined,
          hint: '',
          icon: null,
          render: () => 'x',
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button :icon="null" :render="render" />
        </template>"
      `);
    });

    it('binds strings a plain attribute cannot hold, and values that are not strings', () => {
      expect(
        fillTemplate(sfc('  <Card v-bind="args" />'), {
          quoted: 'Say "hi"',
          both: `It's "fine"`,
          lines: 'one\ntwo',
          entity: 'Tom &amp Jerry',
          tags: ['a', 'b'],
          style: { color: 'red', 'z-index': 1 },
          since: new Date('2024-01-02T03:04:05.000Z'),
          'aria label': 'x',
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Card
            :both="'It\\'s &quot;fine&quot;'"
            entity="Tom &amp;amp Jerry"
            :lines="'one\\ntwo'"
            quoted='Say "hi"'
            :since="new Date('2024-01-02T03:04:05.000Z')"
            :style="{ color: 'red', 'z-index': 1 }"
            :tags="['a', 'b']"
            v-bind="{ 'aria label': 'x' }"
          />
        </template>"
      `);
    });

    it('fills the slots the spread names in as slot content, never as attributes', () => {
      const template = sfc('  <Panel v-bind="args /* slots: default, header */" />');
      expect(fillTemplate(template, { label: 'Hi', default: 'Body', header: 'Head' }))
        .toMatchInlineSnapshot(`
        "<template>
          <Panel label="Hi">
            Body
            <template #header>
              Head
            </template>
          </Panel>
        </template>"
      `);
      expect(fillTemplate(template, { label: 'Hi', default: '', header: undefined }))
        .toMatchInlineSnapshot(`
        "<template>
          <Panel label="Hi" />
        </template>"
      `);
    });

    it('throws for a slot function, whose content the snippet cannot know', () => {
      expect(() =>
        fillTemplate(sfc('  <Panel v-bind="args /* slots: header */" />'), { header: () => 'Head' })
      ).toThrow(UnprintableArgError);
    });

    it('keeps the indentation of a closing tag on its own line when slot content opens it', () => {
      expect(
        fillTemplate(sfc('  <Panel\n    v-bind="args /* slots: header */"\n  />'), {
          label: 'Go',
          header: 'Head',
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Panel
            label="Go"
          >
            <template #header>
              Head
            </template>
          </Panel>
        </template>"
      `);
    });

    it('adds the slots the spread names after the content the element writes', () => {
      expect(
        fillTemplate(
          sfc('  <Panel v-bind="args /* slots: default, header */">\n    <Icon />\n  </Panel>'),
          { default: 'Body', header: { title: 'Head' } }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Panel>
            <Icon />
            <template #header>
              {{ { title: 'Head' } }}
            </template>
          </Panel>
        </template>"
      `);
    });

    it('prints a VNode as its h() call or its markup, and a component as its name', () => {
      const Icon = defineComponent({ name: 'Icon', props: ['size'], setup: () => () => null });
      const Badge = { __name: 'Badge', __file: '/abs/path/Badge.vue', setup: () => () => null };
      expect(
        fillTemplate(sfc('  <Button v-bind="args">\n    {{ args.default }}\n  </Button>'), {
          icon: h(Icon, { size: 2 }),
          as: Badge,
          default: h('strong', { class: 'big' }, ['Go ', h(Icon, { size: 1 })]),
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <Button :as="Badge" :icon="h(Icon, { size: 2 })">
            <strong class="big">Go <Icon :size="1" /></strong>
          </Button>
        </template>"
      `);
    });

    it('throws for a VNode with a slot function, and for a fragment or text in an h() call', () => {
      const Icon = defineComponent({ name: 'Icon', setup: () => () => null });
      const template = sfc('  <Button v-bind="args">\n    {{ args.default }}\n  </Button>');
      expect(() => fillTemplate(template, { default: h(Icon, null, () => 'Inner') })).toThrow(
        UnprintableArgError
      );
      expect(() =>
        fillTemplate(template, { icon: h(Icon, null, { default: () => 'Inner' }) })
      ).toThrow(UnprintableArgError);
      expect(() => fillTemplate(template, { icon: h(Fragment, null, ['a']) })).toThrow(
        UnprintableArgError
      );
      expect(() => fillTemplate(template, { icon: createTextVNode('a') })).toThrow(
        UnprintableArgError
      );
    });
  });

  describe('bound attributes', () => {
    it('fill in the arg, dropping an unset one', () => {
      expect(
        fillTemplate(
          sfc(
            '  <Button\n    :label="args.label"\n    :size="args.size"\n    :icon="args.icon"\n    :primary="args.primary"\n    @click="args.onClick"\n    @focus="args.onFocus"\n  />'
          ),
          { label: 'Hi', size: 2, primary: true, onClick }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Button
            label="Hi"
            :size="2"
            primary
            @click="onClick"
          />
        </template>"
      `);
    });

    it('fill in expressions with single-quoted strings, escaping the attribute quote', () => {
      expect(
        fillTemplate(
          sfc(
            `  <div :style="{ color: args.color }" :title='args.title + "!"' :items="args.items" :class="args.label.toUpperCase()" />`
          ),
          { color: 'red', title: "It's", items: [{ name: 'Say "hi"' }], label: 'a & b' }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <div :style="{ color: 'red' }" :title='"It&#39;s" + "!"' :items="[{ name: 'Say &quot;hi&quot;' }]" :class="'a & b'.toUpperCase()" />
        </template>"
      `);
    });
  });

  it('fills only directive values, not text in a plain attribute', () => {
    expect(
      fillTemplate(sfc('  <a title="see args.label" :aria-label="args.label">Go</a>'), {
        label: 'Hi',
      })
    ).toMatchInlineSnapshot(`
      "<template>
        <a title="see args.label" aria-label="Hi">Go</a>
      </template>"
    `);
  });

  it('keeps a string arg from closing the setup script', () => {
    expect(
      fillTemplate(
        sfc('  <Field v-model="modelValue" />', 'const modelValue = ref(args.modelValue);'),
        {
          modelValue: 'a </script> b </SCRIPT>',
        }
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const modelValue = ref('a <\\/script> b <\\/SCRIPT>');
      </script>

      <template>
        <Field v-model="modelValue" />
      </template>"
    `);
  });

  it('prints an unset arg as undefined, except in the setup ref() of a v-model', () => {
    expect(
      fillTemplate(
        sfc(
          '  <Field v-model="modelValue" v-show="(args.active)" :title="String(args.active)" />',
          'const modelValue = ref(args.modelValue);\nconst upper = computed(() => format(args.label));'
        ),
        {}
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const modelValue = ref();
      const upper = computed(() => format(undefined));
      </script>

      <template>
        <Field v-model="modelValue" v-show="(undefined)" :title="String(undefined)" />
      </template>"
    `);
  });

  it('keeps a negative number apart from the operator before it', () => {
    expect(
      fillTemplate(sfc('  <Counter :step="-args.delta" :next="args.count + 1" />'), {
        delta: -1,
        count: -2,
      })
    ).toMatchInlineSnapshot(`
      "<template>
        <Counter :step="-(-1)" :next="(-2) + 1" />
      </template>"
    `);
  });

  it('keeps an object an arrow function returns from reading as a block', () => {
    expect(
      fillTemplate(sfc('  <Card :style="style" />', 'const style = computed(() => args.style);'), {
        style: { color: 'red' },
      })
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      const style = computed(() => ({ color: 'red' }));
      </script>

      <template>
        <Card :style="style" />
      </template>"
    `);
  });

  describe('text', () => {
    it('fills interpolations of plain text in as text', () => {
      expect(
        fillTemplate(sfc('  <p>{{ args.label }} {{ args.count }} {{ args.on }}</p>'), {
          label: 'Hello',
          count: 3,
          on: false,
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <p>Hello 3 false</p>
        </template>"
      `);
    });

    it('escapes markup and mustaches so they render as written', () => {
      expect(fillTemplate(sfc('  <p>{{ args.label }}</p>'), { label: '<b>1 & 2</b> {{ x }}' }))
        .toMatchInlineSnapshot(`
        "<template>
          <p>&lt;b&gt;1 &amp; 2&lt;/b&gt; &#123;&#123; x }}</p>
        </template>"
      `);
    });

    it('keeps padded text, objects and other expressions as interpolations', () => {
      expect(
        fillTemplate(
          sfc(
            '  <p>{{ args.padded }}</p>\n  <p>{{ args.user }}</p>\n  <p>{{args.user}}</p>\n  <p>{{ args.count + 1 }}</p>\n  <p>{{ args.braces }}</p>'
          ),
          { padded: ' x ', user: { name: 'Ann' }, count: -2, braces: 'a}}b' }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <p>{{ ' x ' }}</p>
          <p>{{ { name: 'Ann' } }}</p>
          <p>{{ { name: 'Ann' } }}</p>
          <p>{{ (-2) + 1 }}</p>
          <p>a}}b</p>
        </template>"
      `);
    });

    it('drops the line of slot text whose arg is unset', () => {
      expect(
        fillTemplate(
          sfc(
            '  <Panel>\n    {{ args.default }}\n    <template #header>\n      {{ args.header }}\n    </template>\n  </Panel>'
          ),
          { header: 'Header' }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Panel>
            <template #header>
              Header
            </template>
          </Panel>
        </template>"
      `);
    });

    it('drops a slot template whose args are all unset', () => {
      expect(
        fillTemplate(
          sfc(
            '  <Panel>\n    {{ args.default }}\n    <template #header>\n      {{ args.header }}\n    </template>\n  </Panel>'
          ),
          { default: 'Body' }
        )
      ).toMatchInlineSnapshot(`
        "<template>
          <Panel>
            Body
          </Panel>
        </template>"
      `);
    });

    it('keeps text ending in a brace from opening the interpolation after it', () => {
      expect(
        fillTemplate(sfc('  <p>{{ args.label }}{{ args.user }}</p>'), {
          label: 'x{',
          user: { name: 'Ann' },
        })
      ).toMatchInlineSnapshot(`
        "<template>
          <p>x&#123;{{ { name: 'Ann' } }}</p>
        </template>"
      `);
    });
  });

  it('fills nested elements, as an h() render prints them, each with its own spread', () => {
    expect(
      fillTemplate(
        sfc(
          '  <section class="toolbar" v-bind="args">\n    <h2>Actions</h2>\n    <Button v-bind="args" />\n    <Button label="Cancel" />\n  </section>'
        ),
        { label: 'Confirm', default: 'x' }
      )
    ).toMatchInlineSnapshot(`
      "<template>
        <section class="toolbar" label="Confirm">
          <h2>Actions</h2>
          <Button default="x" label="Confirm" />
          <Button label="Cancel" />
        </section>
      </template>"
    `);
  });

  it('keeps a mustache inside a filled interpolation from closing it', () => {
    expect(fillTemplate(sfc("  <p>{{ args.label + '!' }}</p>"), { label: 'a}}b' }))
      .toMatchInlineSnapshot(`
      "<template>
        <p>{{ 'a}\\u007db' + '!' }}</p>
      </template>"
    `);
  });

  it('keeps the structure of conditions and loops', () => {
    expect(
      fillTemplate(
        sfc(
          '  <ul v-if="args.visible">\n    <li v-for="item in args.items" :key="item">{{ item }}</li>\n  </ul>\n  <p v-else-if="args.items.length > 2">Many</p>'
        ),
        { visible: true, items: ['a', 'b'] }
      )
    ).toMatchInlineSnapshot(`
      "<template>
        <ul v-if="true">
          <li v-for="item in ['a', 'b']" :key="item">{{ item }}</li>
        </ul>
        <p v-else-if="2 > 2">Many</p>
      </template>"
    `);
  });

  it('fills the script with the args the setup reads', () => {
    expect(
      fillTemplate(
        sfc(
          '  <Field v-model="modelValue" :hint="upper" />',
          `import { computed, ref } from "vue";\nimport Field from './Field.vue';\n\nconst modelValue = ref(args.modelValue);\n\nconst checked = ref(args.checked);\nconst upper = computed(() => args.label.toUpperCase());\nconst fixed = args.count.toFixed(1);`
        ),
        { modelValue: 'Draft', label: 'Ready', count: 2 }
      )
    ).toMatchInlineSnapshot(`
      "<script lang="ts" setup>
      import { computed, ref } from "vue";
      import Field from './Field.vue';

      const modelValue = ref('Draft');

      const checked = ref();
      const upper = computed(() => 'Ready'.toUpperCase());
      const fixed = (2).toFixed(1);
      </script>

      <template>
        <Field v-model="modelValue" :hint="upper" />
      </template>"
    `);
  });

  it('leaves names that only start with args alone', () => {
    expect(
      fillTemplate(
        sfc('  <p :title="argsTitle + story.args.label + myargs.x">{{ $args.label }}</p>'),
        {
          label: 'Hi',
        }
      )
    ).toMatchInlineSnapshot(`
      "<template>
        <p :title="argsTitle + story.args.label + myargs.x">{{ $args.label }}</p>
      </template>"
    `);
  });

  it('leaves a template without args as it is', () => {
    const template = sfc('  <div class="wrap"><br><Badge text="New" /><!-- {{ args.x }} --></div>');
    expect(fillTemplate(template, { x: 1 })).toBe(template);
  });
});
