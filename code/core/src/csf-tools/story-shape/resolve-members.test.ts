import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { babelParseFile } from '../CsfFile.ts';
import { isSelfContained } from './resolve-arg-value.ts';
import {
  type ReferenceContext,
  type ReferenceModule,
  resolveArgsRecord,
  resolveBindingMembers,
  resolveReferencedValue,
  sourceOf,
} from './resolve-members.ts';

const moduleOf = (code: string, filePath: string): ReferenceModule => ({
  program: babelParseFile({ code, filename: filePath }).path,
  filePath,
});

/** Context over a set of virtual modules keyed by the specifier each one is imported as. */
const contextOf = (
  files: Record<string, string>,
  entry = 'entry.ts',
  externalize?: ReferenceContext['externalize']
): ReferenceContext => {
  const modules = Object.fromEntries(
    Object.entries(files).map(([path, code]) => [path, moduleOf(code, path)])
  );
  return {
    ...modules[entry],
    resolveModule: (_fromFile, specifier) => modules[`${specifier.replace(/^\.\//, '')}.ts`],
    ...(externalize ? { externalize } : {}),
  };
};

const argsOf = (code: string, storyName: string, ctx = contextOf({ 'entry.ts': code })) => {
  const story = resolveBindingMembers(ctx, storyName);
  const record = resolveArgsRecord(story?.properties.args, ctx);
  return {
    args: Object.fromEntries(
      Object.entries(record.properties).map(([key, node]) => [key, sourceOf(node)])
    ),
    unresolved: [...(story?.unresolved ?? []), ...record.unresolved],
  };
};

