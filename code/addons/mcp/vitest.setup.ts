import { vi } from 'vitest';

// Global mock for storybook/internal/node-logger
// This mock must be hoisted to run before any imports
vi.mock('storybook/internal/node-logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		log: vi.fn(),
	},
}));
