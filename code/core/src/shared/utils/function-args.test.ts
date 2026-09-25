import { describe, expect, it } from 'vitest';

import { parse, stringify } from 'telejson';

import { reviveArgFunctions, serializeArgFunctions } from './function-args.ts';

describe('serializeArgFunctions', () => {
  it('replaces nested functions with a name marker, at any depth', () => {
    const handleLinkClick = function handleLinkClick() {};
    const serialized = serializeArgFunctions({
      label: 'open',
      link: { onClick: handleLinkClick, href: '#', children: [1, { onSelect: () => {} }] },
    });

    expect(serialized).toEqual({
      label: 'open',
      link: {
        onClick: { __function__: { name: handleLinkClick.name } },
        href: '#',
        // an inline arrow assigned to a property infers the property name
        children: [1, { onSelect: { __function__: { name: 'onSelect' } } }],
      },
    });
  });

  it('does not mutate the input, keeping the real functions intact', () => {
    const onClick = () => {};
    const args = { link: { onClick, href: '#' } };

    serializeArgFunctions(args);

    expect(args.link.onClick).toBe(onClick);
  });

  it('passes non-plain objects through untouched', () => {
    const date = new Date(0);
    const regexp = /re/g;

    expect(serializeArgFunctions({ date, regexp })).toEqual({ date, regexp });
  });

  it('survives telejson, where the real function does not', () => {
    const args = { link: { onClick: function handleOpen() {}, href: '#' } };

    const overTheWire = parse(stringify(serializeArgFunctions(args), { maxDepth: 25 }));

    expect(overTheWire).toEqual({
      link: { onClick: { __function__: { name: 'handleOpen' } }, href: '#' },
    });
    expect(parse(stringify(args, { maxDepth: 25 })).link).not.toHaveProperty('onClick');
  });

  it('stops at the transport max depth instead of recursing forever', () => {
    let deep: { nested?: unknown; fn?: unknown } = { fn: function deepest() {} };
    for (let i = 0; i < 30; i += 1) {
      deep = { nested: deep };
    }

    expect(() => serializeArgFunctions(deep)).not.toThrow();
  });
});

describe('reviveArgFunctions', () => {
  it('restores markers as functions carrying their original name', () => {
    const revived = reviveArgFunctions({
      link: { onClick: { __function__: { name: 'handleLinkClick' } }, href: '#' },
    });

    expect(typeof revived.link.onClick).toBe('function');
    expect(revived.link.onClick.name).toBe('handleLinkClick');
    expect(revived.link.href).toBe('#');
  });

  it('restores the same function identity for the same name across calls', () => {
    // Args are diffed by reference in the manager (URL args, save-story); two events describing
    // the same unchanged function must not produce distinct instances.
    const first = reviveArgFunctions({ onClick: { __function__: { name: 'handleLinkClick' } } });
    const second = reviveArgFunctions({ onClick: { __function__: { name: 'handleLinkClick' } } });

    expect(second.onClick).toBe(first.onClick);
  });

  it('does not mutate the input', () => {
    const payload = { onClick: { __function__: { name: 'handleLinkClick' } } };

    reviveArgFunctions(payload);

    expect(payload.onClick).toEqual({ __function__: { name: 'handleLinkClick' } });
  });

  it('round-trips through serialize, telejson, and revive', () => {
    const args = {
      link: {
        onClick: function handleLinkClick() {},
        items: [1, 'two', [{ onSelect: function handleSelect() {} }]],
      },
    };

    const overTheWire = reviveArgFunctions(
      parse(stringify(serializeArgFunctions(args), { maxDepth: 25 }))
    );

    expect(typeof overTheWire.link.onClick).toBe('function');
    expect(overTheWire.link.onClick.name).toBe('handleLinkClick');
    expect(overTheWire.link.items.slice(0, 2)).toEqual([1, 'two']);
    expect(typeof overTheWire.link.items[2][0].onSelect).toBe('function');
    expect(overTheWire.link.items[2][0].onSelect.name).toBe('handleSelect');
  });
});
