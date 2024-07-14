import 'svelte/internal/disclose-version';

$.mark_module_start();
Example_stories.filename = 'stories/Example.stories.svelte';

import * as $ from 'svelte/internal/client';

var Example_default = $.add_locations(
  $.template(`<p> </p> <p> </p> <br>`, 1),
  Example_stories.filename,
  [
    [45, 4],
    [46, 4],
    [47, 24],
  ]
);
var Example_default_1 = $.add_locations($.template(`Label`, 1), Example_stories.filename, []);
var root = $.add_locations($.template(`<!> <!> <!> <!>`, 1), Example_stories.filename, []);

import { action } from '@storybook/addon-actions';
import { defineMeta, setTemplate } from '@storybook/addon-svelte-csf';
import Example from './Example.svelte';

/**
 * Description set explicitly in the comment above `defineMeta`.
 *
 * Multiline supported. And also Markdown syntax:
 *
 * * **Bold**,
 * * _Italic_,
 * * `Code`.
 */
const { Story } = defineMeta({
  title: 'Example',
  component: Example,
  tags: ['autodocs'],
  args: {
    onclick: action('onclick'),
    onmouseenter: action('onmouseenter'),
    onmouseleave: action('onmouseleave'),
  },
});

function Example_stories($$anchor, $$props) {
  if (new.target === Example_stories)
    throw new Error(
      'Instantiating a component with `new` is no longer valid in Svelte 5. See https://svelte-5-preview.vercel.app/docs/breaking-changes#components-are-no-longer-classes for more information'
    );
  $.push($$props, true, Example_stories);

  var render = $.wrap_snippet(($$anchor, args = $.noop, context = $.noop) => {
    var fragment = $.comment();
    var node = $.first_child(fragment);

    $.validate_component(Example)(
      node,
      $.spread_props(args, {
        onclick: handleClick,
        children: $.wrap_snippet(($$anchor, $$slotProps) => {
          var fragment_1 = Example_default();
          var p = $.first_child(fragment_1);
          var text = $.child(p);
          var p_1 = $.sibling($.sibling(p, true));
          var text_1 = $.child(p_1);
          var text_2 = $.sibling(p_1, true);
          var br = $.sibling(text_2);

          $.template_effect(() => {
            $.set_text(text, args()?.id);
            $.set_text(text_1, context().name);
            $.set_text(text_2, ` You clicked: ${$.stringify($.get(count))}`);
          });

          $.append($$anchor, fragment_1);
        }),
        $$slots: { default: true },
      })
    );

    $.append($$anchor, fragment);
  });

  $.validate_prop_bindings($$props, [], [], Example_stories);

  let count = $.source(0);

  function handleClick() {
    $.set(count, $.get(count) + 1);
  }

  setTemplate(render);

  var fragment_2 = root();
  var node_1 = $.first_child(fragment_2);

  $.validate_component(Story)(node_1, { name: 'Default' });

  var node_2 = $.sibling($.sibling(node_1, true));

  $.validate_component(Story)(node_2, { name: 'Rounded', args: { rounded: true } });

  var node_3 = $.sibling($.sibling(node_2, true));

  $.validate_component(Story)(node_3, { name: 'Square', args: { rounded: false } });

  var node_4 = $.sibling($.sibling(node_3, true));

  $.validate_component(Story)(node_4, {
    name: 'Without template',
    children: $.wrap_snippet(($$anchor, $$slotProps) => {
      var fragment_3 = $.comment();
      var node_5 = $.first_child(fragment_3);

      $.validate_component(Example)(node_5, {
        children: $.wrap_snippet(($$anchor, $$slotProps) => {
          var fragment_4 = Example_default_1();

          $.append($$anchor, fragment_4);
        }),
        $$slots: { default: true },
      });

      $.append($$anchor, fragment_3);
    }),
    $$slots: { default: true },
  });

  $.append($$anchor, fragment_2);
  return $.pop({ ...$.legacy_api() });
}

if (import.meta.hot) {
  const s = $.source(Example_stories);
  const filename = Example_stories.filename;

  Example_stories = $.hmr(s);
  Example_stories.filename = filename;

  if (import.meta.hot.acceptExports) {
    import.meta.hot.acceptExports(['default'], (module) => {
      $.set(s, module.default);
    });
  } else {
    import.meta.hot.acceptExports(['default'], (module) => {
      $.set(s, module.default);
    });
  }
}

export default Example_stories;

$.mark_module_end(Example_stories);
Example_stories.__docgen = { keywords: [], data: [], name: 'Example.stories.svelte' };
