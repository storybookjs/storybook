import assert from 'node:assert/strict';
import test from 'node:test';

import {
  branchesMatch,
  formatCanaryRefStepName,
  optionalInput,
  parseCanaryRefStepName,
  parsePrNumber,
  parseSha,
  resolveCanaryRef,
  shasMatch,
  type CanaryRefGitHub,
} from './resolve-canary-ref.ts';

const FULL = 'cc789cec620ac79919c58cb889bc68db3522d429';
const SHORT = 'cc789ce';
const OTHER = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const DEFAULTS = {
  sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  branch: 'next',
  repository: 'storybookjs/storybook',
};

function github(overrides: Partial<CanaryRefGitHub> = {}): CanaryRefGitHub {
  return {
    getPull() {
      throw new Error('unexpected getPull');
    },
    getBranch() {
      throw new Error('unexpected getBranch');
    },
    getCommit(sha) {
      if (sha === DEFAULTS.sha || sha === FULL || sha === SHORT) {
        return { sha: sha === DEFAULTS.sha ? DEFAULTS.sha : FULL };
      }
      throw new Error(`commit ${sha} not found`);
    },
    ...overrides,
  };
}

test('optionalInput treats blank strings as omitted', () => {
  assert.equal(optionalInput(undefined), undefined);
  assert.equal(optionalInput(''), undefined);
  assert.equal(optionalInput('  '), undefined);
  assert.equal(optionalInput(' 34799 '), '34799');
});

test('parsePrNumber accepts a number or #prefix', () => {
  assert.equal(parsePrNumber('34799'), 34799);
  assert.equal(parsePrNumber('#34799'), 34799);
  assert.throws(() => parsePrNumber('0'));
  assert.throws(() => parsePrNumber('pr-12'));
});

test('parseSha accepts 7-40 hex characters', () => {
  assert.equal(parseSha(SHORT), SHORT);
  assert.equal(parseSha(FULL.toUpperCase()), FULL);
  assert.throws(() => parseSha('abc'));
  assert.throws(() => parseSha('not-a-sha'));
});

test('shasMatch compares short and full SHAs', () => {
  assert.equal(shasMatch(FULL, SHORT), true);
  assert.equal(shasMatch(SHORT, FULL), true);
  assert.equal(shasMatch(FULL, OTHER), false);
});

test('branchesMatch accepts the head ref or owner:name label', () => {
  const head = { ref: 'fix-foo', label: 'alice:fix-foo' };
  assert.equal(branchesMatch('fix-foo', head), true);
  assert.equal(branchesMatch('alice:fix-foo', head), true);
  assert.equal(branchesMatch('next', head), false);
});

test('resolveCanaryRef uses defaults when every input is omitted', () => {
  assert.deepEqual(resolveCanaryRef({}, DEFAULTS, github()), {
    repository: DEFAULTS.repository,
    sha: DEFAULTS.sha,
    branch: DEFAULTS.branch,
    prNumber: null,
  });
  assert.deepEqual(resolveCanaryRef({ pr: '', branch: '  ', sha: '' }, DEFAULTS, github()), {
    repository: DEFAULTS.repository,
    sha: DEFAULTS.sha,
    branch: DEFAULTS.branch,
    prNumber: null,
  });
});

test('resolveCanaryRef uses the PR head when only pr is set', () => {
  const result = resolveCanaryRef(
    { pr: '#12' },
    DEFAULTS,
    github({
      getPull(number) {
        assert.equal(number, 12);
        return {
          number: 12,
          head: {
            sha: FULL,
            ref: 'fix-foo',
            label: 'alice:fix-foo',
            repo: { full_name: 'alice/storybook' },
          },
        };
      },
    })
  );
  assert.deepEqual(result, {
    repository: 'alice/storybook',
    sha: FULL,
    branch: 'fix-foo',
    prNumber: 12,
  });
});

test('resolveCanaryRef accepts matching branch and sha with a PR', () => {
  const api = github({
    getPull() {
      return {
        number: 12,
        head: {
          sha: FULL,
          ref: 'fix-foo',
          label: 'alice:fix-foo',
          repo: { full_name: 'alice/storybook' },
        },
      };
    },
  });
  assert.equal(
    resolveCanaryRef({ pr: '12', branch: 'alice:fix-foo', sha: SHORT }, DEFAULTS, api).sha,
    FULL
  );
});

