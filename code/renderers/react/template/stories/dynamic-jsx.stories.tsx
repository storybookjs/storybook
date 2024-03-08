import React from 'react';

const SlideshowArray = ({ page, pages }: { page: number; pages: React.ReactElement[] }) => {
  const Page = pages[page];
  return Page;
};

export default {
  component: SlideshowArray,
  parameters: { chromatic: { disable: true } },
  args: {
    pages: [<>Page 0</>, <>Page 1</>, <>Page 2</>],
  },
  tags: ['autodocs'],
};

export const Page0 = {
  args: { page: 0 },
};

export const Page1 = {
  args: { page: 1 },
};

const SlideshowObject = ({
  page,
  pages,
}: {
  page: number;
  pages: Record<string, React.ReactElement>;
}) => {
  const Page = pages[page];
  return Page;
};

export const PageObject = {
  args: {
    page: 1,
    pages: {
      0: <>Page 0</>,
      1: <>Page 1</>,
      2: <>Page 2</>,
    },
  },
  render: (args: any) => <SlideshowObject {...args} />,
};

const SlideshowNested = ({
  page,
  pages,
}: {
  page: number;
  pages: Record<string, React.ReactElement>[];
}) => {
  const Page = pages[page][page];
  return Page;
};

export const PageNested = {
  args: {
    page: 1,
    pages: [{ 0: <>Page 0</> }, { 1: <>Page 1</> }, { 2: <>Page 2</> }],
  },
  render: (args: any) => <SlideshowNested {...args} />,
};
