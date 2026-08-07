# Angular story-docs snippets: v1 known limitations

Source material for the user-facing setup and known-limitations page.
Behaviour described here applies to `@storybook/angular-vite` with the `experimentalDocgenServer` feature flag on, where the Source block and the Code panel show a snippet generated on the server from the component's declared metadata instead of one generated in the browser from the loaded component class.

## Snippets no longer update as you change Controls

This is the one accepted regression of the server-side docs path.
The snippet is generated once, from the args written in the story file, so changing a Control updates the story but not the code shown next to it.

## Property and event bindings only

The generator emits `[input]="value"` and `(output)="handler($event)"` and nothing else.
Out of scope for this version:

- structural directives (`*ngIf`, `*ngFor`, `*ngSwitch`)
- two-way banana-in-a-box syntax: an Angular `model()` is shown as a separate `[value]` input and `(valueChange)` output, which is what `[(value)]` desugars to
- content projection, so a component with `<ng-content>` is shown as an empty element

## Args the component does not accept are not shown

Which args become bindings is decided by the component's metadata: an arg is a property binding only when it matches a declared input.
Args that match neither an input nor an output are omitted, exactly as the browser generator omits them today.
A consequence worth knowing: a function passed to an `@Input()` stays a property binding rather than being reclassified as an event.

## Functions and `undefined` are printed literally

An arg whose value is a function is printed as its source text, and an explicit `undefined` is printed as `undefined`.
Angular template expressions cannot contain function literals, so such a snippet reads correctly but would not compile as written.

## Values are read from the source, not evaluated

The snippet is built by reading the story file rather than by running it.
Literals, arrays, objects and enum members are resolved to the value the browser generator would have shown, but an arg whose value needs the story to run - a call expression, or a constant imported from another file - is printed as the expression as written.

Args assigned in the older CSF2 style (`MyStory.args = { ... }`) are read, even though the assignment sits outside the story's own initializer.

## Stories that supply their own template are untouched

A story with a `template` (directly, or returned from an inline `render`) is shown as written, including an empty one.
That matches what the browser generator does today.

A name declared in the same file is followed to what it holds, so `template: HOISTED_TEMPLATE` and `render: renderFn` are read rather than replaced by a fabricated element.
An imported one cannot be followed, and neither can a template built from an expression that needs the story to run.
In those cases the snippet falls back to the generated bindings rather than printing the variable name as if it were markup.

## `argsToTemplate` is expanded, not given up on

`argsToTemplate(args)` is the idiom the Angular docs use everywhere, and it expands to exactly the property and event bindings this generator already emits.
So a template built around it is read in full and the wrapper markup the story wrote survives:

```ts
render: (args) => ({
  props: args,
  template: `<div class="wrap"><sb-button ${argsToTemplate(args)}></sb-button></div>`,
});
```

```html
<div class="wrap"><sb-button [label]="'Save'" [count]="7" (clicked)="clicked($event)"></sb-button></div>
```

Two differences from what runs in the browser, both deliberate:

- values are inlined rather than referenced by name, so the snippet does not depend on the story's `props: args`
- `include` and `exclude` are honoured when written as array literals

An interpolated arg used as slot content (`<span>${footer}</span>`) is substituted when its value is a string, number or boolean.
Any other `${…}` needs the story to run, so the template is dropped and the generated bindings stand in.

## The component's metadata has to be available

The snippet needs the component's selector and its input and output names.
Under `features.experimentalDocgenServer` those come from the in-process analyzer in `@storybook/angular-cm`, which reads the component's TypeScript source directly.
When it cannot resolve the component, no snippet is generated and Storybook falls back to showing the story's own source.
