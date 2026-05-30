import React from 'react';

import type { Channel } from 'storybook/internal/channels';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, waitFor, within } from 'storybook/test';
import { styled } from 'storybook/theming';

import { createDocsSlugger, DocsSluggerContext } from '../blocks/DocsSluggerContext';
import { Heading } from '../blocks/Heading';
import { Subheading } from '../blocks/Subheading';
import { TableOfContents } from './TableOfContents';

const MockPage = styled.div`
  display: flex;
  flex-direction: row;
`;

const MockContent = styled.div`
  width: 75%;
  border: 1px solid #ccc;
`;

const mockChannel = {
  emit: () => {},
} as unknown as Channel;

const DuplicateHeadingDocs = () => {
  const slugger = React.useMemo(() => createDocsSlugger(), []);

  return (
    <DocsSluggerContext.Provider value={slugger}>
      <h1>Page title</h1>
      {['Button', 'Input', 'Tooltip'].map((section) => (
        <React.Fragment key={section}>
          <Heading>{section}</Heading>
          <Subheading>Properties</Subheading>
          Lorem ipsum.
          <Subheading>Slots</Subheading>
          Lorem ipsum.
          <Subheading>Events</Subheading>
          Lorem ipsum.
        </React.Fragment>
      ))}
    </DocsSluggerContext.Provider>
  );
};

const meta = {
  component: TableOfContents,
  parameters: {
    docs: {
      description: {
        component: 'Sanity checks on the TableOfContents component that encapsulates tocbot.',
      },
    },
  },
  render: (args) => {
    return (
      <MockPage>
        <MockContent className="local-story-docs">
          <h1>Page title</h1>
          <Heading>Section A</Heading>
          Some content.
          <Heading>Section B</Heading>
          More content.
          <Heading>Section C</Heading>
          Extra content.
        </MockContent>
        <TableOfContents {...args} />
      </MockPage>
    );
  },
} satisfies Meta<typeof TableOfContents>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    // Not used here yet. Would need to be mocked to test navigation.
    channel: mockChannel,
    headingSelector: 'h1, h2, h3',
    contentsSelector: '.local-story-docs',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const toc = canvas.getByRole('navigation');
    await step('Verify nav presence', async () => {
      expect(toc).toBeInTheDocument();
      expect(toc.tagName).toBe('NAV');
    });

    const title = canvas.getByRole('heading', { name: 'Table of contents' });
    await step('Verify title is present but invisible', async () => {
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('sb-sr-only');
    });

    await step('Verify nav aria-labelledby', async () => {
      expect(toc).toHaveAttribute('aria-labelledby', title.id);
    });

    const wrapper = canvas.getByRole('complementary');
    await step('Verify toc is wrapped by an aside', async () => {
      expect(wrapper).toBeInTheDocument();
      expect(wrapper.tagName).toBe('ASIDE');
      expect(wrapper.children[0]).toBe(toc);
    });
  },
};

export const WithTitle: StoryObj<typeof meta> = {
  args: {
    channel: mockChannel,
    headingSelector: 'h1, h2, h3',
    contentsSelector: '.local-story-docs',
    title: 'In this page',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const toc = canvas.getByRole('navigation');
    await step('Verify nav presence', async () => {
      expect(toc).toBeInTheDocument();
      expect(toc.tagName).toBe('NAV');
    });

    const title = canvas.getByRole('heading', { name: 'In this page' });
    await step('Verify title presence', async () => {
      expect(title).toBeInTheDocument();
    });

    await step('Verify nav aria-labelledby', async () => {
      expect(toc).toHaveAttribute('aria-labelledby', title.id);
    });
  },
};

export const WithReactTitle: StoryObj<typeof meta> = {
  args: {
    channel: mockChannel,
    headingSelector: 'h1, h2, h3',
    contentsSelector: '.local-story-docs',
    title: (
      <>
        In <em>this</em> page
      </>
    ),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const toc = canvas.getByRole('navigation');
    await step('Verify nav presence', async () => {
      expect(toc).toBeInTheDocument();
      expect(toc.tagName).toBe('NAV');
    });

    const title = toc.children[0];
    await step('Verify title presence', async () => {
      expect(title).toBeInTheDocument();
      expect(title.innerHTML).toBe('In <em>this</em> page');
    });

    await step('Verify nav aria-labelledby', async () => {
      expect(toc).toHaveAttribute('aria-labelledby', title.id);
    });
  },
};

export const WithDuplicateSubheadings: StoryObj<typeof meta> = {
  args: {
    channel: mockChannel,
    headingSelector: 'h2, h3',
    contentsSelector: '.local-story-docs',
  },
  render: (args) => {
    return (
      <MockPage>
        <MockContent className="local-story-docs">
          <DuplicateHeadingDocs />
        </MockContent>
        <TableOfContents {...args} />
      </MockPage>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    const links = await waitFor(() => {
      const tocLinks = canvas.getAllByRole('link');
      expect(tocLinks).toHaveLength(12);
      return tocLinks;
    });

    await step('Verify repeated subheadings get distinct TOC links', async () => {
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '#button',
        '#properties',
        '#slots',
        '#events',
        '#input',
        '#properties-1',
        '#slots-1',
        '#events-1',
        '#tooltip',
        '#properties-2',
        '#slots-2',
        '#events-2',
      ]);
    });
  },
};
