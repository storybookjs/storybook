import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import cp from 'child_process'
import path from 'path'
import semver from 'semver'
import { readPackageJson } from './helper'

const ESLINT = `.${path.sep}node_modules${path.sep}.bin${path.sep}eslint`

describe('Integration with flat config', () => {
  let originalCwd: null | string = null

  beforeEach(() => {
    originalCwd = process.cwd()
    process.chdir(path.join(__dirname, 'flat-config'))
    cp.execSync('pnpm i -f', { stdio: 'inherit' })
  })
  afterEach(() => {
    if (originalCwd) {
      process.chdir(originalCwd)
    }
  })

  it('should work with config', () => {
    if (
      !semver.satisfies(
        process.version,
        readPackageJson(path.resolve(__dirname, 'flat-config/node_modules/eslint')).engines.node
      )
    ) {
      return
    }

    const result = JSON.parse(
      cp.execSync(`${ESLINT} a.stories.tsx --max-warnings 2 --format=json`, {
        encoding: 'utf-8',
      })
    )
    expect(result.length).toBe(1)
    expect(result[0].messages[0].messageId).toBe('shouldHaveStoryExport')
    expect(result[0].messages[1].messageId).toBe('metaShouldHaveInlineProperties')
  })
})
