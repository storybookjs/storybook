export function removeTomlSection(content: string, sectionHeader: string) {
	const lines = content.split(/\r?\n/);

	if (!lines.some((line) => line.trim() === sectionHeader)) {
		return content;
	}

	const kept: string[] = [];
	let skipping = false;

	for (const line of lines) {
		const header = line.trim();
		if (header.startsWith('[') && header.endsWith(']')) {
			skipping = header === sectionHeader;
		}
		if (!skipping) {
			kept.push(line);
		}
	}

	return `${kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
