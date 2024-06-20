import { describe, expect, it } from "vitest";

describe("environment", () => {
	it("should provide basic Next.js env variables", () => {
		expect(import.meta.env.MODE).toBe("test");
		expect(import.meta.env.PROD).toBe(false);
		expect(import.meta.env.DEV).toBe(true);
		expect(import.meta.env.BASE_URL).toBe("/");
	});

	it("should provide user defined env variables via .env file", () => {
		expect(import.meta.env.NEXT_PUBLIC_ANALYTICS_ID).toBe("abcdefghijk");
	});
});
