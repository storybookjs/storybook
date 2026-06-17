import React from 'react';

import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLinkStatus as mockUseLinkStatus } from '@storybook/nextjs/link.mock';

import Link, { useLinkStatus } from 'next/link';
import { expect, within } from 'storybook/test';

import style from './Link.stories.module.css';

// `onClick`, `href`, and `ref` need to be passed to the DOM element
// for proper handling
const MyButton = React.forwardRef<
  HTMLAnchorElement,
  React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>
>(function Button({ onClick, href, children }, ref) {
  return (
    <a href={href} onClick={onClick} ref={ref}>
      {children}
    </a>
  );
});

const Component = () => (
  <ul>
    <li>
      <Link href="/">Normal Link</Link>
    </li>
    <li>
      <Link
        href={{
          pathname: '/with-url-object',
          query: { name: 'test' },
        }}
      >
        With URL Object
      </Link>
    </li>
    <li>
      <Link href="/replace-url" replace>
        Replace the URL instead of push
      </Link>
    </li>
    <li>
      <Link href="/#hashid" scroll={false}>
        Disables scrolling to the top
      </Link>
    </li>
    <li>
      <Link href="/no-prefetch" prefetch={false}>
        No Prefetching
      </Link>
    </li>
    <li>
      <Link style={{ color: 'red' }} href="/with-style">
        With style
      </Link>
    </li>
    <li>
      <Link className={style.link} href="/with-classname">
        With className
      </Link>
    </li>
  </ul>
);

export default {
  component: Component,
} as Meta<typeof Component>;

type Story = StoryObj<typeof Component>;

export const Default: Story = {};

export const InAppDir: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

function LinkStatusComponent() {
  const { pending } = useLinkStatus();
  return <div>{pending ? 'Pending' : 'Idle'}</div>;
}

export const DefaultLinkStatus: Story = {
  render: () => <LinkStatusComponent />,
  parameters: {
    nextjs: { appDirectory: true },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Idle')).toBeInTheDocument();
  },
};

export const PendingLinkStatus: Story = {
  render: () => <LinkStatusComponent />,
  parameters: {
    nextjs: { appDirectory: true },
  },
  beforeEach() {
    mockUseLinkStatus.mockReturnValue({ pending: true });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Pending')).toBeInTheDocument();
  },
};
