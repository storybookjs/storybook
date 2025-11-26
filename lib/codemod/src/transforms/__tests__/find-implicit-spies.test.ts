import { beforeEach, expect, test, vi } from 'vitest';

import ansiRegex from 'ansi-regex';
import { dedent } from 'ts-dedent';

import transform from '../find-implicit-spies';

expect.addSnapshotSerializer({
  print: (val, print) => print((val as string).replace(ansiRegex(), '')),
  test: (value) => typeof value === 'string' && ansiRegex().test(value),
});

const tsTransform = async (source: string) => transform({ source, path: 'Component.stories.tsx' });

const warn = vi.spyOn(console, 'warn');

beforeEach(() => {
  warn.mockImplementation(() => {});
});

test('Warn for possible implicit actions', async () => {
  const input = dedent`
    export default { title: 'foo/bar', args: {onClick: fn() }, argTypes: { onHover: {action: true} } };
    const Template = (args) => { };
    export const A = Template.bind({});
    A.args = { onBla: fn() };
    A.play = async ({ args }) => {
      await userEvent.click(screen.getByRole("button"));
      await expect(args.onImplicit).toHaveBeenCalled();
      await expect(args.onClick).toHaveBeenCalled();
      await expect(args.onHover).toHaveBeenCalled();
      await expect(args.onBla).toHaveBeenCalled();
    };
    
    export const B = { 
      args: {onBla: fn() },
      play: async ({ args }) => {
        await userEvent.click(screen.getByRole("button"));
        await expect(args.onImplicit).toHaveBeenCalled();
        await expect(args.onClick).toHaveBeenCalled();
        await expect(args.onHover).toHaveBeenCalled();
        await expect(args.onBla).toHaveBeenCalled();
      }
    };
  `;

  await tsTransform(input);

  expect(warn.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "Component.stories.tsx Possible implicit spy found
       5 | A.play = async ({ args }) => {
       6 |   await userEvent.click(screen.getByRole("button"));
    >  7 |   await expect(args.onImplicit).toHaveBeenCalled();
         |                     ^^^^^^^^^^
       8 |   await expect(args.onClick).toHaveBeenCalled();
       9 |   await expect(args.onHover).toHaveBeenCalled();
      10 |   await expect(args.onBla).toHaveBeenCalled();",
      ],
      [
        "Component.stories.tsx Possible implicit spy found
      15 |   play: async ({ args }) => {
      16 |     await userEvent.click(screen.getByRole("button"));
    > 17 |     await expect(args.onImplicit).toHaveBeenCalled();
         |                       ^^^^^^^^^^
      18 |     await expect(args.onClick).toHaveBeenCalled();
      19 |     await expect(args.onHover).toHaveBeenCalled();
      20 |     await expect(args.onBla).toHaveBeenCalled();",
      ],
    ]
  `);
});