describe('spreads inside args', () => {
  it('resolves a spread of a local const object', () => {
    const code = dedent`
      const shared = { primary: true, size: 'large' };
      export const Local = { args: { ...shared, label: 'local' } };
    `;
    expect(argsOf(code, 'Local')).toEqual({
      args: { primary: 'true', size: "'large'", label: "'local'" },
      unresolved: [],
    });
  });

  it("resolves a spread of a sibling story's args", () => {
    const code = dedent`
      export const Base = { args: { label: 'base', primary: true } };
      export const Sibling = { args: { ...Base.args, label: 'sibling' } };
    `;
    expect(argsOf(code, 'Sibling')).toEqual({
      args: { label: "'sibling'", primary: 'true' },
      unresolved: [],
    });
  });

  it('resolves a spread of an imported object', () => {
    const ctx = contextOf({
      'constants.ts': `export const shared = { primary: true, size: 'large' };`,
      'entry.ts': dedent`
        import { shared } from './constants';
        export const Imported = { args: { ...shared, label: 'imported' } };
      `,
    });
    expect(argsOf('', 'Imported', ctx)).toEqual({
      args: { primary: 'true', size: "'large'", label: "'imported'" },
      unresolved: [],
    });
  });

  it("resolves a spread of an imported story's args", () => {
    const ctx = contextOf({
      'other.stories.ts': dedent`
        export default { component: 'x' };
        export const Primary = { args: { label: 'primary', primary: true } };
      `,
      'entry.ts': dedent`
        import { Primary } from './other.stories';
        export const Reuse = { args: { ...Primary.args, label: 'reuse' } };
      `,
    });
    expect(argsOf('', 'Reuse', ctx)).toEqual({
      args: { label: "'reuse'", primary: 'true' },
      unresolved: [],
    });
  });

  it('resolves a spread reached through a namespace import', () => {
    const ctx = contextOf({
      'other.stories.ts': `export const Primary = { args: { label: 'primary' } };`,
      'entry.ts': dedent`
        import * as HeaderStories from './other.stories';
        export const Reuse = { args: { ...HeaderStories.Primary.args, size: 1 } };
      `,
    });
    expect(argsOf('', 'Reuse', ctx)).toEqual({
      args: { label: "'primary'", size: '1' },
      unresolved: [],
    });
  });

  it('follows a re-export to the module that owns the value', () => {
    const ctx = contextOf({
      'constants.ts': `export const shared = { primary: true };`,
      'barrel.ts': `export { shared } from './constants';`,
      'entry.ts': dedent`
        import { shared } from './barrel';
        export const Reuse = { args: { ...shared } };
      `,
    });
    expect(argsOf('', 'Reuse', ctx)).toEqual({ args: { primary: 'true' }, unresolved: [] });
  });

  it('reads an args object the story names instead of writing out', () => {
    const code = dedent`
      const shared = { label: 'shared' };
      export const Named = { args: shared };
    `;
    expect(argsOf(code, 'Named')).toEqual({ args: { label: "'shared'" }, unresolved: [] });
  });

  it('reports an args object it cannot read', () => {
    const code = `export const Named = { args: buildArgs() };`;
    expect(argsOf(code, 'Named')).toEqual({ args: {}, unresolved: ['args: buildArgs()'] });
  });

  it('reports a spread assembled at runtime instead of dropping it', () => {
    const code = dedent`
      export const Runtime = { args: { ...buildArgs(), label: 'runtime' } };
    `;
    expect(argsOf(code, 'Runtime')).toEqual({
      args: { label: "'runtime'" },
      unresolved: ['...buildArgs()'],
    });
  });

  it('reports an object method, whose value only calling it produces', () => {
    const code = dedent`
      export const Method = { args: { label: 'method', count() { return 1; } } };
    `;
    expect(argsOf(code, 'Method')).toEqual({
      args: { label: "'method'" },
      unresolved: ['count() { return 1; }'],
    });
  });

  it('reports a method a spread copies into args', () => {
    const code = dedent`
      const shared = { label: 'shared', count() { return 1; } };
      export const Spread = { args: { ...shared } };
    `;
    expect(argsOf(code, 'Spread')).toEqual({
      args: { label: "'shared'" },
      unresolved: ['count() { return 1; }'],
    });
  });

  it('drops the member an accessor replaces, whose value only running the story produces', () => {
    const code = `export const S = { args: { label: 'plain', get label() { return 'x'; } } };`;
    expect(argsOf(code, 'S')).toEqual({
      args: {},
      unresolved: [`get label() { return 'x'; }`],
    });
  });

  it('reads a spread of an object written out on the spot', () => {
    const code = `export const Inline = { args: { ...{ primary: true }, label: 'inline' } };`;
    expect(argsOf(code, 'Inline')).toEqual({
      args: { primary: 'true', label: "'inline'" },
      unresolved: [],
    });
  });

  it('reads a computed key written as a string literal, which names a static member', () => {
    const code = `export const Computed = { args: { ['label']: 'computed' } };`;
    expect(argsOf(code, 'Computed')).toEqual({ args: { label: "'computed'" }, unresolved: [] });
  });

  it('reports a computed key', () => {
    const code = dedent`
      const key = 'label';
      export const Computed = { args: { [key]: 'computed' } };
    `;
    expect(argsOf(code, 'Computed').unresolved).toEqual(["[key]: 'computed'"]);
  });

  it('reports a spread of a const declared after it runs', () => {
    const code = dedent`
      export const Early = { args: { ...late } };
      const late = { label: 'late' };
    `;
    expect(argsOf(code, 'Early')).toEqual({ args: {}, unresolved: ['...late'] });
  });

  it('applies a mutation that has already run when the spread reads the object', () => {
    const code = dedent`
      const shared = { label: 'shared' };
      shared.label = 'mutated';
      export const Mutated = { args: { ...shared } };
    `;
    expect(argsOf(code, 'Mutated')).toEqual({ args: { label: "'mutated'" }, unresolved: [] });
  });

  it('ignores a mutation that only runs after the spread has copied the object', () => {
    const code = dedent`
      const shared = { label: 'shared' };
      export const Later = { args: { ...shared } };
      shared.label = 'mutated';
    `;
    expect(argsOf(code, 'Later')).toEqual({ args: { label: "'shared'" }, unresolved: [] });
  });

  it('reports a spread of an object something mutates a level deeper', () => {
    const code = dedent`
      const shared = { nested: { label: 'shared' } };
      shared.nested.label = 'mutated';
      export const Mutated = { args: { ...shared } };
    `;
    expect(argsOf(code, 'Mutated')).toEqual({ args: {}, unresolved: ['...shared'] });
  });

  it('stops on a cycle rather than recursing forever', () => {
    const code = dedent`
      export const A = { args: { ...B.args } };
      export const B = { args: { ...A.args } };
    `;
    expect(argsOf(code, 'B').unresolved).toEqual(['...A.args']);
  });

  it('copies nothing when the spread reads a member the object does not have', () => {
    const code = dedent`
      export const Base = { render: () => null };
      export const NoArgs = { args: { ...Base.args, label: 'only' } };
    `;
    expect(argsOf(code, 'NoArgs')).toEqual({ args: { label: "'only'" }, unresolved: [] });
  });
});

