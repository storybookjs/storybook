import { describe, expect, it } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { recast, type NodePath } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import {
  argsRecordFromObjectNode,
  argsRecordFromObjectPath,
  mergeArgsRecords,
  metaArgsRecord,
} from './args.ts';
import { normalizeStoryDeclaration } from './normalize-story.ts';
import { keyOf, metaObjectPath } from './utils.ts';

const parse = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
};

const printRecord = (record: Record<string, t.Node>) => {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      // Recast may emit CRLF on Windows; keep assertions LF-stable across OSes.
      recast.print(value).code.replace(/\r\n/g, '\n'),
    ])
  );
};

const storyConfigPath = (code: string) => {
  const normalized = normalizeStoryDeclaration(parse(code)._storyDeclarationPath['A']);

  if (normalized.type !== 'config') {
    throw new Error('Expected story to normalize to a config object');
  }

  return normalized.path;
};

const argsPathFromConfig = (
  configPath: NodePath<t.ObjectExpression>
): NodePath<t.ObjectExpression> | undefined => {
  const property = configPath
    .get('properties')
    .find((path) => path.isObjectProperty() && keyOf(path.node) === 'args');

  const value = property?.isObjectProperty() ? property.get('value') : undefined;
  return value?.isObjectExpression() ? value : undefined;
};

describe('story args records', () => {
  it('extracts story args and skips computed, numeric, and spread properties', () => {
    const argsPath = argsPathFromConfig(
      storyConfigPath(dedent`
        export default { title: 'Button' };
        const dynamic = 'computed';
        const extra = { skipped: true };
        export const A = {
          args: {
            label: 'Save',
            'aria-label': 'Close',
            [dynamic]: 'Ignored',
            1: 'Ignored',
            ...extra,
          },
        };
      `)
    );

    expect(printRecord(argsRecordFromObjectPath(argsPath))).toMatchInlineSnapshot(`
      {
        "aria-label": "'Close'",
        "label": "'Save'",
      }
    `);
  });

  it('extracts args from an object node', () => {
    const argsPath = argsPathFromConfig(
      storyConfigPath(dedent`
        export default { title: 'Button' };
        export const A = {
          args: {
            label: 'Save',
            disabled: false,
          },
        };
      `)
    );

    expect(printRecord(argsRecordFromObjectNode(argsPath?.node))).toEqual({
      disabled: 'false',
      label: "'Save'",
    });
  });

  it('returns an empty record when story args are missing or absent', () => {
    const configPath = storyConfigPath(dedent`
      export default { title: 'Button' };
      export const A = {
        parameters: {},
      };
    `);

    expect(argsRecordFromObjectPath(argsPathFromConfig(configPath))).toEqual({});
    expect(argsRecordFromObjectNode()).toEqual({});
  });
});

describe('meta args records', () => {
  it('extracts meta args', () => {
    const meta = metaObjectPath(
      parse(dedent`
        export default {
          title: 'Button',
          args: {
            label: 'Default',
            disabled: false,
          },
        };
      `)
    );

    expect(printRecord(metaArgsRecord(meta?.node))).toMatchInlineSnapshot(`
      {
        "disabled": "false",
        "label": "'Default'",
      }
    `);
  });

  it('returns an empty record when meta args are missing or absent', () => {
    expect(
      metaArgsRecord(
        metaObjectPath(
          parse(dedent`
            export default { title: 'Button' };
          `)
        )?.node
      )
    ).toEqual({});
    expect(metaArgsRecord()).toEqual({});
  });
});

describe('mergeArgsRecords', () => {
  it('lets story args override meta args for the same key', () => {
    const meta = metaObjectPath(
      parse(dedent`
        export default {
          title: 'Button',
          args: {
            label: 'Default',
            size: 'medium',
          },
        };
      `)
    );
    const storyArgs = argsPathFromConfig(
      storyConfigPath(dedent`
        export default { title: 'Button' };
        export const A = {
          args: {
            label: 'Story',
          },
        };
      `)
    );

    expect(
      printRecord(mergeArgsRecords(metaArgsRecord(meta?.node), argsRecordFromObjectPath(storyArgs)))
    ).toMatchInlineSnapshot(`
      {
        "label": "'Story'",
        "size": "'medium'",
      }
    `);
  });
});
