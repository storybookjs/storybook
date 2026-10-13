import { beforeEach, expect, test, vi } from 'vitest';

import ansiRegex from 'ansi-regex';
import { dedent } from 'ts-dedent';

import transform from '../find-implicit-spies.ts';

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
        "Component.stories.tsx Possible implicit spy found (7:20)",
      ],
      [
        "Component.stories.tsx Possible implicit spy found (17:22)",
      ],
    ]
  `);
});