describe('spreads at the story config level', () => {
  it('inherits args a config-level spread copies', () => {
    const code = dedent`
      export const Base = { args: { label: 'base', primary: true } };
      export const InheritAll = { ...Base };
    `;
    expect(argsOf(code, 'InheritAll')).toEqual({
      args: { label: "'base'", primary: 'true' },
      unresolved: [],
    });
  });

  it('lets an explicit args property replace the one the spread copied', () => {
    const code = dedent`
      export const Base = { args: { label: 'base', primary: true } };
      export const Extends = { ...Base, args: { label: 'extends' } };
    `;
    expect(argsOf(code, 'Extends')).toEqual({ args: { label: "'extends'" }, unresolved: [] });
  });

  it('resolves the CSF2 assignment form', () => {
    const code = dedent`
      export const Assigned = () => null;
      Assigned.args = { label: 'assigned' };
    `;
    expect(argsOf(code, 'Assigned')).toEqual({ args: { label: "'assigned'" }, unresolved: [] });
  });

  it('resolves the CSF2 assignment form on a function declaration', () => {
    const code = dedent`
      export function Assigned() { return null; }
      Assigned.args = { label: 'assigned' };
    `;
    expect(argsOf(code, 'Assigned')).toEqual({ args: { label: "'assigned'" }, unresolved: [] });
  });

  it('prefers an assignment over the args the declaration carries', () => {
    const code = dedent`
      export const Both = { args: { label: 'declared' } };
      Both.args = { label: 'assigned' };
    `;
    expect(argsOf(code, 'Both')).toEqual({ args: { label: "'assigned'" }, unresolved: [] });
  });

  it('reports the assignment when one reaches inside the args object', () => {
    const code = dedent`
      export const Deep = { args: { label: 'declared' } };
      Deep.args.label = 'mutated';
    `;
    expect(resolveBindingMembers(contextOf({ 'entry.ts': code }), 'Deep')?.unresolved).toEqual([
      "Deep.args.label = 'mutated'",
    ]);
  });
});

describe('write order', () => {
  it('marks a member written before an unreadable spread as shadowed', () => {
    const code = dedent`
      declare function makeBase(): object;
      export const S = { template: 'own', ...makeBase() };
    `;
    const members = resolveBindingMembers(contextOf({ 'entry.ts': code }), 'S');
    expect(members?.shadowed).toEqual(['template']);
    expect(members?.unresolved).toEqual(['...makeBase()']);
  });

  it('trusts a member written after the unreadable spread', () => {
    const code = dedent`
      declare function makeBase(): object;
      export const S = { ...makeBase(), template: 'own' };
    `;
    const members = resolveBindingMembers(contextOf({ 'entry.ts': code }), 'S');
    expect(members?.shadowed).toEqual([]);
    expect(members?.unresolved).toEqual(['...makeBase()']);
  });

  it('unshadows a member a readable spread writes again', () => {
    const code = dedent`
      declare function makeBase(): object;
      const base = { template: 'base' };
      export const S = { template: 'own', ...makeBase(), ...base };
    `;
    const members = resolveBindingMembers(contextOf({ 'entry.ts': code }), 'S');
    expect(members?.shadowed).toEqual([]);
    expect(members?.properties.template).toBeDefined();
  });
});

