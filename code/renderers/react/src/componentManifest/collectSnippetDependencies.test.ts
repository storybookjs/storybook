import { expect, test } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { getCodeSnippet, printSnippet } from './generateCodeSnippet.ts';

function snippetFor(body: string) {
  const code = dedent`
    import { Button } from './Button';

    const meta = { component: Button };
    export default meta;

    ${body}
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();
  const name = Object.keys(csf._storyExports)[0];
  const snippet = getCodeSnippet(csf, name, csf._meta?.component);

  return {
    code: printSnippet(snippet),
    imports: snippet.imports.map((ref) => `${ref.importName} from ${ref.importId}`),
  };
}

test('emits a local wrapper component the story renders', () => {
  expect(
    snippetFor(dedent`
      const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
      export const Test = () => <ButtonWrapper label="foo" />;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
    const Test = () => <ButtonWrapper label="foo" />;",
      "imports": [
        "Button from ./Button",
      ],
    }
  `);
});

test('emits a transitive local chain in source order', () => {
  expect(
    snippetFor(dedent`
      const spacing = 8;
      const ButtonWrapper = ({ label }) => <Button style={{ margin: spacing }}>{label}</Button>;
      export const Test = () => <ButtonWrapper label="foo" />;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const spacing = 8;
    const ButtonWrapper = ({ label }) => <Button style={{ margin: spacing }}>{label}</Button>;
    const Test = () => <ButtonWrapper label="foo" />;",
      "imports": [
        "Button from ./Button",
      ],
    }
  `);
});

test('leaves out a module-scope name a helper parameter shadows', () => {
  expect(
    snippetFor(dedent`
      const label = 'shadowed';
      const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
      export const Test = () => <ButtonWrapper label="foo" />;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
    const Test = () => <ButtonWrapper label="foo" />;",
      "imports": [
        "Button from ./Button",
      ],
    }
  `);
});

test('imports a non-component name rather than inlining source for it', () => {
  expect(
    snippetFor(dedent`
      import { spec } from './specs';
      export const Test = () => <Button>{spec.title}</Button>;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const Test = () => <Button>{spec.title}</Button>;",
      "imports": [
        "Button from ./Button",
        "spec from ./specs",
      ],
    }
  `);
});

test('skips globals and intrinsic elements', () => {
  expect(
    snippetFor(dedent`
      export const Test = () => <div>{Math.max(1, document.title.length)}</div>;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const Test = () => <div>{Math.max(1, document.title.length)}</div>;",
      "imports": [],
    }
  `);
});

test('emits each declaration once when two of them reference each other', () => {
  expect(
    snippetFor(dedent`
      const first = () => second();
      const second = () => first();
      export const Test = () => <Button>{first()}</Button>;
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const first = () => second();
    const second = () => first();
    const Test = () => <Button>{first()}</Button>;",
      "imports": [
        "Button from ./Button",
      ],
    }
  `);
});

test('emits nothing extra for a story that references nothing outside itself', () => {
  expect(
    snippetFor(dedent`
      export const Test = { args: { label: 'x' } };
    `)
  ).toMatchInlineSnapshot(`
    {
      "code": "const Test = () => <Button label="x" />;",
      "imports": [
        "Button from ./Button",
      ],
    }
  `);
});

test('strips the export keyword from a helper the story file also exports', () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = { component: Button, includeStories: ['Test'] };
    export default meta;

    export const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
    export const Test = () => <ButtonWrapper label="foo" />;
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();
  const snippet = getCodeSnippet(csf, 'Test', csf._meta?.component);

  expect(printSnippet(snippet)).toMatchInlineSnapshot(`
      "const ButtonWrapper = ({ label }) => <Button>{label}</Button>;
      const Test = () => <ButtonWrapper label="foo" />;"
    `);
});

test('emits a component declared in the story file instead of importing it', () => {
  const code = dedent`
    const Card = ({ label }: { label: string }) => <section>{label}</section>;

    const meta = { component: Card };
    export default meta;

    export const Test = { args: { label: 'x' } };
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();
  const snippet = getCodeSnippet(csf, 'Test', csf._meta?.component);

  expect({
    code: printSnippet(snippet),
    imports: snippet.imports.map((ref) => `${ref.importName} from ${ref.importId}`),
  }).toMatchInlineSnapshot(`
    {
      "code": "const Card = ({ label }: { label: string }) => <section>{label}</section>;

    const Test = () => <Card label="x" />;",
      "imports": [],
    }
  `);
});

test('drops the incomplete-snippet warning for a name the snippet now declares', () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = { component: Button };
    export default meta;

    const spacing = 8;
    export const Test = { args: { style: { margin: spacing } } };
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();
  const snippet = getCodeSnippet(csf, 'Test', csf._meta?.component);

  expect(printSnippet(snippet)).toMatchInlineSnapshot(`
    "const spacing = 8;
    const Test = () => <Button style={{ margin: spacing }} />;"
  `);
  expect(snippet.unresolved).toEqual([]);
});

test('keeps a warning for a spread it still cannot read', () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = { component: Button };
    export default meta;

    export const Test = { args: { ...buildArgs() } };
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();

  expect(getCodeSnippet(csf, 'Test', csf._meta?.component).unresolved).toEqual(['...buildArgs()']);
});

test('leaves a sibling story config out of the snippet', () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = { component: Button };
    export default meta;

    export const Base = { args: { label: 'x' } };
    export const Test = () => <Button {...Base.args} />;
  `;
  const csf = loadCsf(code, { makeTitle: () => 'title' }).parse();

  expect(printSnippet(getCodeSnippet(csf, 'Test', csf._meta?.component))).toMatchInlineSnapshot(
    `"const Test = () => <Button {...Base.args} />;"`
  );
});

test('narrows a multi-declarator statement to the name the snippet asked for', () => {
  expect(
    snippetFor(dedent`
      const gap = 4, unrelated = sideEffect();
      export const Test = () => <Button style={{ gap }} />;
    `).code
  ).toMatchInlineSnapshot(`
    "const gap = 4;
    const Test = () => <Button style={{ gap }} />;"
  `);
});
