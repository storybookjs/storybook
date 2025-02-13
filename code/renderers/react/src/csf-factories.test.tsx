// @vitest-environment happy-dom
// this file tests Typescript types that's why there are no assertions
import { describe, it } from 'vitest';
import { expect, test } from 'vitest';

import type { KeyboardEventHandler, ReactElement, ReactNode } from 'react';
import React from 'react';

import type { Canvas } from 'storybook/internal/csf';
import type { Args, StrictArgs } from 'storybook/internal/types';

import type { Mock } from '@storybook/test';
import { fn } from '@storybook/test';

import { expectTypeOf } from 'expect-type';

import { definePreview } from './preview';
import type { Decorator } from './public-types';

type ButtonProps = { label: string; disabled: boolean };
const Button: (props: ButtonProps) => ReactElement = () => <></>;

const preview = definePreview({});

test('csf factories', () => {
  const config = definePreview({
    addons: [
      {
        decorators: [],
      },
    ],
  });

  const meta = config.meta({ component: Button, args: { disabled: true } });

  const MyStory = meta.story({
    args: {
      label: 'Hello world',
    },
  });

  expect(MyStory.input.args?.label).toBe('Hello world');
});

describe('Args can be provided in multiple ways', () => {
  it('✅ All required args may be provided in meta', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good', disabled: false },
    });

    const Basic = meta.story({});
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good' },
    });
    const Basic = meta.story({
      args: { disabled: false },
    });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.meta({ component: Button });
      const Basic = meta.story({
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      });
    }
    {
      const meta = preview.meta({
        component: Button,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({});
    }
    {
      const meta = preview.meta({ component: Button });
      const Basic = meta.story({
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      });
    }
  });
});

it('✅ Void functions are not changed', () => {
  interface CmpProps {
    label: string;
    disabled: boolean;
    onClick(): void;
    onKeyDown: KeyboardEventHandler;
    onLoading: (s: string) => ReactElement;
    submitAction(): void;
  }

  const Cmp: (props: CmpProps) => ReactElement = () => <></>;

  const meta = preview.meta({
    component: Cmp,
    args: { label: 'good' },
  });

  const Basic = meta.story({
    args: {
      disabled: false,
      onLoading: () => <div>Loading...</div>,
      onKeyDown: fn(),
      onClick: fn(),
      submitAction: fn(),
    },
  });
});

type ThemeData = 'light' | 'dark';
declare const Theme: (props: { theme: ThemeData; children?: ReactNode }) => ReactElement;

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      render: (args: ButtonProps & { theme: ThemeData }, { component }) => {
        // component is not null as it is provided in meta

        const Component = component!;
        return (
          <Theme theme={args.theme}>
            <Component {...args} />
          </Theme>
        );
      },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (Story, { args }) => (
    <>
      Decorator: {args.decoratorArg}
      <Story args={{ decoratorArg: 0 }} />
    </>
  );

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 0, label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ButtonProps & { decoratorArg: number; decoratorArg2: string };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (Story, { args }) => (
      <>
        Decorator: {args.decoratorArg2}
        <Story />
      </>
    );

    // decorator is not using args
    const thirdDecorator: Decorator<Args> = (Story) => (
      <>
        <Story />
      </>
    );

    // decorator is not using args
    const fourthDecorator: Decorator<StrictArgs> = (Story) => (
      <>
        <Story />
      </>
    );

    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator, thirdDecorator, fourthDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: 0, decoratorArg2: '', label: 'good' },
    });
  });
});

it('Components without Props can be used, issue #21768', () => {
  const Component = () => <>Foo</>;
  const withDecorator: Decorator = (Story) => (
    <>
      <Story />
    </>
  );

  const meta = preview.meta({
    component: Component,
    decorators: [withDecorator],
  });

  const Basic = meta.story({});
});

it('Meta is broken when using discriminating types, issue #23629', () => {
  type TestButtonProps = {
    text: string;
  } & (
    | {
        id?: string;
        onClick?: (e: unknown, id: string | undefined) => void;
      }
    | {
        id: string;
        onClick: (e: unknown, id: string) => void;
      }
  );
  const TestButton: React.FC<TestButtonProps> = ({ text }) => {
    return <p>{text}</p>;
  };

  preview.meta({
    title: 'Components/Button',
    component: TestButton,
    args: {
      text: 'Button',
    },
  });
});

it('Infer mock function given to args in meta.', () => {
  type Props = { label: string; onClick: () => void; onRender: () => JSX.Element };
  const TestButton = (props: Props) => <></>;

  const meta = preview.meta({
    component: TestButton,
    args: { label: 'label', onClick: fn(), onRender: () => <>some jsx</> },
  });

  const Basic = meta.story({
    play: async ({ args, mount }) => {
      const canvas = await mount(<TestButton {...args} />);
      expectTypeOf(canvas).toEqualTypeOf<Canvas>();
      expectTypeOf(args.onClick).toEqualTypeOf<Mock>();
      expectTypeOf(args.onRender).toEqualTypeOf<() => JSX.Element>();
    },
  });
});