describe('story initializers', () => {
  it('reports opaque calls while retaining members assigned after the call', () => {
    const code = dedent`
      export const Built = makeStory();
      Built.args = { label: 'assigned' };
    `;

    expect(argsOf(code, 'Built')).toMatchInlineSnapshot(`
      {
        "args": {
          "label": "'assigned'",
        },
        "unresolved": [
          "makeStory()",
        ],
      }
    `);
  });

  it('reports a factory call whose named config cannot be inspected', () => {
    const code = dedent`
      const CONFIG = getConfig();
      export const Named = meta.story(CONFIG);
    `;

    expect(argsOf(code, 'Named')).toMatchInlineSnapshot(`
      {
        "args": {},
        "unresolved": [
          "meta.story(CONFIG)",
        ],
      }
    `);
  });

  it('reports every opaque initializer shape while retaining later assignments', () => {
    const code = dedent`
      export const Optional = makeStory?.();
      Optional.args = { label: 'optional' };
      export const Constructed = new StoryBuilder();
      Constructed.args = { label: 'constructed' };
      export const Conditional = usePrimary ? makePrimary() : makeSecondary();
      Conditional.args = { label: 'conditional' };
      export const Awaited = await makeStory();
      Awaited.args = { label: 'awaited' };
    `;

    expect({
      optional: argsOf(code, 'Optional'),
      constructed: argsOf(code, 'Constructed'),
      conditional: argsOf(code, 'Conditional'),
      awaited: argsOf(code, 'Awaited'),
    }).toMatchInlineSnapshot(`
      {
        "awaited": {
          "args": {
            "label": "'awaited'",
          },
          "unresolved": [
            "await makeStory()",
          ],
        },
        "conditional": {
          "args": {
            "label": "'conditional'",
          },
          "unresolved": [
            "usePrimary ? makePrimary() : makeSecondary()",
          ],
        },
        "constructed": {
          "args": {
            "label": "'constructed'",
          },
          "unresolved": [
            "new StoryBuilder()",
          ],
        },
        "optional": {
          "args": {
            "label": "'optional'",
          },
          "unresolved": [
            "makeStory?.()",
          ],
        },
      }
    `);
  });

  it('keeps canonical bind stories readable without exempting bind calls with config', () => {
    const code = dedent`
      const Template = (args) => args;
      export const EmptyObject = Template.bind({});
      EmptyObject.args = { label: 'empty object' };
      export const NoArgument = Template.bind();
      NoArgument.args = { label: 'no argument' };
      export const Configured = Template.bind({ role: 'button' });
    `;

    expect({
      emptyObject: argsOf(code, 'EmptyObject'),
      noArgument: argsOf(code, 'NoArgument'),
      configured: argsOf(code, 'Configured'),
    }).toMatchInlineSnapshot(`
      {
        "configured": {
          "args": {},
          "unresolved": [
            "Template.bind({ role: 'button' })",
          ],
        },
        "emptyObject": {
          "args": {
            "label": "'empty object'",
          },
          "unresolved": [],
        },
        "noArgument": {
          "args": {
            "label": "'no argument'",
          },
          "unresolved": [],
        },
      }
    `);
  });

  it('keeps function stories and inline factory configs readable', () => {
    const code = dedent`
      export const Arrow = (args) => args;
      Arrow.args = { label: 'arrow' };
      export function Declared(args) { return args; }
      Declared.args = { label: 'declared' };
      export const Inline = meta.story({ args: { label: 'inline' } });
      export const Extended = Inline.extend({ args: { size: 'large' } });
    `;

    expect({
      arrow: argsOf(code, 'Arrow'),
      declared: argsOf(code, 'Declared'),
      inline: argsOf(code, 'Inline'),
      extended: argsOf(code, 'Extended'),
    }).toMatchInlineSnapshot(`
      {
        "arrow": {
          "args": {
            "label": "'arrow'",
          },
          "unresolved": [],
        },
        "declared": {
          "args": {
            "label": "'declared'",
          },
          "unresolved": [],
        },
        "extended": {
          "args": {
            "label": "'inline'",
            "size": "'large'",
          },
          "unresolved": [],
        },
        "inline": {
          "args": {
            "label": "'inline'",
          },
          "unresolved": [],
        },
      }
    `);
  });
});

