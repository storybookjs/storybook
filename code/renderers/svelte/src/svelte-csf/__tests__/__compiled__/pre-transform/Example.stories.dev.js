import "svelte/internal/disclose-version";

$.mark_module_start();
Example_stories[$.FILENAME] = "tests/stories/Example.stories.svelte";

import * as $ from "svelte/internal/client";
import { action } from '@storybook/addon-actions';
import { defineMeta, setTemplate } from '@storybook/addon-svelte-csf';
import Example from './Example.svelte';

var root_2 = $.add_locations($.template(`<p> </p> <p> </p> <br>`, 1), Example_stories[$.FILENAME], [[45, 4], [46, 4], [47, 24]]);
var root_4 = $.add_locations($.template(`Label`, 1), Example_stories[$.FILENAME], []);
var root = $.add_locations($.template(`<!> <!> <!> <!>`, 1), Example_stories[$.FILENAME], []);

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
    onmouseleave: action('onmouseleave')
  }
});

function Example_stories($$anchor, $$props) {
  $.check_target(new.target);
  $.push($$props, true, Example_stories);

  const render = $.wrap_snippet(Example_stories, ($$anchor, args = $.noop, context = $.noop) => {
    var fragment = $.comment();
    var node = $.first_child(fragment);

    Example(node, $.spread_props(args, {
      onclick: handleClick,
      children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
        var fragment_1 = root_2();
        var p = $.first_child(fragment_1);
        var text = $.child(p);

        $.reset(p);

        var p_1 = $.sibling($.sibling(p, true));
        var text_1 = $.child(p_1);

        $.reset(p_1);

        var text_2 = $.sibling(p_1, true);
        var br = $.sibling(text_2);

        $.template_effect(() => {
          $.set_text(text, args().id);
          $.set_text(text_1, context().name);
          $.set_text(text_2, ` You clicked: ${$.get(count) ?? ""}`);
        });

        $.append($$anchor, fragment_1);
      }),
      $$slots: { default: true }
    }));

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

  Story(node_1, { name: "Default" });

  var node_2 = $.sibling($.sibling(node_1, true));

  Story(node_2, { name: "Rounded", args: { rounded: true } });

  var node_3 = $.sibling($.sibling(node_2, true));

  Story(node_3, { name: "Square", args: { rounded: false } });

  var node_4 = $.sibling($.sibling(node_3, true));

  Story(node_4, {
    name: "Without template",
    children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
      var fragment_3 = $.comment();
      var node_5 = $.first_child(fragment_3);

      Example(node_5, {
        children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
          $.next();

          var fragment_4 = root_4();

          $.append($$anchor, fragment_4);
        }),
        $$slots: { default: true }
      });

      $.append($$anchor, fragment_3);
    }),
    $$slots: { default: true }
  });

  $.append($$anchor, fragment_2);
  return $.pop({ ...$.legacy_api() });
}

if (import.meta.hot) {
  Example_stories = $.hmr(Example_stories, () => Example_stories[$.HMR].source);

  import.meta.hot.acceptExports(["default"], (module) => {
    module.default[$.HMR].source = Example_stories[$.HMR].source;
    $.set(Example_stories[$.HMR].source, module.default[$.HMR].original);
  });
}

export default Example_stories;

$.mark_module_end(Example_stories);
