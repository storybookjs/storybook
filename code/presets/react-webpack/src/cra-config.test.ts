import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getReactScriptsPath } from './cra-config';

vi.mock('fs', () => ({
  realpathSync: vi.fn(() => '/test-project'),
  readFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

const SCRIPT_PATH = path.join('.bin', 'react-scripts');

describe('cra-config', () => {
  describe('when used with the default react-scripts package', () => {
    beforeEach(() => {
      vi.mocked(fs.realpathSync).mockImplementationOnce((filePath) =>
        filePath.toString().replace(SCRIPT_PATH, `react-scripts/${SCRIPT_PATH}`)
      );
    });

    it('should locate the react-scripts package', () => {
      expect(getReactScriptsPath({ noCache: true })).toEqual(
        path.join(path.sep, 'test-project', 'node_modules', 'react-scripts')
      );
    });
  });

  describe('when used with a custom react-scripts package', () => {
    beforeEach(() => {
      vi.mocked(fs.realpathSync).mockImplementationOnce((filePath) =>
        filePath.toString().replace(SCRIPT_PATH, `custom-react-scripts/${SCRIPT_PATH}`)
      );
    });

    it('should locate the react-scripts package', () => {
      expect(getReactScriptsPath({ noCache: true })).toEqual(
        path.join(path.sep, 'test-project', 'node_modules', 'custom-react-scripts')
      );
    });
  });

  describe('when used with a custom react-scripts package without symlinks in .bin folder', () => {
    beforeEach(() => {
      // In case of .bin/react-scripts is not symlink (like it happens on Windows),
      // realpathSync() method does not translate the path.
      vi.mocked(fs.realpathSync).mockImplementationOnce((filePath) => filePath.toString());

      vi.mocked(fs.readFileSync).mockImplementationOnce(
        () => `#!/bin/sh
basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")

case \`uname\` in
    *CYGWIN*) basedir=\`cygpath -w "$basedir"\`;;
esac

if [ -x "$basedir/node" ]; then
  "$basedir/node"  "$basedir/../custom-react-scripts/bin/react-scripts.js" "$@"
  ret=$?
else
  node  "$basedir/../custom-react-scripts/bin/react-scripts.js" "$@"
  ret=$?
fi
exit $ret`
      );
    });

    it('should locate the react-scripts package', () => {
      expect(getReactScriptsPath({ noCache: true })).toEqual(
        path.join(path.sep, 'test-project', 'node_modules', 'custom-react-scripts')
      );
    });
  });
});
