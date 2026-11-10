import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CHECKS, CHECK_IDS, checksFor } from '../checks.ts';

const checklist = readFileSync(new URL('../references/basic-qa.md', import.meta.url), 'utf8');
const agentCells = checklist
  .split('\n')
  .filter((line) => line.startsWith('| '))
  .map((line) => line.split(/(?<!\\)\|/).map((cell) => cell.trim()))
  .filter((cells) => cells.length >= 7 && cells[1] !== 'Row' && !(cells[1] ?? '').startsWith('-'))
  .map((cells) => cells[5] ?? '');

// Test paths in the Agent column are relative to code/, except the kitchen-sink's e2e-tests/.
const testRoots = ['../../code/', '../../test-storybooks/portable-stories-kitchen-sink/react/'];
const testExists = (path: string) =>
  testRoots.some((root) => existsSync(new URL(root + path, import.meta.url)));

describe('check registry', () => {
  it('has unique ids', () => {
    expect(new Set(CHECK_IDS).size).toBe(CHECK_IDS.length);
  });

  it('keeps the must tier a strict subset of extended', () => {
    const must = checksFor('must');
    expect(must.every((check) => check.tier === 'must')).toBe(true);
    expect(checksFor('extended')).toHaveLength(CHECKS.length);
    expect(must.length).toBeLessThan(CHECKS.length);
  });

  it('is referenced by the checklist only through ids it defines', () => {
    const referenced = agentCells.filter((cell) => /^[a-z]+\.[a-z.-]+$/.test(cell));
    const unknown = referenced.filter((id) => !CHECK_IDS.includes(id as never));
    expect(unknown).toEqual([]);
  });

  it('has every id on at least one checklist row', () => {
    const referenced = new Set(agentCells);
    const orphan = CHECK_IDS.filter((id) => !referenced.has(id));
    expect(orphan).toEqual([]);
  });

  it('leaves no planned row whose id already exists', () => {
    const stale = agentCells
      .filter((cell) => cell.startsWith('planned:'))
      .map((cell) => cell.replace('planned:', '').trim())
      .filter((id) => CHECK_IDS.includes(id as never));
    expect(stale).toEqual([]);
  });

  it('names only test files that exist in monorepo and e2e notes', () => {
    const paths = agentCells
      .filter((cell) => cell.startsWith('monorepo:') || cell.includes('e2e:'))
      .flatMap((cell) => [...cell.matchAll(/`([^`]+\.(?:spec|test)\.ts)`/g)].map((m) => m[1]!));
    const missing = paths.filter((path) => !testExists(path));
    expect(missing).toEqual([]);
  });
});
