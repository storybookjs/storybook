import { describe, expect, it } from 'vitest';

import ts from 'typescript';

import {
  getDeclaredLiterals,
  orderPropertiesByDeclaration,
  orderUnionMembers,
  printUnionMembers,
} from './declaration-order.ts';

const compile = (source: string) => {
  const host = ts.createCompilerHost({});
  const readSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion) =>
    name === 'probe.ts'
      ? ts.createSourceFile(name, source, languageVersion, true)
      : readSourceFile(name, languageVersion);
  const program = ts.createProgram(
    ['probe.ts'],
    { target: ts.ScriptTarget.ESNext, strict: true },
    host
  );
  const checker = program.getTypeChecker();
  const file = program.getSourceFile('probe.ts')!;
  for (const statement of file.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text.startsWith('Warmup')) {
      checker.getTypeAtLocation(statement.name);
    }
  }
  const props = file.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === 'Props'
  )!;
  return { checker, props };
};

const order = (source: string, name: string) => {
  const { checker, props } = compile(source);
  const member = props.members.find(
    (candidate): candidate is ts.PropertySignature =>
      ts.isPropertySignature(candidate) && candidate.name.getText() === name
  )!;
  const type = checker.getTypeAtLocation(member);
  const members = type.isUnion() ? type.types : [type];
  const ordered = orderUnionMembers(ts, members, getDeclaredLiterals(ts, checker, member.type!));
  return {
    before: checker.typeToString(type),
    after: printUnionMembers(ts, ordered, checker.typeToString(type), (part) =>
      checker.typeToString(part)
    ),
    members: ordered.map((part) => checker.typeToString(part)),
  };
};

