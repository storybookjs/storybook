import { describe,expect,it } from "vitest";
import {safeJsString} from './safeString';

describe('safeString', () => {
  it('should escape single quotes characters', () => {
    expect(safeJsString("./button.tsx'alert({ console.log('malicious code') })")).toMatchInlineSnapshot(`"./button.tsx\\'alert({ console.log(\\'malicious code\\') })"`);
  });

  it('should escape double quotes characters', () => {
    expect(safeJsString('./button.tsx"alert({ console.log("malicious code") })')).toMatchInlineSnapshot(`"./button.tsx\\"alert({ console.log(\\"malicious code\\") })"`);
  });

  it('should escape backslashes characters', () => {  
    expect(safeJsString('const file = "\\nexports.ts"')).toMatchInlineSnapshot(`"const file = \\"\\\\nexports.ts\\""`);
  });

  it('should escape new line characters', () => {
    expect(safeJsString('const file = "\nexports.ts"')).toMatchInlineSnapshot(`"const file = \\"\\nexports.ts\\""`);
  });

  it('should skip escaping if not needed', () => {
    expect(safeJsString('./button.tsx')).toMatchInlineSnapshot(`"./button.tsx"`);
  });
});