describe('CSF factories', () => {
  it("resolves a spread of a factory story's args", () => {
    const code = dedent`
      import preview from './preview';
      const meta = preview.meta({ component: Button });
      export const Base = meta.story({ args: { label: 'base', primary: true } });
      export const Sibling = meta.story({ args: { ...Base.input.args, label: 'sibling' } });
    `;
    expect(argsOf(code, 'Sibling')).toEqual({
      args: { label: "'sibling'", primary: 'true' },
      unresolved: [],
    });
  });

  it('keeps the parent args an extend call does not name, the way composition does', () => {
    const code = dedent`
      import preview from './preview';
      const meta = preview.meta({ component: Button });
      export const Base = meta.story({ args: { label: 'base', primary: true } });
      export const Extended = Base.extend({ args: { label: 'extended' } });
    `;
    expect(argsOf(code, 'Extended')).toEqual({
      args: { label: "'extended'", primary: 'true' },
      unresolved: [],
    });
  });

  it('reports a bare spread of a factory story, which copies its methods and not its config', () => {
    const code = dedent`
      import preview from './preview';
      const meta = preview.meta({ component: Button });
      export const Base = meta.story({ args: { label: 'base' } });
      export const Bare = meta.story({ args: { ...Base } });
    `;
    expect(argsOf(code, 'Bare')).toEqual({ args: {}, unresolved: ['...Base'] });
  });

  // A parent from another module would carry values whose names resolve in that module, not here,
  // so it must be reported rather than mixed in as if it were local.
  it('rejects an extend call whose parent another module owns', () => {
    const ctx = contextOf({
      'other.stories.ts': dedent`
        import preview from './preview';
        const REMOTE_LABEL = 'remote';
        const meta = preview.meta({ component: 'x' });
        export const Base = meta.story({ args: { label: REMOTE_LABEL } });
      `,
      'entry.ts': dedent`
        import { Base } from './other.stories';
        export const Ext = Base.extend({ args: { size: 'lg' } });
      `,
    });
    expect(resolveBindingMembers(ctx, 'Ext')).toBeUndefined();
  });
});

describe('externalize', () => {
  it('rejects a value another module owns when the caller cannot print it', () => {
    const ctx = contextOf(
      {
        'constants.ts': dedent`
          const SIZE = 'large';
          export const shared = { size: SIZE };
        `,
        'entry.ts': dedent`
          import { shared } from './constants';
          export const Reuse = { args: { ...shared } };
        `,
      },
      'entry.ts',
      (node) => (t.isStringLiteral(node) ? node : undefined)
    );
    expect(argsOf('', 'Reuse', ctx)).toEqual({ args: {}, unresolved: ['...shared'] });
  });
});

