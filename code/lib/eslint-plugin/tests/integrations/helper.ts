import fs from 'fs'
import path from 'path'

export function readPackageJson(base: string) {
  return JSON.parse(fs.readFileSync(path.resolve(base, 'package.json'), 'utf-8'))
}