describe('union members in declaration order', () => {
  it('follows the declaration, whatever the checker met first', () => {
    expect(
      order(
        `type WarmupSizes = 'lg' | 'md' | 'sm';
        interface Props { size: 'sm' | 'md' | 'lg' }`,
        'size'
      )
    ).toEqual({
      before: '"lg" | "md" | "sm"',
      after: '"sm" | "md" | "lg"',
      members: ['"sm"', '"md"', '"lg"'],
    });
  });

  it('follows aliases, parentheses and negative numbers', () => {
    const source = `type WarmupSizes = 'xl' | 'lg' | 'sm';
      type Size = 'sm' | 'lg';
      interface Props { size: (Size) | 'xl'; offset: 2 | -1 | 0 }`;

    expect(order(source, 'size').members).toEqual(['"sm"', '"lg"', '"xl"']);
    expect(order(source, 'offset').members).toEqual(['2', '-1', '0']);
  });

  it('follows the properties `keyof` reads', () => {
    expect(
      order(
        `type WarmupKeys = 'lg' | 'sm' | 2;
        const sizes = { sm: 1, lg: 2, 2: 3 } as const;
        interface Props { size: keyof typeof sizes }`,
        'size'
      ).members
    ).toEqual(['"sm"', '"lg"', '2']);
  });

  it('follows the elements of a tuple and the values of an object', () => {
    const source = `type WarmupSizes = 'lg' | 'sm' | 'md' | 'loud' | 'quiet';
      const sizes = ['md', 'sm', 'lg'] as const;
      const tones = { calm: 'quiet', alarm: 'loud' } as const;
      interface Props {
        size: (typeof sizes)[number];
        tone: (typeof tones)[keyof typeof tones];
      }`;

    expect(order(source, 'size').members).toEqual(['"md"', '"sm"', '"lg"']);
    expect(order(source, 'tone').members).toEqual(['"quiet"', '"loud"']);
  });

  it('follows the declared type of the property an indexed access reads', () => {
    const source = `type WarmupSizes = 'lg' | 'md' | 'sm';
      interface Theme { fallback: 'lg'; size: 'sm' | 'md' | 'lg'; tone: 'md' }
      interface Props { size: Theme['size']; either: Theme['tone' | 'fallback'] }`;

    expect(order(source, 'size').members).toEqual(['"sm"', '"md"', '"lg"']);
    expect(order(source, 'either').members).toEqual(['"md"', '"lg"']);
  });

  it('builds the members of a template literal in the order it spells them out', () => {
    expect(
      order(
        `type WarmupPlacements = 'bottom-end' | 'top-start';
        type Side = 'top' | 'bottom';
        interface Props { placement: Side | \`\${Side}-\${'start' | 'end'}\` }`,
        'placement'
      ).members
    ).toEqual(['"top"', '"bottom"', '"top-start"', '"top-end"', '"bottom-start"', '"bottom-end"']);
  });

  it('follows the type arguments of a utility type', () => {
    expect(
      order(
        `type WarmupSizes = 'lg' | 'md' | 'sm';
        type Size = 'sm' | 'md' | 'lg' | 'xl';
        interface Props { size: Exclude<Size, 'xl'> }`,
        'size'
      ).members
    ).toEqual(['"sm"', '"md"', '"lg"']);
  });

  it('follows the enum members a declaration names', () => {
    expect(
      order(
        `enum Tone { Warn = 'warn', Info = 'info', Error = 'error' }
        interface Props { tone: Tone.Info | Tone.Warn }`,
        'tone'
      )
    ).toEqual({
      before: 'Tone.Warn | Tone.Info',
      after: 'Tone.Info | Tone.Warn',
      members: ['Tone.Info', 'Tone.Warn'],
    });
  });

  it('keeps the checker order of members its declaration does not list', () => {
    const { before, members } = order(
      `type WarmupLetters = 'B' | 'A' | 'C';
      interface Props { letter: Uppercase<'c' | 'a' | 'b'> }`,
      'letter'
    );

    expect(members.join(' | ')).toBe(before);
  });

  it('leaves a union that is not only literals alone', () => {
    expect(
      order(
        `type WarmupSizes = 'lg' | 'sm';
        interface Props { size: 'sm' | 'lg' | number }`,
        'size'
      ).members
    ).toEqual(['number', '"lg"', '"sm"']);
  });

  it('keeps null and undefined at the end of the printed union', () => {
    expect(
      order(
        `type WarmupSizes = 'lg' | 'sm';
        interface Props { size?: 'sm' | 'lg' | null }`,
        'size'
      )
    ).toMatchObject({
      before: '"lg" | "sm" | null | undefined',
      after: '"sm" | "lg" | null | undefined',
    });
  });

  it('keeps text that names the whole union', () => {
    const { checker, props } = compile(`type WarmupLevels = 'b' | 'a';
      type Level = 'a' | 'b';
      interface Props { level: Level }`);
    const member = props.members[0] as ts.PropertySignature;
    const type = checker.getTypeAtLocation(member) as ts.UnionType;
    const ordered = orderUnionMembers(
      ts,
      type.types,
      getDeclaredLiterals(ts, checker, member.type!)
    );

    expect(printUnionMembers(ts, ordered, 'Level', (part) => checker.typeToString(part))).toBe(
      'Level'
    );
  });

  it('moves the alias a union names to the place of its members', () => {
    expect(
      order(
        `type WarmupPlacements = 'bottom-end' | 'top-start';
        type Side = 'top' | 'bottom';
        interface Props { placement: Side | \`\${Side}-\${'start' | 'end'}\` }`,
        'placement'
      )
    ).toEqual({
      before: '"bottom-end" | "top-start" | Side | "top-end" | "bottom-start"',
      after: 'Side | "top-start" | "top-end" | "bottom-start" | "bottom-end"',
      members: ['"top"', '"bottom"', '"top-start"', '"top-end"', '"bottom-start"', '"bottom-end"'],
    });
  });

  it('places the members of an enum where the declaration names it', () => {
    expect(
      order(
        `type WarmupTones = 'custom';
        enum Tone { Warn = 'warn', Info = 'info' }
        interface Props { tone: Tone | 'custom' }`,
        'tone'
      )
    ).toEqual({
      before: '"custom" | Tone',
      after: 'Tone | "custom"',
      members: ['Tone.Warn', 'Tone.Info', '"custom"'],
    });
    expect(
      order(
        `type WarmupTones = 'custom';
        enum Tone { Warn = 'warn', Info = 'info' }
        interface Props { level: Tone.Info | 'custom' | Tone.Warn }`,
        'level'
      )
    ).toEqual({
      before: '"custom" | Tone',
      after: 'Tone | "custom"',
      members: ['Tone.Info', '"custom"', 'Tone.Warn'],
    });
  });

  it('keeps the text of a union that names more than one alias', () => {
    const { before, after } = order(
      `type WarmupSizes = 'lg' | 'sm';
      type Small = 'xs' | 'sm';
      type Large = 'lg' | 'xl';
      interface Props { size: Small | Large }`,
      'size'
    );

    expect(after).toBe(before);
  });
});

describe('orderPropertiesByDeclaration', () => {
  it('lists props declared together in source order and keeps the order of their groups', () => {
    const { checker, props } = compile(`type WarmupKeys = 'gamma' | 'alpha' | 'beta';
      interface Base { alpha: string; beta: string; gamma: string; delta: string }
      type Picked = Omit<Base, 'delta'> & { own: string };
      interface Props { picked: Picked }`);
    const picked = checker.getTypeAtLocation(props.members[0]);

    expect(picked.getProperties().map((property) => property.getName())).toEqual([
      'gamma',
      'alpha',
      'beta',
      'own',
    ]);
    expect(
      orderPropertiesByDeclaration(picked.getProperties()).map((property) => property.getName())
    ).toEqual(['alpha', 'beta', 'gamma', 'own']);
  });

  it.fails('lists props declared in different places in the same order, whatever the checker met first', () => {
    const names = (warmup: string) => {
      const { checker, props } = compile(`${warmup}
        interface Base { alpha: string; beta: string }
        interface Derived extends Base { gamma: string; delta: string }
        interface Props { picked: Pick<Derived, 'alpha' | 'gamma'> }`);
      return orderPropertiesByDeclaration(
        checker.getTypeAtLocation(props.members[0]).getProperties()
      ).map((property) => property.getName());
    };

    expect(names(`type WarmupKeys = 'gamma' | 'alpha';`)).toEqual(names(''));
  });
});
