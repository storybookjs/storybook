import 'svelte/internal/disclose-version';

Example_stories[$.FILENAME] = 'tests/stories/Example.stories.svelte';

import * as $ from 'svelte/internal/client';
import { fn } from 'storybook/test';
import { defineMeta } from '@storybook/addon-svelte-csf';
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
		onclick: fn(),
		onmouseenter: fn(),
		onmouseleave: fn()
	}
});

var root_2 = $.add_locations($.template(`<p> </p> <br>`, 1), Example_stories[$.FILENAME], [[37, 2], [37, 44]]);
var root = $.add_locations($.template(`<!> <!> <!> <!> <!>`, 1), Example_stories[$.FILENAME], []);

function Example_stories($$anchor, $$props) {
	$.check_target(new.target);
	$.push($$props, true, Example_stories);

	const template = $.wrap_snippet(Example_stories, function ($$anchor, args = $.noop, context = $.noop) {
		$.validate_snippet_args(...arguments);

		var fragment = $.comment();
		var node = $.first_child(fragment);

		Example(node, $.spread_props(args, {
			onclick: handleClick,
			children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
				var fragment_1 = root_2();
				var p = $.first_child(fragment_1);
				var text = $.child(p, true);

				$.reset(p);

				var text_1 = $.sibling(p);

				$.next();

				$.template_effect(() => {
					$.set_text(text, context().name);
					$.set_text(text_1, ` You clicked: ${$.get(count) ?? ''}`);
				});

				$.append($$anchor, fragment_1);
			}),
			$$slots: { default: true }
		}));

		$.append($$anchor, fragment);
	});

	let count = $.state(0);

	function handleClick() {
		$.set(count, $.get(count) + 1);
	}

	var fragment_2 = root();
	var node_1 = $.first_child(fragment_2);

	Story(node_1, { name: 'Default', template });

	var node_2 = $.sibling(node_1, 2);

	Story(node_2, {
		name: 'Rounded',
		args: { rounded: true },
		template
	});

	var node_3 = $.sibling(node_2, 2);

	Story(node_3, {
		name: 'Square',
		args: { rounded: false },
		template
	});

	var node_4 = $.sibling(node_3, 2);

	Story(node_4, {
		name: 'As child',
		asChild: true,
		children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
			var fragment_3 = $.comment();
			var node_5 = $.first_child(fragment_3);

			Example(node_5, {
				children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
					$.next();

					var text_2 = $.text('Label');

					$.append($$anchor, text_2);
				}),
				$$slots: { default: true }
			});

			$.append($$anchor, fragment_3);
		}),
		$$slots: { default: true }
	});

	var node_6 = $.sibling(node_4, 2);

	Story(node_6, {
		name: 'Children forwared',
		children: $.wrap_snippet(Example_stories, ($$anchor, $$slotProps) => {
			$.next();

			var text_3 = $.text('Forwarded label');

			$.append($$anchor, text_3);
		}),
		$$slots: { default: true }
	});

	$.append($$anchor, fragment_2);
	return $.pop({ ...$.legacy_api() });
}

if (import.meta.hot) {
	Example_stories = $.hmr(Example_stories, () => Example_stories[$.HMR].source);

	import.meta.hot.acceptExports(["default"],(module) => {
		module.default[$.HMR].source = Example_stories[$.HMR].source;
		$.set(Example_stories[$.HMR].source, module.default[$.HMR].original);
	});
}

export default Example_stories;
