// Shim globals in esm bundle
import { fileURLToPath } from 'url'
import path from 'path'

const getFilename = () => fileURLToPath(import.meta.url)
const getDirname = () => path.dirname(getFilename())

export const __dirname = /* @__PURE__ */ getDirname()
export const __filename = /* @__PURE__ */ getFilename()
