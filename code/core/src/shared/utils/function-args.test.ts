import { describe, expect, it } from 'vitest';

import { parse, stringify } from 'telejson';

import {
  createArgFunctionReviver,
  reviveArgFunctions,
  serializeArgFunctions,
} from './function-args.ts';

const overTheWire = <T>(value: T): T => parse(stringify(value, { maxDepth: 25 }));

describe('serializeArgFunctions', () => {
  it('replaces nested functions with a name marker, at any depth', () => {
    const handleLinkClick = function handleLinkClick() {};

    const serialized = serializeArgFunctions({
      link: {
        onClick: handleLinkClick,
        href: '#',
        // an inline arrow assigned to a property infers the property name
        children: [1, { onSelect: () => {} }],
      },
    });

    expect(serialized).toEqual({
      link: {
        onClick: { __function__: { name: handleLinkClick.name } },
        href: '#',
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

    expect(overTheWire(serializeArgFunctions(args))).toEqual({
      link: { onClick: { __function__: { name: 'handleOpen' } }, href: '#' },
    });
    expect(overTheWire(args).link).not.toHaveProperty('onClick');
  });

  it('escapes plain objects that look like a function marker', () => {
    const args = { meta: { __function__: { name: 'not-a-function' } }, href: '#' };

    expect(serializeArgFunctions(args)).toEqual({
      meta: { __sb_function_escape__: { __function__: { name: 'not-a-function' } } },
      href: '#',
    });
  });

  it('escapes plain objects that look like the escape wrapper itself', () => {
    const args = { meta: { __sb_function_escape__: { trick: true } }, href: '#' };

    expect(serializeArgFunctions(args)).toEqual({
      meta: { __sb_function_escape__: { __sb_function_escape__: { trick: true } } },
      href: '#',
    });
  });

  it('keeps escaping marker-shaped data nested inside escaped data', () => {
    const args = { meta: { __function__: { name: 'a' }, nested: { __function__: { name: 'b' } } } };

    expect(serializeArgFunctions(args)).toEqual({
      meta: {
        __sb_function_escape__: {
          __function__: { name: 'a' },
          nested: { __sb_function_escape__: { __function__: { name: 'b' } } },
        },
      },
    });
  });

  it('stops at the transport max depth instead of recursing forever', () => {
    const circular: any = { name: 'value' };
    circular.self = circular;

    expect(() => serializeArgFunctions(circular)).not.toThrow();
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

  it('does not mutate the input', () => {
    const payload = { onClick: { __function__: { name: 'handleLinkClick' } } };

    reviveArgFunctions(payload);

    expect(payload.onClick).toEqual({ __function__: { name: 'handleLinkClick' } });
  });

  it('resolves a marker against the function stored at the same path', () => {
    const realCallback = function onClick() {};
    const current = { link: { href: '#', onClick: realCallback } };
    const incoming = {
      link: { href: 'https://example.com', onClick: { __function__: { name: 'onClick' } } },
    };

    const revived = reviveArgFunctions(incoming, current);

    // The sibling edit applies, and the live callback survives it.
    expect(revived.link.href).toBe('https://example.com');
    expect(revived.link.onClick).toBe(realCallback);
  });

  it('falls back to a fresh function when the stored value is not a matching function', () => {
    const current = { onDelete: () => {} };

    const revived = reviveArgFunctions(
      { onDelete: { __function__: { name: 'handleDelete' } } },
      current
    );

    expect(typeof revived.onDelete).toBe('function');
    expect((revived.onDelete as () => void).name).toBe('handleDelete');
    expect(revived.onDelete).not.toBe(current.onDelete);
  });

  it('returns marker-shaped user data untouched, over the wire and back', () => {
    const args = { meta: { __function__: { name: 'not-a-function' } } };

    const roundTripped = reviveArgFunctions(overTheWire(serializeArgFunctions(args)));

    expect(roundTripped).toEqual(args);
    expect(typeof (roundTripped.meta as Record<string, unknown>).__function__).toBe('object');
  });

  it('returns escape-shaped user data untouched', () => {
    const args = { meta: { __sb_function_escape__: { trick: true } } };

    expect(reviveArgFunctions(overTheWire(serializeArgFunctions(args)))).toEqual(args);
  });

  it('never shares identity between same-named functions at different paths', () => {
    const revived = reviveArgFunctions({
      a: { onClick: { __function__: { name: 'onClick' } } },
      b: { onClick: { __function__: { name: 'onClick' } } },
    });

    expect(revived.a.onClick).not.toBe(revived.b.onClick);
  });

  it('keeps one identity per path within a single event', () => {
    const reviver = createArgFunctionReviver();
    const initialArgs = { link: { onClick: { __function__: { name: 'onClick' } } } };
    const args = {
      href: '#',
      link: { onClick: { __function__: { name: 'onClick' } } },
    };

    const revivedInitialArgs = reviver.revive(initialArgs);
    const revivedArgs = reviver.revive(args);

    expect(revivedArgs.link.onClick).toBe(revivedInitialArgs.link.onClick);
  });

  it('keeps identity stable across events by resolving against stored args', () => {
    const marker = { onClick: { __function__: { name: 'onClick' } } };
    const first = reviveArgFunctions(marker);

    const second = reviveArgFunctions(marker, first);

    expect(second.onClick).toBe(first.onClick);
  });

  it('round-trips through serialize, telejson, and revive', () => {
    const args = { link: { onClick: function handleLinkClick() {}, href: '#' } };

    const roundTripped = reviveArgFunctions(overTheWire(serializeArgFunctions(args)));

    expect(roundTripped.link.href).toBe('#');
    expect(typeof roundTripped.link.onClick).toBe('function');
    expect(roundTripped.link.onClick.name).toBe('handleLinkClick');
  });

  it('survives the full preview to manager to sibling edit to preview round trip', () => {
    const realCallback = function onClick() {};
    const initial = { link: { href: '#', onClick: realCallback } };

    // Preview sends STORY_PREPARED over the channel.
    const wire = overTheWire(serializeArgFunctions(initial));

    // Manager revives the pair with one reviver, twice over two events.
    const managerReviver = createArgFunctionReviver();
    const managerInitialArgs = managerReviver.revive(wire);
    const managerArgs = managerReviver.revive(wire);
    expect(managerArgs.link.onClick).toBe(managerInitialArgs.link.onClick);

    // User edits a sibling key in Controls; the manager sends the whole object back, its
    // function slot now holding the placeholder.
    const siblingEdit = {
      link: { href: 'https://example.com', onClick: managerArgs.link.onClick },
    };
    const editWire = overTheWire(serializeArgFunctions(siblingEdit));

    // Preview applies the update against its live args.
    const applied = reviveArgFunctions(editWire, initial);

    expect(applied.link.href).toBe('https://example.com');
    expect(applied.link.onClick).toBe(realCallback);
  });
});
