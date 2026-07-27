export function formatRating(rating: number): string {
	const clamped = Math.min(5, Math.max(0, rating));
	return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export function clampRating(rating: number): number {
	return Math.min(5, Math.max(0, rating));
}
