import { readFileSync } from 'fs';
import { test, expect } from 'vitest';

test('greeting message exists in source', () => {
	const content = readFileSync('src/App.tsx', 'utf-8');
	expect(content).toContain('Welcome, user!');
});