test('resolveCanaryRef rejects a sha that is not the PR head', () => {
  assert.throws(
    () =>
      resolveCanaryRef(
        { pr: '12', sha: OTHER.slice(0, 7) },
        DEFAULTS,
        github({
          getPull() {
            return {
              number: 12,
              head: {
                sha: FULL,
                ref: 'fix-foo',
                label: 'alice:fix-foo',
                repo: { full_name: 'alice/storybook' },
              },
            };
          },
        })
      ),
    /do not match/
  );
});

test('resolveCanaryRef rejects a branch that is not the PR head', () => {
  assert.throws(
    () =>
      resolveCanaryRef(
        { pr: '12', branch: 'next' },
        DEFAULTS,
        github({
          getPull() {
            return {
              number: 12,
              head: {
                sha: FULL,
                ref: 'fix-foo',
                label: 'alice:fix-foo',
                repo: { full_name: 'alice/storybook' },
              },
            };
          },
        })
      ),
    /do not match/
  );
});

test('resolveCanaryRef uses an in-repo branch tip when only branch is set', () => {
  const result = resolveCanaryRef(
    { branch: 'jeppe/foo' },
    DEFAULTS,
    github({
      getBranch(branch) {
        assert.equal(branch, 'jeppe/foo');
        return { name: 'jeppe/foo', commitSha: FULL };
      },
    })
  );
  assert.deepEqual(result, {
    repository: DEFAULTS.repository,
    sha: FULL,
    branch: 'jeppe/foo',
    prNumber: null,
  });
});

test('resolveCanaryRef rejects a sha that is not the branch tip', () => {
  assert.throws(
    () =>
      resolveCanaryRef(
        { branch: 'jeppe/foo', sha: OTHER.slice(0, 7) },
        DEFAULTS,
        github({
          getBranch() {
            return { name: 'jeppe/foo', commitSha: FULL };
          },
        })
      ),
    /do not match/
  );
});

test('resolveCanaryRef expands a sha-only input', () => {
  assert.deepEqual(resolveCanaryRef({ sha: SHORT }, DEFAULTS, github()), {
    repository: DEFAULTS.repository,
    sha: FULL,
    branch: '',
    prNumber: null,
  });
});

test('resolveCanaryRef keeps the default branch when sha-only matches the dropdown', () => {
  const defaults = { ...DEFAULTS, sha: FULL };
  assert.deepEqual(resolveCanaryRef({ sha: SHORT }, defaults, github()), {
    repository: DEFAULTS.repository,
    sha: FULL,
    branch: DEFAULTS.branch,
    prNumber: null,
  });
});

test('resolveCanaryRef tells the caller to pass a PR number when sha-only is missing', () => {
  assert.throws(
    () => resolveCanaryRef({ sha: OTHER.slice(0, 7) }, DEFAULTS, github()),
    /for a fork PR pass the PR number/
  );
});

test('resolveCanaryRef fails when the PR head repository is gone', () => {
  assert.throws(
    () =>
      resolveCanaryRef(
        { pr: '12' },
        DEFAULTS,
        github({
          getPull() {
            return {
              number: 12,
              head: { sha: FULL, ref: 'fix-foo', label: 'alice:fix-foo', repo: null },
            };
          },
        })
      ),
    /no head repository/
  );
});

test('formatCanaryRefStepName round-trips through parseCanaryRefStepName', () => {
  const ref = {
    repository: 'alice/storybook',
    sha: FULL,
    branch: 'fix-foo',
    prNumber: 12,
  };
  assert.deepEqual(parseCanaryRefStepName(formatCanaryRefStepName(ref)), {
    repository: 'alice/storybook',
    sha: FULL,
    branch: '',
    prNumber: 12,
  });
  assert.deepEqual(parseCanaryRefStepName(formatCanaryRefStepName({ ...ref, prNumber: null })), {
    repository: 'alice/storybook',
    sha: FULL,
    branch: '',
    prNumber: null,
  });
});
