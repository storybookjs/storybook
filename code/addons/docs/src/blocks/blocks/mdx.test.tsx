// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { AnchorMdx, HeaderMdx } from './mdx.tsx';

const { emitMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
}));

vi.mock('./DocsContext', () => ({
  DocsContext: React.createContext({
    channel: { emit: emitMock },
  }),
}));

vi.mock('../components', () => ({
  Source: ({ children }: any) => <pre>{children}</pre>,
}));

vi.mock('storybook/internal/components', () => {
  const MockAnchor = React.forwardRef<HTMLAnchorElement, any>(({ children, ...props }, ref) => (
    <a ref={ref} {...props}>
      {children}
    </a>
  ));
  MockAnchor.displayName = 'MockAnchor';

  return {
    Button: ({ children }: any) => <>{children}</>,
    Code: ({ children }: any) => <code>{children}</code>,
    components: {
      a: MockAnchor,
    },
    nameSpaceClassNames: (props: any) => props,
  };
});

vi.mock('@storybook/icons', () => ({
  LinkIcon: () => <span data-testid="link-icon" />,
}));

vi.mock('storybook/theming', () => {
  const styledFactory = (tag: React.ElementType) => () => {
    const Styled = React.forwardRef<any, any>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children)
    );
    Styled.displayName = `Styled${typeof tag === 'string' ? tag : 'Component'}`;
    return Styled;
  };

  return {
    styled: new Proxy(styledFactory, {
      get: (_target, tag) => styledFactory(tag as string),
    }),
  };
});

describe('AnchorMdx hash link scrolling', () => {
  afterEach(() => {
    emitMock.mockClear();
    cleanup();
    document.body.innerHTML = '';
  });

  it('scrolls hash links inside the preview document without emitting navigation', () => {
    const target = document.createElement('div');
    target.id = 'some-content';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const { getByText } = render(
      <AnchorMdx href="#some-content" target="_self">
        Go to content
      </AnchorMdx>
    );

    fireEvent.click(getByText('Go to content'));

    expect(emitMock).not.toHaveBeenCalled();
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });

  it('does not emit navigation when a hash target is missing', () => {
    const { getByText } = render(
      <AnchorMdx href="#missing-content" target="_self">
        Missing target
      </AnchorMdx>
    );

    const link = getByText('Missing target');
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);

    expect(emitMock).not.toHaveBeenCalled();
  });

  it('preserves external link behavior', () => {
    const { getByText } = render(
      <AnchorMdx href="https://example.com" target="_blank">
        External link
      </AnchorMdx>
    );

    const link = getByText('External link') as HTMLAnchorElement;
    expect(link.href).toBe('https://example.com/');
    expect(link.target).toBe('_blank');
  });

  it('preserves target blank behavior for hash links', () => {
    const target = document.createElement('div');
    target.id = 'some-content';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const { getByText } = render(
      <AnchorMdx href="#some-content" target="_blank">
        New tab hash
      </AnchorMdx>
    );

    const link = getByText('New tab hash');
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);

    expect(emitMock).not.toHaveBeenCalled();
    expect(target.scrollIntoView).not.toHaveBeenCalled();
    expect((link as HTMLAnchorElement).target).toBe('_blank');
  });
});

describe('HeaderMdx heading anchor scrolling', () => {
  afterEach(() => {
    emitMock.mockClear();
    cleanup();
    document.body.innerHTML = '';
  });

  it('scrolls heading anchors inside the preview document without emitting navigation', () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const { container } = render(
        <HeaderMdx as="h2" id="my-heading">
          My Heading
        </HeaderMdx>
      );

      const anchor = container.querySelector('a[href="#my-heading"]');
      expect(anchor).toBeTruthy();

      fireEvent.click(anchor!);

      expect(emitMock).not.toHaveBeenCalled();
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
