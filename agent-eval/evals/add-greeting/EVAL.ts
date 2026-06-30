import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { test, expect } from 'vitest';

test('greeting message exists in source', () => {
	const content = readFileSync('src/App.tsx', 'utf-8');
	expect(content).toContain('Welcome, user!');
});

test('app still builds', () => {
	// This throws if the build fails
	execSync('npm run build', { stdio: 'pipe' });
});
