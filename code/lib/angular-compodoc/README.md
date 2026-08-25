# Angular Compodoc

Shared parsing of [Compodoc](https://compodoc.app/)'s `documentation.json` into Storybook argTypes.

`@storybook/angular` and `@storybook/angular-vite` both turn Compodoc metadata into controls. This package holds that logic once so those call sites cannot drift apart.

- The root entry is environment-agnostic: it reads no globals and takes the Compodoc JSON, the feature flag, the logger and the HTML unwrapper as arguments.
- `./browser` is the preview-side adapter that supplies those four things from the browser globals.

This package is frozen and scheduled for deletion in Storybook 11, along with the Compodoc pipeline itself.
It stays on the legacy behaviour its committed baselines pin, so bug fixes belong in its successor, `@storybook/angular-cm`, not here.
`@storybook/angular-cm` carries a specialised fork of the conversion below: the two are deliberately not kept in sync.

## Compodoc quirk: `model()` is reported twice, under the wrong name

Angular's `model()` is one property that is both an input `foo` and an output `fooChange`.
Compodoc lists it in `inputsClass` and `outputsClass`, both times under the bare name `foo`, and never emits `fooChange`.
Left alone that renders a real two-way binding as an input plus an output the component does not have, so this package drops the bare-name output duplicate and synthesizes `fooChange` itself.

There is no `model()` marker in the JSON, so detection is structural: the same name in both arrays, on the same declaration line.
The name alone is not enough, because an `@Input('shared')` next to an `@Output('shared')` collides identically with no `model()` involved, and reading that as two-way deletes a real output and invents a `sharedChange` that does not exist.
Both producers therefore have to record `line` on the members the rule can match, which is why `@storybook/angular-cm` emits it on its signal members.
Being structural is also why the rule is not pinned to a Compodoc version: if Compodoc is ever fixed the two entries stop coinciding, the rule matches nothing, and this package stops synthesizing, which is correct, because a fixed Compodoc emits `fooChange` itself.

Known limitations:

- Two aliased members that collide on a name and also share a physical source line still read as a `model()`.
- An alias collision keeps the real output but costs the input its row, because argTypes is keyed by binding name and the outputs section is written last. That is the better half to keep: the output is the member the component really declares.
- A capture with no line numbers is never treated as two-way, so a genuine `model()` surfaces as it was reported, as a single bare-name entry in the outputs section with no synthesized `fooChange`.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).
