# Angular story-docs snippets: v1 known limitations

Source material for the user-facing setup and known-limitations page.
Behaviour described here applies to `@storybook/angular-vite` with the `experimentalDocgenServer` feature flag on, where the Source block and the Code panel show a snippet generated on the server from Compodoc metadata instead of one generated in the browser from the loaded component class.

## Two snippet formats

`framework.options.snippetFormat` picks the shape of the emitted snippet.

`'template'` is the default and emits the bare markup, which is what the browser generator has always produced:

```html
<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>
```

`'component'` wraps that markup in the standalone host component it needs in order to compile, and the payload carries the matching import block:

```ts
import { Component } from '@angular/core';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-root',
  template: `<sb-button [label]="'Save'" [count]="3" (clicked)="clicked($event)"></sb-button>`,
  imports: [ButtonComponent],
})
export class App {
  clicked(event: unknown) {}
}
```

The host declares a no-op method per bound output because Angular's template type checking resolves `(clicked)="clicked($event)"` against the host class, so a snippet without it would not compile.
The host `selector` and class name are fixed, and the component is imported through the specifier the story file itself used.

## An incomplete snippet says so in `warning`, not in the markup

When a static pass cannot read part of a story, the affected story carries a `warning` alongside its `snippet` rather than a comment inside the snippet:

```json
{
  "id": "storydocs--spread-args",
  "name": "Spread Args",
  "snippet": "<sb-button [label]=\"'meta'\" [count]=\"1\" (clicked)=\"clicked($event)\"></sb-button>",
  "warning": "Incomplete snippet: `...sharedArgs` could not be resolved statically."
}
```

A `warning` still comes with a snippet; an `error` means there is no snippet at all.

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

Which args become bindings is decided by the component's Compodoc metadata: an arg is an event binding only when it matches a declared output, and a property binding only when it matches a declared input.
Args that match neither are omitted, exactly as the browser generator omits them today.
A consequence worth knowing: a function passed to an `@Input()` stays a property binding rather than being reclassified as an event.

## Functions and `undefined` are printed literally

An arg whose value is a function is printed as its source text, and an explicit `undefined` is printed as `undefined`.
Angular template expressions cannot contain function literals, so such a snippet reads correctly but would not compile as written.

## Values are read from the source, not evaluated

The snippet is built by reading the story file rather than by running it, so an arg whose value is a constant, an enum member, or a call expression is shown as that expression rather than as the value it evaluates to.
For example `args: { kind: ButtonKind.Secondary }` is shown as `[kind]="ButtonKind.Secondary"`, where the browser generator showed `[kind]="'secondary'"`.

Two related consequences:

- Args merged in with a spread (`args: { ...shared, count: 1 }`) cannot be resolved. The snippet keeps what it can and the story carries a `warning` rather than silently shipping an incomplete example.
- Args assigned in the older CSF2 style (`MyStory.args = { ... }`) are not read. Declare them on the story object or on the meta instead.

## Stories that supply their own template are untouched

A story with a `template` (directly, or returned from an inline `render`) is shown as written, including an empty one.
That matches what the browser generator does today.

The markup has to be readable from the source, though.
A template held in a variable, one built by interpolation, or a `render` that is a reference to a function declared elsewhere cannot be read without running the story.
In those cases the snippet falls back to the generated bindings and the story carries a `warning` naming what it could not resolve, rather than printing the variable name as if it were markup.

## The component's metadata has to be available

The snippet needs the component's selector and its input and output names.
Today those come from Compodoc's `documentation.json`, so when Compodoc is disabled or has not run, no snippet is generated and Storybook falls back to showing the story's own source.

Which engine supplies that metadata is not something snippet generation knows about; it consumes a resolver.
Replacing Compodoc with another source changes the resolver, not the snippets.
