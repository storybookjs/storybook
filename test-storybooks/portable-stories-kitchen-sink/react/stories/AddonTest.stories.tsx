import { expect } from '@storybook/test';
import { Meta, type StoryObj } from '@storybook/react'
import { instrument } from '@storybook/instrumenter'

declare global {
  // eslint-disable-next-line no-var
  var __vitest_browser__: boolean;
}

const Component = () => <button>test</button>

const meta = {
  title: 'Addons/Group/Test',
  component: Component,
} as Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

const { pass } = instrument({
  pass: async () => {},
}, { intercept: true })

export const ExpectedFailure: Story = {
  args: {
    forceFailure: false,
  },
  play: async ({ args }) => {
    await pass();
    if(args.forceFailure) {
      throw new Error('Expected failure');
    }
  }
};

export const ExpectedSuccess: Story = {
  play: async () => {
    await pass();
  }
};

export const LongRunning: Story = {
  loaders: [async () => new Promise((resolve) => setTimeout(resolve, 800))],
};

// Tests will pass in browser, but fail in CLI
export const MismatchFailure: Story = {
  play: async () => {
    await pass();
    if(!globalThis.__vitest_browser__) {
      throw new Error('Expected failure');
    }
  }
};

// Tests will fail in browser, but pass in CLI
export const MismatchSuccess: Story = {
  play: async () => {
    await pass();
    if(globalThis.__vitest_browser__) {
      throw new Error('Unexpected success');
    }
  },
  tags: ['fail-on-purpose'],
};

export const PreviewHeadTest: Story = {
  play: async () => {
    const styles = window.getComputedStyle(document.body);
    // set in preview-head.html
    expect(styles.backgroundColor).toBe('rgb(250, 250, 210)');
    // set in main.js#previewHead
    expect(styles.borderColor).toBe('rgb(255, 0, 0)');
  }
};

export const StaticDirTest: Story = {
  play: async () => {
    const path = '/test-static-dirs/static.js';
    const { staticFunction } = await import(/* @vite-ignore */path);
    expect(staticFunction()).toBe(true);
  }
}

export const ViteFinalTest: Story = {
  play: async () => {
    // @ts-expect-error TS doesn't know about the alias
    const { aliasedFunction } = await import('test-alias');
    expect(aliasedFunction()).toBe(true);
  }
}
