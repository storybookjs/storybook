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

Which args become bindings is decided by the component's metadata: an arg is an event binding only when it matches a declared output, and a property binding only when it matches a declared input.
Args that match neither are omitted, exactly as the browser generator omits them today.
A consequence worth knowing: a function passed to an `@Input()` stays a property binding rather than being reclassified as an event.

## Functions and `undefined` are printed literally

An arg whose value is a function is printed as its source text, and an explicit `undefined` is printed as `undefined`.
Angular template expressions cannot contain function literals, so such a snippet reads correctly but would not compile as written.

## Values are read from the source, not evaluated

The snippet is built by reading the story file rather than by running it, so an arg whose value is a constant, an enum member, or a call expression is shown as that expression rather than as the value it evaluates to.
For example `args: { kind: ButtonKind.Secondary }` is shown as `[kind]="ButtonKind.Secondary"`, where the browser generator showed `[kind]="'secondary'"`.

Args assigned in the older CSF2 style (`MyStory.args = { ... }`) are not read either.
Declare them on the story object or on the meta instead.

## The component's metadata has to be available

The snippet needs the component's selector and its input and output names.
Today those come from Compodoc's `documentation.json`, so when Compodoc is disabled or has not run, no snippet is generated and Storybook falls back to showing the story's own source.

Which engine supplies that metadata is not something snippet generation knows about; it consumes a resolver.
Replacing Compodoc with another source changes the resolver, not the snippets.
