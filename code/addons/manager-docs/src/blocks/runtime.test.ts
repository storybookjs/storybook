// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { COMPONENT_BLOCK_TAG } from '../constants.ts';
import { defineManagerDocsBlocks, scopeToHost, updateStyle } from './runtime.ts';

type BlockElement = HTMLElement & { blockProps?: unknown; blockText?: string };

describe('component block element', () => {
  it('renders its props in a shadow root, with text as children', () => {
    const render = vi.fn();
    const Callout = () => null;
    defineManagerDocsBlocks({
      components: { './src/Callout#Callout': Callout },
      mount: () => ({ render, unmount: vi.fn() }),
    });
    const element = document.createElement(COMPONENT_BLOCK_TAG) as BlockElement;
    element.dataset.blockId = './src/Callout#Callout';
    element.blockText = 'be careful';
    element.blockProps = { tone: 'warning' };
    document.body.append(element);

    expect(element.shadowRoot).not.toBeNull();
    expect(render).toHaveBeenLastCalledWith(Callout, { tone: 'warning', children: 'be careful' });

    element.blockProps = { tone: 'info' };
    expect(render).toHaveBeenLastCalledWith(Callout, { tone: 'info', children: 'be careful' });
    element.remove();
  });

  it('remounts live blocks with the components of a newer registration', () => {
    const element = document.createElement(COMPONENT_BLOCK_TAG) as BlockElement;
    element.dataset.blockId = 'pkg#Tip';
    element.blockProps = {};
    document.body.append(element);
    const first = { render: vi.fn(), unmount: vi.fn() };
    const second = { render: vi.fn(), unmount: vi.fn() };
    const Tip = () => null;
    const NextTip = () => null;

    defineManagerDocsBlocks({ components: { 'pkg#Tip': Tip }, mount: () => first });
    defineManagerDocsBlocks({ components: { 'pkg#Tip': NextTip }, mount: () => second });

    expect(first.unmount).toHaveBeenCalled();
    expect(second.render).toHaveBeenLastCalledWith(NextTip, {});

    element.remove();
    expect(second.unmount).toHaveBeenCalled();
  });

  it('adopts injected styles into its shadow root, not the document', () => {
    const element = document.createElement(COMPONENT_BLOCK_TAG) as BlockElement;
    element.dataset.blockId = 'pkg#Tip';
    element.blockProps = {};
    document.body.append(element);

    updateStyle('/src/Tip.module.css', '.tip { color: red; }');

    expect(element.shadowRoot?.adoptedStyleSheets).toHaveLength(1);
    expect(document.adoptedStyleSheets).toHaveLength(0);
    expect(document.head.querySelector('style')).toBeNull();
    element.remove();
  });
});

describe('scopeToHost', () => {
  it('moves document root selectors onto the block host', () => {
    expect(scopeToHost(':root{--a:1}:root[data-x] .b{}')).toBe(':host{--a:1}:host[data-x] .b{}');
  });
});
