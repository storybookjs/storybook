import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { countDocumentation } from './compodoc-doc.ts';

/** Real compodoc output, committed as the Angular docgen baselines. */
const fixture = (name: string) =>
  countDocumentation(
    path.join(import.meta.dirname, '../../../angular/__testfixtures__', name, 'compodoc-input.json')
  );

describe('countDocumentation', () => {
  it('counts an inherited member once, not once per class that lists it', () => {
    // The component declares `heading` and `dismissed` and inherits `dismissible`, which compodoc
    // also lists separately under `classes`. Counting `classes` too would report it twice.
    expect(fixture('cross-file-inheritance').members).toBe(3);
  });

  it('counts signal inputs and outputs like decorator ones', () => {
    expect(fixture('signal-io').members).toBe(6);
  });

  describe('opaque types', () => {
    it('separates a union written inline from the same union behind an alias', () => {
      // This component's three inputs are `ButtonKind`, `"small" | "large"` and `ToneOption`. The
      // inline one describes itself; the two aliases are names compodoc never looked through, and
      // an engine that resolved them would document the same three members off far more work.
      const counts = fixture('decorator-union-enum');
      expect(counts.members).toBe(3);
      expect(counts.opaqueTypes).toBe(2);
    });

    it('counts an unresolved generic parameter', () => {
      expect(fixture('decorator-generic')).toEqual({ members: 2, opaqueTypes: 2 });
    });

    it('counts an output whose payload type was dropped', () => {
      // compodoc records `EventEmitter`, losing the emitted shape.
      expect(fixture('decorator-io-basics')).toEqual({ members: 5, opaqueTypes: 1 });
    });

    it('reports none when every member describes itself', () => {
      expect(fixture('properties-methods-noise').opaqueTypes).toBe(0);
      expect(fixture('jsdoc-tags').opaqueTypes).toBe(0);
    });
  });
});
