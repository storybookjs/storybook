import { describe, expect, it } from "vitest";

describe("environment", () => {
  it("should provide user defined env variables via .env file", () => {
    expect(import.meta.env.NEXT_PUBLIC_EXAMPLE1).toBe("example1");
    // expect(import.meta.env.EXAMPLE2).toBe("abcdefghijk");
  });
});
