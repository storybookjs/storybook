import Button from './components/Button';
import Tag from './components/Tag';

export default function App() {
	return (
		<main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
			<h1>Team notes</h1>
			<p>
				A tiny app for sharing short notes with your team. <Tag label="beta" tone="notice" />
			</p>
			<Button label="New note" onClick={() => alert('Not implemented yet')} />
		</main>
	);
}