describe('resolveReferencedValue', () => {
  const valueOf = (ctx: ReferenceContext, expression: string) => {
    const node = (
      babelParseFile({ code: `(${expression})`, filename: 'probe.ts' }).ast.program
        .body[0] as t.ExpressionStatement
    ).expression;
    const resolved = resolveReferencedValue(ctx, node);
    return resolved && { value: sourceOf(resolved.node), filePath: resolved.ctx.filePath };
  };

  it('reads a member of a local object', () => {
    const ctx = contextOf({
      'entry.ts': dedent`
        import { Button } from './button';
        const config = { component: Button };
      `,
    });
    expect(valueOf(ctx, 'config.component')).toEqual({ value: 'Button', filePath: 'entry.ts' });
  });

  it('reads a member of an export reached through a namespace import', () => {
    const ctx = contextOf({
      'internal.ts': dedent`
        import { Button } from './button';
        export const config = { component: Button };
      `,
      'entry.ts': dedent`
        import * as internal from './internal';
      `,
    });
    expect(valueOf(ctx, 'internal.config.component')).toEqual({
      value: 'Button',
      filePath: 'internal.ts',
    });
  });

  it('absorbs a spread on the way to the member', () => {
    const ctx = contextOf({
      'internal.ts': dedent`
        import { Button } from './button';
        const base = { component: Button };
        export const config = { ...base, args: {} };
      `,
      'entry.ts': dedent`
        import * as internal from './internal';
      `,
    });
    expect(valueOf(ctx, 'internal.config.component')).toEqual({
      value: 'Button',
      filePath: 'internal.ts',
    });
  });

  it('reads nothing from a bare identifier, which names no member', () => {
    const ctx = contextOf({ 'entry.ts': `const config = { component: 1 };` });
    expect(valueOf(ctx, 'config')).toBeUndefined();
  });

  it('reads nothing when the module the namespace names cannot be reached', () => {
    const ctx = contextOf({ 'entry.ts': `import * as internal from './nowhere';` });
    expect(valueOf(ctx, 'internal.config.component')).toBeUndefined();
  });

  it('reads nothing for a member the object does not have', () => {
    const ctx = contextOf({ 'entry.ts': `const config = { args: {} };` });
    expect(valueOf(ctx, 'config.component')).toBeUndefined();
  });

  describe('spread scope', () => {
    // A spread copies the value node as written in the module that owns it, and this pass reads it
    // in the module the chain lands in. Callers that care which module a name resolves against pass
    // an `externalize` that refuses a value carrying free names once it crosses a module boundary,
    // rather than resolving it in the wrong scope.
    it('refuses a spread-copied member carrying free names when the caller externalizes', () => {
      // `internal` spreads `base` (owned by `shared`), and separately binds the identical local
      // name `Button` to an unrelated class. Reading the copied `Button` against `internal`'s own
      // imports would silently land on the wrong one.
      const files = {
        'real-button.ts': `export class Button {}`,
        'other-button.ts': `export class Button {}`,
        'shared.ts': dedent`
          import { Button } from './real-button';
          export const base = { component: Button };
        `,
        'internal.ts': dedent`
          import { Button } from './other-button';
          import { base } from './shared';
          export const config = { ...base, args: {} };
        `,
        'entry.ts': `import * as internal from './internal';`,
      };

      const guarded = contextOf(files, 'entry.ts', (node) =>
        isSelfContained(node) ? node : undefined
      );

      expect(valueOf(guarded, 'internal.config.component')).toBeUndefined();
    });
  });

  describe('a member beside an unresolvable spread', () => {
    it('resolves a member written after an unresolvable spread', () => {
      const ctx = contextOf({
        'entry.ts': dedent`
          declare function makeBase(): object;
          const config = { ...makeBase(), component: 1 };
        `,
      });
      expect(valueOf(ctx, 'config.component')).toEqual({ value: '1', filePath: 'entry.ts' });
    });

    it('leaves a member unresolved when an unresolvable spread runs after it', () => {
      const ctx = contextOf({
        'entry.ts': dedent`
          declare function makeBase(): object;
          const config = { component: 1, ...makeBase() };
        `,
      });
      expect(valueOf(ctx, 'config.component')).toBeUndefined();
    });

    it('resolves through an intermediate object whose relevant key follows an unresolvable spread', () => {
      const ctx = contextOf({
        'entry.ts': dedent`
          declare function makeBase(): object;
          const config = { ...makeBase(), nested: { component: 1 } };
        `,
      });
      expect(valueOf(ctx, 'config.nested.component')).toEqual({
        value: '1',
        filePath: 'entry.ts',
      });
    });

    it('does not descend through an intermediate object whose relevant key an unresolvable spread may shadow', () => {
      const ctx = contextOf({
        'entry.ts': dedent`
          declare function makeBase(): object;
          const config = { nested: { component: 1 }, ...makeBase() };
        `,
      });
      expect(valueOf(ctx, 'config.nested.component')).toBeUndefined();
    });
  });

  it('terminates instead of recursing forever on a self-referential module', () => {
    const ctx = contextOf({
      'entry.ts': `export const config = { nested: { ...config } };`,
    });
    expect(valueOf(ctx, 'config.nested.component')).toBeUndefined();
  });
});
