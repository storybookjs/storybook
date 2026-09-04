# Meta args inference in CSF factories

Why `MetaArgsConstraint` and `MetaArgsInput` exist, what they give up, and what would make them
unnecessary. Read this before touching the `meta()` signatures in the renderers.

## The problem

`meta()` captures the args it is given, so a story does not have to repeat them:

```ts
const meta = preview.meta({
  component: Button, // props: { variant: 'primary' | 'secondary'; disabled: boolean }
  args: { variant: 'primary', disabled: false },
});

export const Default = meta.story(); // nothing left to provide
```

Until #36185, this only worked when no prop had a literal type. With `variant: 'primary' | 'secondary'`,
`meta.story()` demanded `variant` again ([#36125](https://github.com/storybookjs/storybook/issues/36125),
[#32829](https://github.com/storybookjs/storybook/issues/32829) for enums).

## Why TypeScript cannot do this in one object

TypeScript infers all type parameters of a call at once, and it checks the argument object property by
property. The component args (`TArgs`) come from `component`, but `args` sits in the same object, so while
`args` is checked, `TArgs` is not known yet. Three things follow:

- Literals have no contextual type and widen: `'primary'` becomes `string`.
- Array literals have no tuple context: `['x', 1]` becomes `(string | number)[]`.
- Callbacks get no contextual signature from the component.

The original signature captured the args with a type parameter constrained to the component args:

```ts
TMetaArgs extends Partial<TArgs>,
>(meta: { component?: ComponentType<TArgs>; args?: TMetaArgs })
```

The widened `{ variant: string }` does not satisfy `Partial<{ variant: 'primary' | 'secondary' }>`. When an
inferred type fails its constraint, TypeScript replaces it with the constraint itself. The constraint is
all-optional, our "did meta provide anything" guard treats an all-optional type as empty, and the story
demands every arg again.

The TypeScript team has drawn this line deliberately. Since TypeScript 4.7, "intra-expression inference"
([microsoft/TypeScript#48538](https://github.com/microsoft/TypeScript/pull/48538)) lets inferences flow from
earlier to later properties of one object literal, but only into context-sensitive functions (functions with
untyped parameters), never into plain values. The PR calls the direction limitation "a long standing
limitation of our inference algorithm, and one that isn't likely to change". The closest open request is
[microsoft/TypeScript#47599](https://github.com/microsoft/TypeScript/issues/47599); nothing on the 7.x
iteration plans touches this. `const` type parameters (TypeScript 5.0) keep literals but still do not know
the component, and `NoInfer` (5.4) only blocks inference.

## What we do

1. **Widen the constraint** so the widened args TypeScript infers satisfy it and nothing falls back.
2. **Check the primitive args exactly** afterwards, because widening only lost precision there.

```ts
export type MetaArgsConstraint<TArgs> = { [K in keyof TArgs]?: Widen<TArgs[K]> };

export type MetaArgsInput<TInput, TArgs> = TInput & Partial<Pick<TArgs, PrimitiveKeys<TArgs>>>;
```

Every renderer's `meta()` uses them the same way:

```ts
TMetaArgs extends MetaArgsConstraint<TArgs & T['args']>,
>(meta: { args?: MetaArgsInput<TMetaArgs, TArgs & T['args']> })
```

`Widen` maps literal types to their primitives (type-fest's `LiteralToPrimitive`), recursing into arrays and
objects and leaving functions alone. `PrimitiveKeys` is a one-line local type rather than type-fest's
`ConditionalKeys`, whose extra machinery makes TypeScript give up ("union type too complex") on the
unconstrained `TArgs` of the render-only overloads. The exact check covers primitives only, on purpose: a function or object type in it would hand a
contextual signature to a callback in `args` while `TArgs` is still being inferred, and TypeScript reports
that as a circular return type (`TS7023`) for any `() => {}` in the args, including one nested inside an
object or array arg. Function, object and array args are still validated, through the constraint, the way
they always were.

### What this gives up

Literal precision inside object, array and tuple args is checked widened only. `nested: { mode: 'c' }`
and `tuple: [1, 'x']` are accepted when the component declares `mode: 'a' | 'b'` and `tuple: ['x', number]`.
Top-level literals, enums, template literals, function signatures and handler parameter inference are all
exact.

### What we tried and rejected

| Attempt                                                                | Result                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `const TMetaArgs` (the fix proposed in #36134 and #36150)              | Keeps literals, but infers arrays as `readonly` tuples, which fail a mutable `string[]` prop: same fallback. Needs TypeScript 5.0. |
| `const TMetaArgs extends Partial<ReadonlyDeep<TArgs>>`                 | Works, but `meta.input.args` becomes deeply readonly and literal; `meta.input.args.items` no longer fits a `string[]` prop. Undoing that with `WritableDeep` breaks the `Meta` constraint and story optionality. |
| Unconstrained `TMetaArgs` plus `args?: TMetaArgs & Partial<TArgs>`     | Fixes every literal case, but `onDismiss: () => {}` in meta args is a circular return type: the validator hands the callback a signature that still refers to `TArgs`. |
| Exclude only top-level function args from the check                    | Same circularity for a `() => {}` nested in an object or array arg.                                          |
| Replace nested function types in the check with `(...args: any) => any` | No circularity, but handler parameters lose their inferred types everywhere.                                |
| Exclude every arg that contains a function anywhere                    | Works, but needs a recursive "contains a function" type that nobody can explain without this document.       |

## What would make this unnecessary

Fixing `TArgs` before `args` is checked removes all of the above. Two API shapes do that, and both are the
pattern libraries with the same problem use (tRPC, TanStack, Hono, Zod):

```ts
preview.meta(Button, { args: { variant: 'primary' } });
preview.component(Button).meta({ args: { variant: 'primary' } });
```

With either, the original `TMetaArgs extends Partial<TArgs>` is enough, `args` is contextually typed by the
real props, and literals, tuples and callbacks all come out exact. This is a public API change and a
separate decision.

## How to verify a change

The type tests live next to each `meta()` signature: `code/renderers/react/src/csf-factories.test.tsx`,
`code/renderers/vue3/src/csf-factories.test.ts`, `code/renderers/web-components/src/csf-factories.test.ts`,
`code/frameworks/angular/src/client/csf-factories.test.ts` and
`code/frameworks/angular-vite/src/client/csf-factories.test.ts`. The "Literal args" tests cover the cases in
this document, including a `() => {}` nested inside an object arg. Run `yarn nx check <project>` for each
package; the React check runs in seconds with the native compiler.
